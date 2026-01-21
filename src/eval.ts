import { SKI, LT, Pointer, PointedTo, Var, App, Abs, Const, variable, combinator, app, expStr, makeAbstraction, compileSKI, intConst } from './ast'

function makePointer(node: SKI): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: PointedTo = { 'type': 'pointedto', 'evaluated': false, term: node }
    return { 'type': "ptr", 'value': pointedTo }
}

type FuncDef = {
    arity: number,
    fn: (...params: SKI[]) => SKI
}

function arithmetic(x: SKI, y: SKI, fn: (p1: number, p2: number) => number): SKI {
    if ((x.type === 'const' && x.ctype === 'int') && (y.type === 'const' && y.ctype === 'int')) {
        return intConst(fn(x.value, y.value))
    }
    throw new Error("invalid types for arithmetic operation, try evaluating arguments first")
}

const functionMap: Map<string, FuncDef> = new Map([
    ["+", { 'arity': 2, 'fn': (x, y) => arithmetic(x, y, (p1, p2) => p1 + p2) }]
])

export function evaluate(node: SKI): SKI {
    const lhs_stack: App[] = []

    let top = node

    while (top.type === 'ptr') {
        if (!top.value.evaluated) {
            top.value.term = evaluate(top.value.term)
            top.value.evaluated = true
        }

        top = top.value.term
    }

    // let top_content = top
    while (top.type === 'app') {
        lhs_stack.push(top)
        top = top.lhs

        while (top.type === 'ptr') {
            if (!top.value.evaluated) {
                top.value.term = evaluate(top.value.term)
                top.value.evaluated = true
            }

            top = top.value.term
        }
    }

    let loopAgain = true
    while (loopAgain && top.type === 'const' && (top.ctype === 'comb' || top.ctype === 'funcref')) {
        switch (top.name) {
            case "S":
                if (lhs_stack.length < 3) { loopAgain = false; break }
                else {
                    const f = lhs_stack.pop()!.rhs
                    const g = lhs_stack.pop()!.rhs
                    const x = makePointer(lhs_stack.pop()!.rhs)

                    const lhs = app(f, x)
                    const rhs = app(g, x)
                    top = app(lhs, rhs)
                }
                break;
            case "K":
                if (lhs_stack.length < 2) { loopAgain = false; break }
                else {
                    const x = lhs_stack.pop()!.rhs
                    lhs_stack.pop() // y
                    top = x
                }
                break;
            case "I":
                if (lhs_stack.length < 1) { loopAgain = false; break }
                else {
                    top = lhs_stack.pop()!.rhs
                }
                break;
            default:
                if (top.ctype === 'funcref') {
                    const func = functionMap.get(top.name)
                    if (func !== undefined) {
                        let args: SKI[] = []
                        for (let i = 0; i < func.arity; i++) {
                            args.push(evaluate(lhs_stack.pop()!.rhs))
                        }

                        top = func.fn(...args)
                        continue
                    }
                }

                throw new Error("cannot evaluate combinator: " + top.name)
        }

        while (top.type === 'ptr') {
            if (!top.value.evaluated) {
                top.value.term = evaluate(top.value.term)
                top.value.evaluated = true
            }

            top = top.value.term
        }

        // push lhs into stack again and get content if top is ptr
        while (top.type === 'app') {
            lhs_stack.push(top)
            top = top.lhs

            while (top.type === 'ptr') {
                if (!top.value.evaluated) {
                    top.value.term = evaluate(top.value.term)
                    top.value.evaluated = true
                }

                top = top.value.term
            }
        }
    }

    while (lhs_stack.length > 0) {
        // const rhs = evaluate(lhs_stack.pop()!.rhs) // should i evaluate here?
        const rhs = lhs_stack.pop()!.rhs // should i evaluate here?
        top = app(top, rhs)
    }
    return top;
}

export function evalExpStr(term: SKI): string {
    switch (term.type) {
        case "ptr": {
            const evaluated = term.value.evaluated ? "T" : "F"
            return "ptr,e=" + evaluated + "( " + evalExpStr(term.value.term) + " )"
        }
        case "var":
            {
                return term.varN;
            }
        case "const":
            {
                switch (term.ctype) {
                    case "comb":
                    case "funcref":
                        return term.name;
                    case "str":
                        return term.value;
                    case "int":
                        return term.value.toString();
                    default: throw new Error("Invalid ctype");
                }
            }
        case "app":
            {
                return " ( " + evalExpStr(term.lhs) + " " + evalExpStr(term.rhs) + " ) ";
            }
        case "abs":
            {
                return " ( λ " + term.var + " . " + evalExpStr(term.term) + " ) ";
            }
        default:
            throw new Error("invalid lambda term type");
    }
}
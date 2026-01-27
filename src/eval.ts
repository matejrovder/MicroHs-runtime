import { SKI, LT, Pointer, PointedTo, Var, App, Abs, Const, variable, combinator, app, expStr, makeAbstraction, compileSKI, intConst, strConst } from './ast'

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

function printFunction(x: SKI): SKI {
    console.log(evalExpStr(x))

    return strConst("print")
}

function comparison(x: SKI, y: SKI): SKI {
    if ((x.type === 'const' && x.ctype === 'int') && (y.type === 'const' && y.ctype === 'int')) {
        if (x.value === y.value) {
            return combinator("K")
        }
        else {
            return app(combinator("K"), combinator("I"))
        }
    }
    throw new Error("invalid types for arithmetic operation, try evaluating arguments first")
}

const functionMap: Map<string, FuncDef> = new Map([
    ["+", { 'arity': 2, 'fn': (x, y) => arithmetic(x, y, (p1, p2) => p1 + p2) }],
    ["-", { 'arity': 2, 'fn': (x, y) => arithmetic(x, y, (p1, p2) => p1 - p2) }],
    ["*", { 'arity': 2, 'fn': (x, y) => arithmetic(x, y, (p1, p2) => p1 * p2) }],
    ["=", { 'arity': 2, 'fn': (x, y) => comparison(x, y) }],
    ["print", { 'arity': 1, 'fn': (x) => printFunction(x) }],
    ["double", { 'arity': 1, 'fn': (x) => arithmetic(x, intConst(2), (p1, p2) => p1 * p2) }]
])

export function stepEval(node: SKI): [SKI, boolean] {
    const lhs_stack: App[] = []

    let top = node
    let combSuccess = true
    let change = true

    while (top.type === 'app') {
        lhs_stack.push(top)
        top = top.lhs
    }

    if (top.type === 'ptr') {
        if (!top.value.evaluated) {
            top.value.term = evaluate(top.value.term)
            top.value.evaluated = true
        }

        top = top.value.term
    }
    else if (top.type === 'const' && (top.ctype === 'comb' || top.ctype === 'funcref')) {
        switch (top.name) {
            case "S":
                if (lhs_stack.length < 3) { combSuccess = false; break }
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
                if (lhs_stack.length < 2) { combSuccess = false; break }
                else {
                    const x = lhs_stack.pop()!.rhs
                    lhs_stack.pop() // y
                    top = x
                }
                break;
            case "Y":
                if (lhs_stack.length < 1) { combSuccess = false; break }
                else {
                    const x = lhs_stack.pop()!.rhs
                    top = app(x, app(combinator("Y"), x))
                }
                break;
            case "I":
                if (lhs_stack.length < 1) { combSuccess = false; break }
                else {
                    top = lhs_stack.pop()!.rhs
                }
                break;
            default:
                if (top.ctype === 'funcref' && functionMap.has(top.name)) {
                    const func = functionMap.get(top.name)!
                    if (func.arity > lhs_stack.length) {
                        combSuccess = false
                        break;
                    }
                    const args: SKI[] = []
                    let readyToRun = true
                    for (let i = 0; i < func.arity; i++) {
                        const arg = lhs_stack.pop()!.rhs
                        const [arg_eval, arg_change] = stepEval(arg)
                        args.push(arg_eval)
                        if (arg_change) {
                            readyToRun = false
                            break
                        }
                    }
                    if (readyToRun) {
                        top = func.fn(...args)
                    }
                    else {
                        while (args.length > 0) {
                            lhs_stack.push(app(strConst("empty"), args.pop()!))
                        }
                    }
                }
                else {
                    throw new Error("cannot evaluate combinator: " + top.name)
                }
        }
        if (combSuccess === false) {
            change = false
        }
    }
    else {
        change = false
    }

    while (lhs_stack.length > 0) {
        const rhs = lhs_stack.pop()!.rhs // not evaluating here, to keep lazy eval
        top = app(top, rhs)
    }
    return [top, change];
}

function unwrapPointer(top: SKI, lhs_stack: App[]): SKI {
    while (top.type === 'ptr') {
        if (!top.value.evaluated) {
            top.value.term = evaluate(top.value.term)
            top.value.evaluated = true
        }

        top = top.value.term
    }

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

    return top
}

export function evaluate(node: SKI): SKI {
    const lhs_stack: App[] = []

    let top = node

    top = unwrapPointer(top, lhs_stack)

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
            case "Y":
                if (lhs_stack.length < 1) { loopAgain = false; break }
                else {
                    const x = lhs_stack.pop()!.rhs
                    top = app(x, app(combinator("Y"), x))
                }
                break;
            default:
                if (top.ctype === 'funcref') {
                    const func = functionMap.get(top.name)
                    if (func !== undefined) {
                        if (lhs_stack.length < func.arity) {
                            loopAgain = false;
                            break; // output will be the curried function
                        }
                        const args: SKI[] = []
                        for (let i = 0; i < func.arity; i++) {
                            args.push(evaluate(lhs_stack.pop()!.rhs))
                        }

                        top = func.fn(...args)
                        break
                    }
                }

                throw new Error("cannot evaluate combinator: " + top.name)
        }

        top = unwrapPointer(top, lhs_stack)
    }

    while (lhs_stack.length > 0) {
        // const rhs = evaluate(lhs_stack.pop()!.rhs) 
        const rhs = lhs_stack.pop()!.rhs // not evaluating here, to keep lazy eval
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
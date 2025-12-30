import { SKI, LT, Pointer, PointedTo, Var, App, Abs, Const, variable, combinator, app, expStr, makeAbstraction, compileSKI } from './ast'

function makePointer(node: SKI): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: PointedTo = { 'type': 'pointedto', 'evaluated': false, term: node }
    return { 'type': "ptr", 'value': pointedTo }
}

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
    while (loopAgain && top.type === 'const' && top.ctype === 'comb') {
        switch (top.name) {
            case "S":
                if (lhs_stack.length < 3) { loopAgain = false; break }
                else {
                    const f = lhs_stack.pop()!.rhs
                    const g = lhs_stack.pop()!.rhs
                    const x = makePointer(lhs_stack.pop()!.rhs)

                    const lhs = app(f, x)
                    const rhs = app(g, x)
                    // lhs_stack.push(app(lhs, rhs))
                    top = app(lhs, rhs)
                }
                break;
            case "K":
                if (lhs_stack.length < 2) { loopAgain = false; break }
                else {
                    const x = lhs_stack.pop()!.rhs
                    lhs_stack.pop() // y
                    // lhs_stack.push(x)
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
        const rhs = evaluate(lhs_stack.pop()!.rhs) // should i evaluate here?
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
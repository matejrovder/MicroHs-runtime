import { SKI, LT, Pointer, PointedTo, Var, App, Abs, Const, variable, combinator, app, expStr, makeAbstraction, compileSKI, intConst, strConst, Comb } from './ast'

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

function evalCombExpr(top: Comb, lhs_stack: App[]): [SKI, boolean] {
    switch (top.name) {
        case "S":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = makePointer(lhs_stack.pop()!.rhs)

                const lhs = app(f, x)
                const rhs = app(g, x)
                return [app(lhs, rhs), true]
            }
        case "K":
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                return [x, true]
            }
        case "I":
            if (lhs_stack.length < 1) { return [top, false] }
            else {
                return [lhs_stack.pop()!.rhs, true]
            }
        case "Y":
            if (lhs_stack.length < 1) { return [top, false] }
            else {
                const x = makePointer(lhs_stack.pop()!.rhs)
                return [app(x, app(combinator("Y"), x)), true]
            }
        case "B":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [app(f, app(g, x)), true]
            }
        case "C":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [app(app(f, x), g), true]
            }
        case "S'":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const c = lhs_stack.pop()!.rhs
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = makePointer(lhs_stack.pop()!.rhs)

                return [app(app(c, app(f, x)), app(g, x)), true]
            }
        case "B*":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const c = lhs_stack.pop()!.rhs
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [app(c, app(f, app(g, x))), true]
            }
        case "C'":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const c = lhs_stack.pop()!.rhs
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [app(app(c, app(f, x)), g), true]
            }
        default:
            throw new Error("cannot evaluate combinator: " + top.name)
    }
}

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
        if (top.ctype === 'comb') {
            [top, combSuccess] = evalCombExpr(top, lhs_stack)
        }
        else if (top.ctype === 'funcref' && functionMap.has(top.name)) {
            const func = functionMap.get(top.name)!
            if (func.arity > lhs_stack.length) {
                combSuccess = false
            }
            else {
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
        }
        else {
            throw new Error("cannot evaluate combinator: " + top.name)
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
        if (top.ctype === 'comb') {
            [top, loopAgain] = evalCombExpr(top, lhs_stack)
        }
        else if (top.ctype === 'funcref') {
            const func = functionMap.get(top.name)
            if (func !== undefined) {
                if (lhs_stack.length < func.arity) {
                    loopAgain = false;
                    // output will be the curried function
                }
                else {
                    const args: SKI[] = []
                    for (let i = 0; i < func.arity; i++) {
                        args.push(evaluate(lhs_stack.pop()!.rhs))
                    }

                    top = func.fn(...args)
                }
            }
        }
        else break
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
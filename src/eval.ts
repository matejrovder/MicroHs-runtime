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

export type CombDef = {
    arity: number,
    fn: (a: SKI[]) => SKI
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
            return combKConst
        }
        else {
            return app(combKConst, combIConst)
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

// const combMap: Map<string, CombDef> = new Map([
//     ["S", {
//         'arity': 3, 'fn': (a) => {
//             const x = makePointer(a[2])
//             return app(app(a[0], x), app(a[1], x))
//         }
//     }],
//     ["K", { 'arity': 2, 'fn': (a) => a[0] }],
//     ["I", { 'arity': 1, 'fn': (a) => a[0] }],
//     ["Y", { 'arity': 1, 'fn': (a) => app(a[0], app(combinator("Y"), a[0])) }],
//     // ["B", { 'arity': 3, 'fn': (a) => app(a[0], app(a[1], a[2])) }],
//     // ["C", { 'arity': 3, 'fn': (a) => app(app(a[0], a[2]), a[1]) }]
// ])
// TODO: this is very slow, optimize for example by returning pointer from combinator(name)

export const combS: CombDef = {
        'arity': 3, 'fn': (a) => {
            const x = makePointer(a[2])
            return app(app(a[0], x), app(a[1], x))
        }
    }
export const combK: CombDef = { 'arity': 2, 'fn': (a) => a[0] }
export const combI: CombDef = { 'arity': 1, 'fn': (a) => a[0] }
export const combY: CombDef = { 'arity': 1, 'fn': (a) => app(a[0], app(combYConst, a[0])) }

export const combSConst: Const = { "type": "const", "ctype": "comb", "name": "S", "combObj": combS }
export const combKConst: Const = { "type": "const", "ctype": "comb", "name": "K", "combObj": combK }
export const combIConst: Const = { "type": "const", "ctype": "comb", "name": "I", "combObj": combI }
export const combYConst: Const = { "type": "const", "ctype": "comb", "name": "Y", "combObj": combY }

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
                    top = app(x, app(combYConst, x))
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
        if (top.ctype === 'comb' && top.combObj !== undefined) {
            const comb = top.combObj
            if (lhs_stack.length < comb.arity) {
                loopAgain = false
            }
            else {
                const args: SKI[] = []
                for (let i = 0; i < comb.arity; i++) {
                    args.push(lhs_stack.pop()!.rhs)
                }
                top = comb.fn(args)
            }
        } else {
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
                }
            }
            else
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
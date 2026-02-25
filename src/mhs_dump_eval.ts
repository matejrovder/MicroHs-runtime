import { SKI, LT, Pointer, PointedTo, Var, App, Abs, Const, variable, combinator, app, expStr, makeAbstraction, compileSKI, intConst, strConst, Comb, funcref } from './ast'

export function makePointer(node: SKI): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: PointedTo = { 'type': 'pointedto', 'evaluated': false, term: node }
    return { 'type': "ptr", 'value': pointedTo }
}

type FuncDef = {
    arity: number,
    strict: boolean, // whether function needs all arguments evaluated before call
    fn: (...params: SKI[]) => SKI
}

function arithmetic(x: SKI, y: SKI, fn: (p1: number, p2: number) => number): SKI {
    if ((x.type === 'const' && x.ctype === 'int') && (y.type === 'const' && y.ctype === 'int')) {
        return intConst(fn(x.value, y.value))
    }
    throw new Error("invalid types for arithmetic operation, try evaluating arguments first")
}

function printFunction(x: SKI): SKI {
    console.log("OUTPUT: " + evalExpStr(x) + "\n")

    return strConst("print")
}

function comparison(x: SKI, y: SKI, cmp: (p1: number, p2: number) => boolean): SKI {
    if ((x.type === 'const' && x.ctype === 'int') && (y.type === 'const' && y.ctype === 'int')) {
        if (cmp(x.value, y.value)) {
            return combinator("K")
        }
        else {
            return app(combinator("K"), combinator("I"))
        }
    }
    throw new Error("invalid types for arithmetic operation, try evaluating arguments first")
}



export class Evaluator {
    pointers: Map<string, Pointer>

    constructor(pointers: Map<string, Pointer> = new Map()) {
        this.pointers = pointers
    }

    functionMap: Map<string, FuncDef> = new Map([
        ["+", { 'arity': 2, 'strict': true, 'fn': (x, y) => arithmetic(x, y, (p1, p2) => p1 + p2) }],
        ["-", { 'arity': 2, 'strict': true, 'fn': (x, y) => arithmetic(x, y, (p1, p2) => p1 - p2) }],
        ["*", { 'arity': 2, 'strict': true, 'fn': (x, y) => arithmetic(x, y, (p1, p2) => p1 * p2) }],
        ["=", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 == p2) }],
        ["==", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 == p2) }],
        ["/=", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 != p2) }],
        ["<=", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 <= p2) }],
        ["<", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 < p2) }],
        [">=", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 >= p2) }],
        [">", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 > p2) }],
        ["u==", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 == p2) }],
        ["u<=", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 <= p2) }],
        ["u<", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 < p2) }],
        ["u>=", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 >= p2) }],
        ["u>", { 'arity': 2, 'strict': true, 'fn': (x, y) => comparison(x, y, (p1, p2) => p1 > p2) }],
        ["print", { 'arity': 1, 'strict': true, 'fn': (x) => printFunction(x) }],
        ["double", { 'arity': 1, 'strict': true, 'fn': (x) => arithmetic(x, intConst(2), (p1, p2) => p1 * p2) }],
        ["Data.Eq.==", { 'arity': 5, 'strict': false, 'fn': (_, x, y, f, t) => this.data_eq_eq(_, x, y, f, t) }],
        ["IO.>>", { 'arity': 2, 'strict': false, 'fn': (x, y) => { this.evaluate(x); this.evaluate(y); return strConst("IO.>> executed") } }],
    ])

    data_eq_eq(_: SKI, x: SKI, y: SKI, f: SKI, t: SKI): SKI {
        x = this.evaluate(x)
        y = this.evaluate(y)

        if ((x.type === 'const' && x.ctype === 'int') && (y.type === 'const' && y.ctype === 'int')) {
            if (x.value === y.value)
                return t
            else
                return f
        }
        throw new Error("invalid types for arithmetic operation, try evaluating arguments first")
    }

    unwrapPointer(top: SKI, lhs_stack: App[]): SKI {
        while (true) {
            switch (top.type) {
                case 'ptr':
                    if (!top.value.evaluated) {
                        top.value.term = this.evaluate(top.value.term)
                        top.value.evaluated = true
                    }

                    top = top.value.term
                    break;
                case 'app':
                    lhs_stack.push(top)
                    top = top.lhs
                    break;
                case 'const': {
                    if (top.ctype === "funcref" && this.functionMap.get(top.name) === undefined) {
                        const found = this.pointers.get(top.name)
                        if (found === undefined)
                            throw new Error("Invalid shared expr name: " + top.name)
                        top = found
                        break
                    }
                    else
                        return top
                }
                default:
                    return top
            }
        }
    }

    // TODO: try to optimize using pointer reversal
    evaluate(node: SKI): SKI {
        const lhs_stack: App[] = []

        let top = node

        top = this.unwrapPointer(top, lhs_stack)

        let loopAgain = true
        while (loopAgain && top.type === 'const' && (top.ctype === 'comb' || top.ctype === 'funcref')) {
            if (top.ctype === 'comb') {
                [top, loopAgain] = evalCombExpr(top, lhs_stack)
            }
            else if (top.ctype === 'funcref') {
                const func = this.functionMap.get(top.name)
                if (func !== undefined) {
                    if (lhs_stack.length < func.arity) {
                        loopAgain = false;
                        // output will be the curried function
                    }
                    else {
                        const args: SKI[] = []
                        if (func.strict)
                            for (let i = 0; i < func.arity; i++) {
                                args.push(this.evaluate(lhs_stack.pop()!.rhs))
                            }
                        else
                            for (let i = 0; i < func.arity; i++) {
                                args.push(lhs_stack.pop()!.rhs)
                            }

                        top = func.fn(...args)
                    }
                }
                else
                    throw new Error("unknown function " + top.name)
            }
            else break
            top = this.unwrapPointer(top, lhs_stack)
        }

        while (lhs_stack.length > 0) {
            // const rhs = evaluate(lhs_stack.pop()!.rhs)
            const rhs = lhs_stack.pop()!.rhs // not evaluating here, to keep lazy eval
            top = app(top, rhs)
        }
        return top;
    }
}


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
        case "Data.Integer_Type._intToInteger":
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
        case "IO.>>=":
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
        case "B*": // not used by MicroHs
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
        case "B'":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs
                const w = lhs_stack.pop()!.rhs

                return [app(app(x, y), app(z, w)), true]
            }
        case "Data.Num.fromInteger":
        case "A":
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                lhs_stack.pop() // x
                const y = lhs_stack.pop()!.rhs
                return [y, true]
            }
        case "U":
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                return [app(y, x), true]
            }
        case "Z":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                lhs_stack.pop() // z

                return [app(x, y), true]
            }
        case "P":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs

                return [app(app(z, x), y), true]
            }
        case "R":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs

                return [app(app(y, z), x), true]
            }
        case "O":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                lhs_stack.pop() // z
                const w = lhs_stack.pop()!.rhs

                return [app(app(w, x), y), true]
            }
        case "K2":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                lhs_stack.pop() // z

                return [x, true]
            }
        case "K3":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                lhs_stack.pop() // z
                lhs_stack.pop() // w

                return [x, true]
            }
        case "K4":
            if (lhs_stack.length < 5) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                lhs_stack.pop() // z
                lhs_stack.pop() // w
                lhs_stack.pop() // v

                return [x, true]
            }
        case "C'B":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs
                const w = lhs_stack.pop()!.rhs

                return [app(app(x, z), app(y, w)), true]
            }
        case "IO.>>":
            // IO.>> x y = IO.>>= x (K y)
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs

                return [app(app(combinator("IO.>>="), x), app(combinator("K"), y)), true]
            }
        case "System.IO.Base.print":
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                lhs_stack.pop()
                const x = lhs_stack.pop()!.rhs

                return [app(funcref("print"), x), true]
            }
        default:
            throw new Error("cannot evaluate combinator: " + top.name)
    }
}


export function evalExpStr(term: SKI): string {
    switch (term.type) {
        case "numref":
            return "_" + term.value
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
                        if (term.value.length > 20)
                            return "string"
                        return "string \"" + term.value + "\""
                    // return term.value;
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

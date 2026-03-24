import { GraphN, Pointer, PointedTo, App, combinator, app, intConst, strConst, Comb, Arr, mkString, FuncRef } from './types'

export function makePointer(node: GraphN): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: PointedTo = { 'type': 'pointedto', 'evaluated': false, term: node }
    return { 'type': "ptr", 'value': pointedTo }
}

function arithmetic(x: GraphN, y: GraphN, fn: (p1: number, p2: number) => number): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        return intConst(fn(x.value, y.value))
    }
    throw new Error("invalid types for arithmetic operation, try evaluating arguments first " + x.type + y.type)
}

function arithmeticC(fn: (p1: number, p2: number) => number): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => arithmetic(x, y, fn)
}

function printFunction(x: GraphN): GraphN {
    console.log("OUTPUT: " + evalExpStr(x) + "\n")

    return strConst("print")
}

function comparison(x: GraphN, y: GraphN, cmp: (p1: number, p2: number) => boolean): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        if (cmp(x.value, y.value)) {
            // true and false values are flipped???
            // TODO: lambda needs a special evaluator now
            return combinator("A")
        }
        else {
            return combinator("K")
        }
    }
    throw new Error("invalid types for arithmetic operation, try evaluating arguments first")
}

function comparisonC(cmp: (p1: number, p2: number) => boolean): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => comparison(x, y, cmp)
}

function compare(x: GraphN, y: GraphN): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        if (x.value < y.value) return app(combinator("Z"), combinator("K"))
        else if (x.value > y.value) return app(combinator("K"), combinator("A"))
        else return (combinator("K"), combinator("K"))
    }
    throw new Error("invalid types for arithmetic operation, try evaluating arguments first")
}

function putCharFromInt(x: GraphN): GraphN {
    if (x.type === 'int') {
        process.stdout.write(String.fromCodePoint(x.value))
        return strConst("putChar")
    }
    else
        throw new Error("invalid node type")
}

function isNamed(x: GraphN, name: string): boolean {
    return (x.type === 'comb' || x.type === 'funcref') && x.name === name
}

export class Evaluator {
    pointers: Map<number, Pointer>

    constructor(pointers: Map<number, Pointer> = new Map()) {
        this.pointers = pointers
    }

    performIO(x: GraphN): GraphN {
        x = this.execio(x)
        if (x.type !== 'app' || !isNamed(this.indir(x.lhs), "IO.return"))
            throw new Error("wrong performio")
        return x.rhs
    }

    indir(top: GraphN): GraphN {
        /**@brief follows indirection */
        switch (top.type) {
            case 'ptr':
                if (!top.value.evaluated) {
                    top.value.term = this.evaluate(top.value.term)
                    top.value.evaluated = true
                }

                return top.value.term
                break;
            case 'numref': {
                const ref = this.pointers.get(top.value)
                if (ref == undefined)
                    throw new Error("Invalid shared expression reference: _" + top.value)
                else
                    return ref
                break;
            }
            default:
                return top
        }
    }

    execio(node: GraphN): GraphN {
        let top = node
        const cont: GraphN[] = [] // continuation of execio

        while (true) {
            // label start in mhs code
            const whnf = this.evaluate(top)

            const bindMatch = this.match2("IO.>>=", whnf)
            if (bindMatch) {
                const [r, s] = bindMatch
                top = r
                cont.push(s)
                continue
            }

            const thenMatch = this.match2("IO.>>", whnf)
            if (thenMatch) {
                const [r, s] = thenMatch
                top = r
                cont.push(app(combinator("K"), s))
                continue
            }

            const prim = this.execPrimitiveIO(whnf)
            // label rest in mhs code
            if (cont.length === 0) {
                return app(combinator("IO.return"), prim)
            }
            else {
                const r = cont.pop()!
                top = app(r, prim)
                continue
            }
        }
    }

    execPrimitiveIO(top: GraphN): GraphN {
        // label execute in mhs code
        const lhs_stack: App[] = []

        while (true) {
            switch (top.type) {
                case "app":
                    lhs_stack.push(top)
                    top = top.lhs
                    break
                case "ptr":
                    // TODO: we need writeback for this
                    top = top.value.term
                    break
                case "numref": {
                    const ref = this.pointers.get(top.value)
                    if (ref == undefined)
                        throw new Error("Invalid shared expression reference: _" + top.value)
                    else
                        top = ref
                    break;
                }
                case "comb":
                case "funcref":
                    switch (top.name) {
                        case "IO.print": {
                            if (lhs_stack.length < 2)
                                throw new Error(top.name + " arguments missing")

                            lhs_stack.pop() // handle/stream
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            console.log(evalExpStr(x))
                            return combinator("I")
                        }
                        case "IO.return": {
                            if (lhs_stack.length < 1)
                                throw new Error(top.name + " arguments missing")

                            return lhs_stack.pop()!.rhs
                        }
                        case "A.alloc": {
                            if (lhs_stack.length < 2)
                                throw new Error(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            const y = makePointer(lhs_stack.pop()!.rhs)

                            if (x.type === 'int' && x.value > 0) {
                                const arr = []
                                for (let i = 0; i < x.value; i++) {
                                    arr.push(y)
                                }
                                const arrNode: Arr = { 'type': 'arr', 'array': arr }
                                return arrNode
                            }
                            throw new Error("invalid array size")
                        }
                        case "A.read": {
                            if (lhs_stack.length < 2)
                                throw new Error(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            const y = this.evaluate(lhs_stack.pop()!.rhs)

                            if (x.type !== 'arr')
                                throw new Error("A.read: invalid array")
                            if (y.type !== 'int' || y.value < 0 || y.value >= x.array.length)
                                throw new Error("Invalid array index")
                            return x.array[y.value]
                        }
                        case "putb": {
                            if (lhs_stack.length < 2)
                                throw new Error(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            lhs_stack.pop() // output stream/handle

                            putCharFromInt(x)
                            return combinator("I")
                        }
                        default:
                            throw new Error("Unknown IO function: " + top.name)
                    }
                    break
                default:
                    throw new Error("cannot execute IO, invalid node type: " + top.type)
            }
        }
    }

    // TODO: try to optimize using pointer reversal
    evaluate(node: GraphN, writeback: PointedTo | null = null): GraphN {
        const lhs_stack: App[] = []
        let top = node
        let loopAgain = true

        while (loopAgain) {
            switch (top.type) {
                case 'app':
                    lhs_stack.push(top)
                    top = top.lhs
                    break;
                case 'ptr':
                    if (!top.value.evaluated) {
                        top.value.term = this.evaluate(top.value.term, top.value)
                        top.value.evaluated = true
                    }

                    top = top.value.term
                    break;
                case 'numref': {
                    const ref = this.pointers.get(top.value)
                    if (ref == undefined)
                        throw new Error("Invalid shared expression reference: _" + top.value)
                    else
                        top = ref
                    break;
                }
                case "comb":
                    [top, loopAgain] = evalCombExpr(top, lhs_stack)
                    break
                case "funcref":
                    [top, loopAgain] = this.evalFuncExpr(top, lhs_stack)
                    break
                default:
                    loopAgain = false
            }
            // TODO: this is where we want to replace all occurences of this node in the graph with the evaluated node
            if (lhs_stack.length > 0)
                lhs_stack[lhs_stack.length - 1].lhs = top
            if (writeback !== null) {
                writeback.term = lhs_stack[0] ?? top
            }
        }

        while (lhs_stack.length > 0) {
            // const rhs = evaluate(lhs_stack.pop()!.rhs) 
            const rhs = lhs_stack.pop()!.rhs // not evaluating here, to keep lazy eval
            top = app(top, rhs)
        }

        if (top.type === 'ptr' || top.type === 'numref')
            throw new Error("invalid eval") // sanity check

        return top;
    }

    match2(combName: string, node: GraphN): [GraphN, GraphN] | null {
        /**
         * @brief matches node to expression: combName x y
         */
        if (node.type !== 'app')
            return null

        const lhs = this.indir(node.lhs)
        if (lhs.type !== 'app')
            return null

        const head = this.indir(lhs.lhs)
        if (!isNamed(head, combName))
            return null

        return [lhs.rhs, node.rhs]
    }

    match1(combName: string, node: GraphN): GraphN | null {
        /**
         * @brief matches node to expression: combName x
         */
        if (node.type !== 'app')
            return null

        const lhs = this.indir(node.lhs)
        if (!isNamed(lhs, combName))
            return null

        return node.rhs
    }

    performStrictFunc2(top: FuncRef, lhs_stack: App[], func: (x: GraphN, y: GraphN) => GraphN): [GraphN, boolean] {
        if (lhs_stack.length < 2)
            return [top, false]

        const x = this.evaluate(lhs_stack.pop()!.rhs)
        const y = this.evaluate(lhs_stack.pop()!.rhs)

        const res = func(x, y)
        return [res, true]
    }

    evalFuncExpr(top: FuncRef, lhs_stack: App[]): [GraphN, boolean] {
        switch (top.name) {
            case "IO.>>":
            case "IO.>>=":
            case "IO.return":
            case "IO.print":
            case "A.alloc":
            case "A.read":
            case "putb":
            case "IO.stdout":
                return [top, false]
            case "+":
            case "u+":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 + p2))
            case "-":
            case "u-":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 - p2))
            case "*":
            case "u*":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 * p2))
            case "quot":
            case "uquot":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 / p2 | 0))
            case "rem":
            case "urem":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 % p2))
            case "=": // for lambda calculus
            case "==":
            case "u==":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 == p2))
            case "/=":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 != p2))
            case "<=":
            case "u<=":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 <= p2))
            case "<":
            case "u<":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 < p2))
            case ">=":
            case "u>=":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 >= p2))
            case ">":
            case "u>":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 > p2))
            case "cmp":
            case "ucmp":
                return this.performStrictFunc2(top, lhs_stack, compare)
            case "and":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 & p2))
            case "or":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 | p2))
            case "shr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 >>> p2))
            case "ashr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 >> p2))
            case "shl":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 << p2))
            case "inv": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [arithmetic(intConst(0), x, (p1, p2) => ~p2), true]
            }
            case "neg":
            case "uneg": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [arithmetic(intConst(0), x, (p1, p2) => p1 - p2), true]
            }
            // case "raise": {
            //     if (lhs_stack.length < 1) return [top, false]
            //     const x = this.evaluate(lhs_stack.pop()!.rhs)
            //     console.log("raised error: " + evalExpStr(x))
            //     return [strConst("raise"), true]
            // }
            case "IO.performIO": {
                if (lhs_stack.length < 1) return [top, false]
                const x = lhs_stack.pop()!.rhs
                return [this.performIO(x), true]
            }
            case "seq": {
                if (lhs_stack.length < 2) return [top, false]
                this.evaluate(lhs_stack.pop()!.rhs) // evaluate x
                const y = lhs_stack.pop()!.rhs
                return [y, true]
            }
            case "fromUTF8": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                if (x.type === "str") return [mkString(x.value), true]
                throw Error("invalid string for fromUTF8")
            }
            default:
                throw new Error("unknown function " + top.name)
        }
    }
}

function evalCombExpr(top: Comb, lhs_stack: App[]): [GraphN, boolean] {
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
        case "ord":
        case "chr":
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
        default:
            return [top, false]
    }
}


export function evalExpStr(term: GraphN): string {
    switch (term.type) {
        case "numref":
            return "_" + term.value
        case "ptr": {
            const evaluated = term.value.evaluated ? "T" : "F"
            return "ptr,e=" + evaluated + "( " + evalExpStr(term.value.term) + " )"
        }
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
        case "arr": {
            let res = "array, size=" + term.array.length + " ["
            for (let i = 0; i < term.array.length && i < 5; i++) {
                res += evalExpStr(term.array[i]) + ", "
            }
            return res + "] "
        }
        case "app":
            {
                return " ( " + evalExpStr(term.lhs) + " " + evalExpStr(term.rhs) + " ) ";
            }
        default:
            throw new Error("invalid lambda term type");
    }
}

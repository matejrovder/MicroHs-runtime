import { EvaluationError, ProgramRaisedError } from '../errors';
import { GraphN, Pointer, PointedTo, App, combinator, app, intConst, strConst, Comb, Arr, mkString, FuncRef }
    from '../types'

export function makePointer(node: GraphN): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: PointedTo = { 'type': 'pointedto', 'evaluated': false, term: node }
    return { 'type': "ptr", 'value': pointedTo }
}

function arithmetic(x: GraphN, y: GraphN, fn: (p1: bigint, p2: bigint) => bigint): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        return intConst(fn(x.value, y.value))
    }
    throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first "
        + x.type + y.type)
}

function arithmeticC(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => arithmetic(x, y, fn)
}

function arithmeticCU(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => arithmetic(x, y, (x, y) => BigInt.asUintN(64, fn(x, y)))
}

function arithmeticCI(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => arithmetic(x, y, (x, y) => BigInt.asIntN(64, fn(x, y)))
}

function comparison(x: GraphN, y: GraphN, cmp: (p1: bigint, p2: bigint) => boolean): GraphN {
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
    throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first")
}

function comparisonC(cmp: (p1: bigint, p2: bigint) => boolean): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => comparison(x, y, cmp)
}

function threeWayCompare(x: GraphN, y: GraphN): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        if (x.value < y.value) return app(combinator("Z"), combinator("K"))
        else if (x.value > y.value) return app(combinator("K"), combinator("A"))
        else return (combinator("K"), combinator("K"))
    }
    throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first")
}

// function ucompare(x: GraphN, y: GraphN): GraphN {
//     if (x.type === 'int' && y.type === 'int') {
//         const xu = x.value >>> 0, yu =  y.value >>> 0
//         if (xu < yu) return app(combinator("Z"), combinator("K"))
//         else if (xu > yu) return app(combinator("K"), combinator("A"))
//         else return (combinator("K"), combinator("K"))
//     }
//     throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first")
// }

function isNamed(x: GraphN, name: string): boolean {
    return (x.type === 'comb' || x.type === 'funcref') && x.name === name
}

export interface Output {
    print(str: string): void
    println(str: string): void
}

export interface Input {
    getChar(): string
}

/**
 * The class for running the parsed program
 *
 * @param {Output} output - object implementing the Output interface, used for print, putChar, etc.
 * @param {Input} input - object implementing the Input interface, used for getLine, etc.
 * @param {Map<bigint, Pointer>} pointers - the map of numbered shared expressions
 */
export class Evaluator {
    pointers: Map<bigint, Pointer>
    output: Output
    input: Input

    constructor(output: Output, input: Input, pointers: Map<bigint, Pointer> = new Map()) {
        this.pointers = pointers
        this.output = output
        this.input = input
    }

    private performIO(x: GraphN): GraphN {
        x = this.execio(x)
        if (x.type !== 'app' || !isNamed(this.indir(x.lhs), "IO.return"))
            throw new EvaluationError("wrong performio")
        return x.rhs
    }

    private putCharFromInt(x: GraphN): GraphN {
        if (x.type === 'int') {
            console.error("putb " + x.value)
            this.output.print(String.fromCodePoint(Number(x.value)))
            return strConst("putChar")
        }
        else
            throw new EvaluationError("invalid node type")
    }

    private indir(top: GraphN): GraphN {
        /**@brief follows indirection */
        switch (top.type) {
            case 'ptr':
                if (!top.value.evaluated) {
                    top.value.term = this.evaluate(top.value.term, top.value)
                    top.value.evaluated = true
                }

                return top.value.term
                break;
            case 'numref': {
                const ref = this.pointers.get(top.value)
                if (ref == undefined)
                    throw new EvaluationError("Invalid shared expression reference: _" + top.value)
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
            console.error("execio eval " + this.evalExpStr(top, 7))
            const whnf = this.evaluate(top)
            console.error("execio whnf " + this.evalExpStr(whnf, 7))

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

    /**
     * Executes IO primitive operations. Corresponds to the 'execute'
     * label in MicroHs execio code.
     */
    private execPrimitiveIO(top: GraphN): GraphN {
        const lhs_stack: App[] = []

        while (true) {
            switch (top.type) {
                case "app":
                    lhs_stack.push(top)
                    top = top.lhs
                    break
                case "ptr":
                    top = top.value.term
                    break
                case "numref": {
                    const ref = this.pointers.get(top.value)
                    if (ref == undefined)
                        throw new EvaluationError("Invalid shared expression reference: _" + top.value)
                    else
                        top = ref
                    break;
                }
                case "comb":
                case "funcref":
                    switch (top.name) {
                        case "IO.print": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationError(top.name + " arguments missing")

                            lhs_stack.pop() // output stream/handle
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            this.output.println(evalExpStr(x))
                            return combinator("I")
                        }
                        case "IO.return": {
                            if (lhs_stack.length < 1)
                                throw new EvaluationError(top.name + " arguments missing")

                            return lhs_stack.pop()!.rhs
                        }
                        case "A.alloc": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationError(top.name + " arguments missing")
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
                            throw new EvaluationError("invalid array size")
                        }
                        case "A.read": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationError(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            const y = this.evaluate(lhs_stack.pop()!.rhs)

                            if (x.type !== 'arr')
                                throw new EvaluationError("A.read: invalid array")
                            if (y.type !== 'int' || y.value < 0 || y.value >= x.array.length)
                                throw new EvaluationError("Invalid array index")
                            return x.array[Number(y.value)]
                        }
                        case "putb": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationError(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            lhs_stack.pop() // output stream/handle

                            this.putCharFromInt(x)
                            return combinator("I")
                        }
                        case "getb": {
                            if (lhs_stack.length < 1)
                                throw new EvaluationError(top.name + " arguments missing")
                            lhs_stack.pop() // input stream/handle

                            return intConst(BigInt(this.input.getChar().codePointAt(0)!))
                        }
                        default:
                            throw new EvaluationError("Unknown IO function: " + top.name)
                    }
                    break
                default:
                    throw new EvaluationError("cannot execute IO, invalid node type: " + top.type)
            }
        }
    }

    // TODO: make private - to hide writeback arg
    /**
     * Evaluates the expression to WHNF.
     * @param node - the expression to evaluate
     * @param {PointedTo} writeback - optional, will be updated with the current state
     *                                of the expression after each reduction step
     * @returns evaluated expression in WHNF
     */
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
                        throw new EvaluationError("Invalid shared expression reference: _" + top.value)
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

            // this is where we replace all occurences of this node in the graph with the evaluated node
            if (writeback !== null) {
                if (lhs_stack.length > 0)
                    // as we are deliberately changing other occurences of the expression, we can break immutability
                    lhs_stack[lhs_stack.length - 1].lhs = top
                writeback.term = lhs_stack[0] ?? top
            }
        }

        while (lhs_stack.length > 0) {
            // const rhs = evaluate(lhs_stack.pop()!.rhs) 
            const rhs = lhs_stack.pop()!.rhs // not evaluating here, to keep lazy eval
            top = app(top, rhs)
        }

        if (top.type === 'ptr' || top.type === 'numref')
            throw new EvaluationError("invalid eval") // sanity check

        return top;
    }

    /**
     * Matches node to expression: combName x y
     * @returns tuple [x, y] if match is found, else null
     */
    match2(combName: string, node: GraphN): [GraphN, GraphN] | null {
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

    /**
     * Matches node to expression: combName x
     * @returns x if match is found, else null
     */
    match1(combName: string, node: GraphN): GraphN | null {
        if (node.type !== 'app')
            return null

        const lhs = this.indir(node.lhs)
        if (!isNamed(lhs, combName))
            return null

        return node.rhs
    }

    /**
     * Performs a strict function of 2 arguments. 
     * Gets 2 arguments from stack, evaluates them, calls the function and returns result.
     * 
     * @returns a tuple of the result of the function and true boolean, unless there aren't
     *          enough arguments on the stack
     */
    private performStrictFunc2(top: FuncRef, lhs_stack: App[], func: (x: GraphN, y: GraphN) => GraphN):
        [GraphN, boolean] {
        if (lhs_stack.length < 2)
            return [top, false]

        const x = this.evaluate(lhs_stack.pop()!.rhs)
        const y = this.evaluate(lhs_stack.pop()!.rhs)

        const res = func(x, y)
        return [res, true]
    }

    /**
     * Calls the function referenced by top with arguments from the stack
     * @returns the result of the function and true if the function was called, 
     *          else top and false if not enough arguments available or the
     *          function is an IO function
     * @throws {EvaluationError} Unknown function name
     */
    private evalFuncExpr(top: FuncRef, lhs_stack: App[]): [GraphN, boolean] {
        switch (top.name) {
            case "IO.return":
            case "IO.print":
            case "A.alloc":
            case "A.read":
            case "putb":
            case "getb":
            case "IO.stdout":
            case "IO.stdin":
                return [top, false]
            case "equal":
            case "sequal": {
                // TODO: terrible hack
                if (lhs_stack.length < 2) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                const y = this.evaluate(lhs_stack.pop()!.rhs)
                return [(evalExpStr(x) === evalExpStr(y)) ? combinator("A") : combinator("K"), true]
            }
            case "+":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCI((p1, p2) => p1 + p2))
            case "u+":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 + p2))
            case "-":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCI((p1, p2) => p1 - p2))
            case "u-":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 - p2))
            case "*":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCI((p1, p2) => p1 * p2))
            case "u*":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 * p2))
            case "quot":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCI((p1, p2) => p1 / p2))
            case "uquot":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 / p2))
            case "rem":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCI((p1, p2) => p1 % p2))
            case "urem":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 % p2))
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
                return this.performStrictFunc2(top, lhs_stack, threeWayCompare)
            case "and":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 & p2))
            case "or":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 | p2))
            case "shr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) =>
                    BigInt.asUintN(64, p1) >> BigInt.asUintN(64, p2)))
            case "ashr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => BigInt.asIntN(64, p1) >> p2))
            case "shl":
                return this.performStrictFunc2(top, lhs_stack, arithmeticCU((p1, p2) => p1 << p2))
            case "inv": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [arithmetic(intConst(0n), x, (p1, p2) => BigInt.asUintN(64, ~p2)), true]
            }
            case "neg": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [arithmetic(intConst(0n), x, (p1, p2) => BigInt.asIntN(64, p1 - p2)), true]
            }
            case "uneg": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [arithmetic(intConst(0n), x, (p1, p2) => BigInt.asUintN(64, p1 - p2)), true]
            }
            case "raise": {
                if (lhs_stack.length < 1) return [top, false]
                const ex = lhs_stack.pop()!.rhs
                const combShowExn = app(combinator("U"), app(combinator("U"), app(combinator("K2"), combinator("A"))))
                const x = this.consToString(this.evaluate(app(combShowExn, ex)))
                // MicroHs magic

                throw new ProgramRaisedError(x)
            }
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
                throw new EvaluationError("unknown function " + top.name)
        }
    }

    /**
     * Converts a cons string to a JavaScript string.
     * example: (Cons "a" (Cons "b" (Cons "c" Nil))) -> "abc"
     * 
     * where Cons is the O combinator and Nil is the K combinator
     */
    private consToString(node: GraphN): string {
        let res = ""
        while (true) {
            node = this.evaluate(node)
            if (isNamed(node, "K"))
                return res
            const match = this.match2("O", node)
            if (match === null)
                break
            const [cc, next] = match
            const c = this.evaluate(cc)
            if (c.type !== 'int')
                throw new EvaluationError("invalid char")
            if (c.value > 0x80)
                res += "?"
            else
                res += String.fromCharCode(Number(c.value))
            node = next
        }

        throw new EvaluationError("invalid cons string")
    }


    evalExpStr(term: GraphN, depth: number): string {
        if (depth <= 0)
            return ">...<"
        switch (term.type) {
            case "numref":
                return "_" + term.value + this.evalExpStr(this.pointers.get(term.value)!, depth - 1)
            case "ptr": {
                const evaluated = term.value.evaluated ? "T" : "F"
                return "ptr,e=" + evaluated + "( " + this.evalExpStr(term.value.term, depth - 1) + " )"
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
            case "app":
                {
                    return " ( " + this.evalExpStr(term.lhs, depth - 1) + " " +
                        this.evalExpStr(term.rhs, depth - 1) + " ) ";
                }
            case "arr":
                if (term.array.length > 5)
                    return "[...]"
                else {
                    let res = "[ "
                    term.array.forEach(x => { res = res += this.evalExpStr(x, depth - 1) + ", " })
                    res += " ]"
                    return res
                }
            default:
                throw new Error("invalid lambda term type");
        }
    }

}

/**
 * Performs the reduction with the combinator on top and arguments from the stack
 * @returns the result of the reduction and true if the reduction was performed, 
 *          else top and false if not enough arguments available or the
 *          combinator is an IO monad
 * @throws {EvaluationError} Unknown combinator name
 */
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
        case "IO.>>":
        case "IO.>>=":
        case "IO.return":
            return [top, false]
        default:
            throw new EvaluationError("unknown function " + top.name)
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
            // if (term.value.length > 20)
            // return "string"
            return "string \"" + term.value + "\""
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

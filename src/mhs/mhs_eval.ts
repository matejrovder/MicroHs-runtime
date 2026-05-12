import {EvaluationException, ProgramRaisedException} from '../exceptions';
import {
    App, app, Arr, Comb, combinator, FuncRef, GraphN, intConst, stringToCons, Pointer, strConst,
    npapp, Nodeptr, npappptr
} from '../types'
import {
    arithmeticI, arithmeticU, comparison, equalTerms, isNamed, performArithmetic,
    threeWayCompareI, threeWayCompareU
} from "./eval_aux";

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
 */
export class Evaluator {
    output: Output
    input: Input

    constructor(output: Output, input: Input) {
        this.output = output
        this.input = input
    }

    /**
     * Performs (unsafe) IO during evaluation. Counterpart of Haskell's unsafePerformIO.
     */
    private performIO(x: GraphN): GraphN {
        x = this.execio({n: x})
        if (x.type !== 'app' || !isNamed(this.unwrapPtr(x.lhs.n), "IO.return"))
            throw new EvaluationException("wrong performio")
        return x.rhs.n
    }

    /**
     * Puts a character with ASCII code from argument to output stream.
     */
    private putCharFromInt(x: GraphN): void {
        if (x.type === 'int') {
            this.output.print(String.fromCodePoint(Number(x.value)))
        }
        else
            throw new EvaluationException("invalid node type")
    }

// TODO: remove
    private unwrapPtr(top: GraphN): GraphN {
        switch (top.type) {
            // case 'ptr':
            //     if (!top.value.evaluated) {
            //         top.value.n = this.evaluate(top.value.n, top.value)
            //         top.value.evaluated = true
            //     }

            //     return top.value.n
            //     break;
            // case 'numref': {
            //     const ref = this.pointers.get(top.value)
            //     if (ref == undefined)
            //         throw new EvaluationException("Invalid shared expression reference: _" + top.value)
            //     else
            //         return ref
            //     break;
            // }
            case 'ptr':
                throw new EvaluationException("unwrap")
            default:
                return top
        }
    }

    /**
     * Executes Haskell/MicroHs monad IO. Corresponds to older MicroHs versions'
     * execio function.
     */
    execio(node: Nodeptr): GraphN {
        const top = node
        const cont: GraphN[] = [] // continuation of execio

        while (true) {
            // label start in mhs code
            const whnf = this.evaluate(top)

            const bindMatch = this.match2("IO.>>=", whnf)
            if (bindMatch) {
                const [r, s] = bindMatch
                top.n = r
                cont.push(s)
                continue
            }

            const thenMatch = this.match2("IO.>>", whnf)
            if (thenMatch) {
                const [r, s] = thenMatch
                top.n = r
                cont.push(app(combinator("K"), s))
                continue
            }

            const prim = this.execPrimitiveIO({n: whnf})
            // label rest in mhs code
            if (cont.length === 0) {
                return app(combinator("IO.return"), prim)
            }
            else {
                const r = cont.pop()!
                top.n = app(r, prim)
                continue
            }
        }
    }

    /**
     * Executes IO primitive operations. Corresponds to the 'execute'
     * label in MicroHs execio code.
     */
    private execPrimitiveIO(np: Nodeptr): GraphN {
        const lhs_stack: App[] = []
        let top: GraphN = np.n

        while (true) {
            switch (top.type) {
                case "app":
                    lhs_stack.push(top)
                    top = top.lhs.n
                    break
                case "ptr":
                    this.evaluate(top.value)

                    top = top.value.n
                    break
                case "comb":
                case "funcref":
                    switch (top.name) {
                        case "IO.print": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationException(top.name + " arguments missing")

                            lhs_stack.pop() // output stream/handle
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            this.output.println(this.reprExpDump(x))
                            return combinator("I")
                        }
                        case "IO.return": {
                            if (lhs_stack.length < 1)
                                throw new EvaluationException(top.name + " arguments missing")

                            return lhs_stack.pop()!.rhs.n
                        }
                        case "A.alloc": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationException(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            const y = lhs_stack.pop()!.rhs

                            if (x.type === 'int' && x.value > 0) {
                                const arr = []
                                for (let i = 0; i < x.value; i++) {
                                    arr.push(y)
                                }
                                const arrNode: Arr = { 'type': 'arr', 'array': arr }
                                return arrNode
                            }
                            throw new EvaluationException("invalid array size")
                        }
                        case "A.read": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationException(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            const y = this.evaluate(lhs_stack.pop()!.rhs)

                            if (x.type !== 'arr')
                                throw new EvaluationException("A.read: invalid array")
                            if (y.type !== 'int' || y.value < 0 || y.value >= x.array.length)
                                throw new EvaluationException("Invalid array index")
                            return x.array[Number(y.value)].n // TODO: return indir here
                        }
                        case "A.size": {
                            if (lhs_stack.length < 1)
                                throw new EvaluationException(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)

                            if (x.type !== 'arr')
                                throw new EvaluationException("A.read: invalid array")
                            return intConst(BigInt(x.array.length))
                        }
                        case "A.write": {
                            if (lhs_stack.length < 3)
                                throw new EvaluationException(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            const y = this.evaluate(lhs_stack.pop()!.rhs)
                            const z = lhs_stack.pop()!.rhs

                            if (x.type !== 'arr')
                                throw new EvaluationException("A.read: invalid array")
                            if (y.type !== 'int' || y.value < 0 || y.value >= x.array.length)
                                throw new EvaluationException("Invalid array index")
                            x.array[Number(y.value)] = z
                            return combinator("I")
                        }
                        case "putb": {
                            if (lhs_stack.length < 2)
                                throw new EvaluationException(top.name + " arguments missing")
                            const x = this.evaluate(lhs_stack.pop()!.rhs)
                            lhs_stack.pop() // output stream/handle

                            this.putCharFromInt(x)
                            return combinator("I")
                        }
                        case "getb": {
                            if (lhs_stack.length < 1)
                                throw new EvaluationException(top.name + " arguments missing")
                            lhs_stack.pop() // input stream/handle

                            return intConst(BigInt(this.input.getChar().codePointAt(0)!))
                        }
                        default:
                            throw new EvaluationException("Unknown IO function: " + top.name)
                    }
                    break
                default:
                    throw new EvaluationException("cannot execute IO, invalid node type: " + top.type)
            }
        }
    }

    /**
     * Evaluates the expression to WHNF.
     * @param node - the expression to evaluate
     * @param {PointedTo} writeback - optional, will be updated with the current state
     *                                of the expression after each reduction step
     *                                (for internal use only)
     * @returns evaluated expression in WHNF
     */
    evaluate(np: Nodeptr): GraphN {
        const lhs_stack: App[] = []
        let top = np.n
        let loopAgain = true

        while (loopAgain) {
            switch (top.type) {
                case 'app':
                    lhs_stack.push(top)
                    top = top.lhs.n
                    break;
                case 'ptr':
                    this.evaluate(top.value)

                    top = top.value.n
                    break;
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
            if (lhs_stack.length >= 1)
                lhs_stack[lhs_stack.length - 1].lhs.n = top
            np.n = lhs_stack[0] ?? top
        }

        // while (lhs_stack.length > 0) {
        //     // const rhs = evaluate(lhs_stack.pop()!.rhs)
        //     const rhs = lhs_stack.pop()!.rhs // not evaluating here, to keep lazy eval
        //     top = app(top, rhs)
        // }

        if (lhs_stack.length > 0)
            top = lhs_stack[0]
        
        np.n = top

        return top;
    }

    /**
     * Matches node to expression: combName x y
     * @returns tuple [x, y] if match is found, else null
     */
    match2(combName: string, node: GraphN): [GraphN, GraphN] | null {
        if (node.type !== 'app')
            return null

        const lhs = this.unwrapPtr(node.lhs.n)
        if (lhs.type !== 'app')
            return null

        const head = this.unwrapPtr(lhs.lhs.n)
        if (!isNamed(head, combName))
            return null

        return [lhs.rhs.n, node.rhs.n]
    }

    /**
     * Matches node to expression: combName x
     * @returns x if match is found, else null
     */
    match1(combName: string, node: GraphN): GraphN | null {
        if (node.type !== 'app')
            return null

        const lhs = this.unwrapPtr(node.lhs.n)
        if (!isNamed(lhs, combName))
            return null

        return node.rhs.n
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
     * @throws {EvaluationException} Unknown function name
     */
    private evalFuncExpr(top: FuncRef, lhs_stack: App[]): [GraphN, boolean] {
        switch (top.name) {
            // case "IO.return":
            case "IO.print":
            case "A.alloc":
            case "A.read":
            case "putb":
            case "getb":
            case "IO.stdout":
            case "IO.stdin":
                // no operation, these are IO ops
                return [top, false]
            case "ord":
            case "chr":
            case "Itoi":
            case "itoI":
            case "utoU":
            case "Utou": {
                //  return the argument unchanged
                if (lhs_stack.length < 1) { return [top, false] }
                else {
                    return [lhs_stack.pop()!.rhs.n, true] //TODO:indir
                }
            }
            case "equal":
            case "sequal": {
                // equality operator used by older MicroHs
                if (lhs_stack.length < 2) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                const y = this.evaluate(lhs_stack.pop()!.rhs)
                return [equalTerms(x, y) ? combinator("A") : combinator("K"), true]
            }
            case "+":
            case "I+":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 + p2))
            case "u+":
            case "Iu+":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 + p2))
            case "-":
            case "I-":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 - p2))
            case "u-":
            case "Iu-":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 - p2))
            case "subtract":
            case "Isubtract":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p2 - p1))
            case "usubtract":
            case "Iusubtract":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p2 - p1))
            case "*":
            case "I*":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 * p2))
            case "u*":
            case "Iu*":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 * p2))
            case "quot":
            case "Iquot":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 / p2))
            case "uquot":
            case "Iuquot":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 / p2))
            case "rem":
            case "Irem":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 % p2))
            case "urem":
            case "Iurem":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 % p2))
            case "=": // for lambda calculus
            case "==":
            case "I==":
            case "u==":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 == p2))
            case "/=":
            case "I/=":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 != p2))
            case "<=":
            case "I<=":
            case "u<=":
            case "Iu<=":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 <= p2))
            case "<":
            case "I<":
            case "u<":
            case "Iu<":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 < p2))
            case ">=":
            case "I>=":
            case "u>=":
            case "Iu>=":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 >= p2))
            case ">":
            case "I>":
            case "u>":
            case "Iu>":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 > p2))
            case "cmp":
            case "icmp":
            case "Iicmp":
                return this.performStrictFunc2(top, lhs_stack, threeWayCompareI)
            case "ucmp":
            case "Iucmp":
                return this.performStrictFunc2(top, lhs_stack, threeWayCompareU)
            case "and":
            case "Iand":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 & p2))
            case "or":
            case "Ior":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 | p2))
            case "xor":
            case "Ixor":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 ^ p2))
            case "shr":
            case "Ishr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) =>
                    BigInt.asUintN(64, p1) >> BigInt.asUintN(64, p2)))
            case "ashr":
            case "Iashr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => BigInt.asIntN(64, p1) >> p2))
            case "shl":
            case "Ishl":
                return this.performStrictFunc2(top, lhs_stack, arithmeticU((p1, p2) => p1 << p2))
            case "inv":
            case "Iinv": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [performArithmetic(intConst(0n), x, (p1, p2) => BigInt.asUintN(64, ~p2)), true]
            }
            case "neg":
            case "Ineg": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [performArithmetic(intConst(0n), x, (p1, p2) => BigInt.asIntN(64, p1 - p2)), true]
            }
            case "uneg":
            case "Iuneg": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [performArithmetic(intConst(0n), x, (p1, p2) => BigInt.asUintN(64, p1 - p2)), true]
            }
            case "raise": {
                if (lhs_stack.length < 1) return [top, false]
                const ex = lhs_stack.pop()!.rhs.n
                // MicroHs magic to evaluate exception message
                const combShowExn = app(combinator("U"), app(combinator("U"), app(combinator("K2"), combinator("A"))))
                const x = this.consToString(this.evaluate({n: app(combShowExn, ex)}))

                throw new ProgramRaisedException(x)
            }
            case "IO.performIO": {
                if (lhs_stack.length < 1) return [top, false]
                const x = lhs_stack.pop()!.rhs
                return [this.performIO(x.n), true]
            }
            case "seq": {
                if (lhs_stack.length < 2) return [top, false]
                this.evaluate(lhs_stack.pop()!.rhs) // evaluate x
                const y = lhs_stack.pop()!.rhs.n
                return [y, true]
            }
            case "fromUTF8": {
                // converts string to Cons-Nil form
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                if (x.type === "str") return [stringToCons(x.value), true]
                throw Error("invalid string for fromUTF8")
            }
            default:
                throw new EvaluationException("unknown function " + top.name)
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
            node = this.evaluate({n: node})
            if (isNamed(node, "K"))
                return res
            const match = this.match2("O", node)
            if (match === null)
                break
            const [cc, next] = match
            const c = this.evaluate({n: cc})
            if (c.type !== 'int')
                throw new EvaluationException("invalid char")
            if (c.value > 0x80)
                res += "?"
            else
                res += String.fromCharCode(Number(c.value))
            node = next
        }

        throw new EvaluationException("invalid cons string")
    }

    /**
     * Returns a string representation of the expression meant for debugging,
     * resolves pointers up to _depth_
     * @param term - expression to dump in to string
     * @param depth - depth to which to resolve pointers
     */
    debugExpDump(term: GraphN, depth: number = 3): string {
        if (depth <= 0)
            return ">...<"
        switch (term.type) {
            case "ptr": {
                return "ptr:" + "( " + this.debugExpDump(term.value.n, depth - 1) + " )"
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
                    return " ( " + this.debugExpDump(term.lhs.n, depth - 1) + " " +
                        this.debugExpDump(term.rhs.n, depth - 1) + " ) ";
                }
            case "arr":
                if (term.array.length > 5)
                    return "[...]"
                else {
                    let res = "[ "
                    term.array.forEach(x => { res = res += this.debugExpDump(x.n, depth - 1) + ", " })
                    res += " ]"
                    return res
                }
            default:
                throw new Error("invalid lambda term type");
        }
    }

    /**
     * Returns a string representation of the expression
     * resolves pointers up to _depth_ not to get stuck in a loop
     * @param term - expression to dump in to string
     * @param depth - depth to which to resolve pointers
     */
    reprExpDump(term: GraphN, depth: number = 10): string {
        if (depth <= 0)
            return ">...<"
        switch (term.type) {
            case "ptr": {
                return this.reprExpDump(term.value.n, depth - 1)
            }
            case "comb":
            case "funcref":
                return term.name;
            case "str":
            return term.value;
            case "int":
                return term.value.toString();
            case "app":
            {
                return " ( " + this.reprExpDump(term.lhs.n, depth - 1) + " " +
                    this.reprExpDump(term.rhs.n, depth - 1) + " ) ";
            }
            case "arr":
                if (term.array.length > 5)
                    return "[...]"
                else {
                    let res = "[ "
                    term.array.forEach(x => { res = res += this.reprExpDump(x.n, depth - 1) + ", " })
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
 * @throws {EvaluationException} Unknown combinator name
 */
function evalCombExpr(top: Comb, lhs_stack: App[]): [GraphN, boolean] {
    switch (top.name) {
        case "S":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                const lhs = npappptr(f, x)
                const rhs = npappptr(g, x)
                return [npapp(lhs, rhs), true]
            }
        case "K":
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                return [x.n, true]
            }
        case "I":
        // case "ord":
        // case "chr":
            if (lhs_stack.length < 1) { return [top, false] }
            else {
                return [lhs_stack.pop()!.rhs.n, true]
            }
        case "Y":
            if (lhs_stack.length < 1) { return [top, false] }
            else {
                const n = lhs_stack.pop()!
                const n_x: App = {type: 'app', lhs: n.rhs, rhs: {n: n}}
                return [n_x, true]
            }
        case "B":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [npapp(f, npappptr(g, x)), true]
            }
        case "C":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [npapp(npappptr(f, x), g), true]
            }
        case "S'":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const c = lhs_stack.pop()!.rhs
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [npapp(npappptr(c, npappptr(f, x)), npappptr(g, x)), true]
            }
        case "B*": // not used by MicroHs
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const c = lhs_stack.pop()!.rhs
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [npapp(c, npappptr(f, npappptr(g, x))), true]
            }
        case "C'":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const c = lhs_stack.pop()!.rhs
                const f = lhs_stack.pop()!.rhs
                const g = lhs_stack.pop()!.rhs
                const x = lhs_stack.pop()!.rhs

                return [npapp(npappptr(c, npappptr(f, x)), g), true]
            }
        case "B'":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs
                const w = lhs_stack.pop()!.rhs

                return [npapp(npappptr(x, y), npappptr(z, w)), true]
            }
        case "A":
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                lhs_stack.pop() // x
                const y = lhs_stack.pop()!.rhs
                return [y.n, true]
            }
        case "U":
            if (lhs_stack.length < 2) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                return [npapp(y, x), true]
            }
        case "Z":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                lhs_stack.pop() // z

                return [npapp(x, y), true]
            }
        case "P":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs

                return [npapp(npappptr(z, x), y), true]
            }
        case "R":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs

                return [npapp(npappptr(y, z), x), true]
            }
        case "O":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                lhs_stack.pop() // z
                const w = lhs_stack.pop()!.rhs

                return [npapp(npappptr(w, x), y), true]
            }
        case "K2":
            if (lhs_stack.length < 3) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                lhs_stack.pop() // z

                return [x.n, true]
            }
        case "K3":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                lhs_stack.pop() // z
                lhs_stack.pop() // w

                return [x.n, true]
            }
        case "K4":
            if (lhs_stack.length < 5) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                lhs_stack.pop() // y
                lhs_stack.pop() // z
                lhs_stack.pop() // w
                lhs_stack.pop() // v

                return [x.n, true]
            }
        case "C'B":
            if (lhs_stack.length < 4) { return [top, false] }
            else {
                const x = lhs_stack.pop()!.rhs
                const y = lhs_stack.pop()!.rhs
                const z = lhs_stack.pop()!.rhs
                const w = lhs_stack.pop()!.rhs

                return [npapp(npappptr(x, z), npappptr(y, w)), true]
            }
        case "IO.>>":
        case "IO.>>=":
        case "IO.return":
            return [top, false]
        default:
            throw new EvaluationException("unknown function " + top.name)
    }
}

import {EvaluationException} from '../exceptions';
import { StandardOutput } from '../node_tools';
import {App, Comb, FuncRef, GraphN, npapp, Nodeptr, npappptr} from '../types'
import {arithmeticI, comparison} from "./lambda_aux";

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
 */
export class Evaluator {
    constructor() {
    }

    /**
     * Evaluates the expression to WHNF.
     * @param np - a Nodeptr containing the expression to evaluate,
     *             will be updated with the evaluated expression
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

        if (lhs_stack.length > 0)
            top = lhs_stack[0]
        
        np.n = top

        return top;
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
     *          else top and false if not enough arguments available
     * @throws {EvaluationException} Unknown function name
     */
    private evalFuncExpr(top: FuncRef, lhs_stack: App[]): [GraphN, boolean] {
        switch (top.name) {
            case "+":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 + p2))
            case "-":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 - p2))
            case "*":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 * p2))
            case "/":
                return this.performStrictFunc2(top, lhs_stack, arithmeticI((p1, p2) => p1 / p2))
            case "=": // for lambda calculus
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 == p2))
            case "/=":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 != p2))
            case "<=":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 <= p2))
            case "<":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 < p2))
            case ">=":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 >= p2))
            case ">":
                return this.performStrictFunc2(top, lhs_stack, comparison((p1, p2) => p1 > p2))
            case "printAndReturn": {
                if (lhs_stack.length < 1)
                    return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                console.log(this.debugExpDump(x, 10))
                return [x, true]
            }
            default:
                throw new EvaluationException("unknown function " + top.name)
        }
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
        default:
            throw new EvaluationException("unknown function " + top.name)
    }
}

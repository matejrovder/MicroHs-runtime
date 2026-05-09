import { EvaluationException } from '../exceptions';
import { GraphN, Pointer, PointedTo, App, combinator, app, intConst,  Comb, FuncRef } from '../types'

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
    throw new EvaluationException("invalid types for arithmetic operation, try evaluating arguments first " + x.type + y.type)
}

function arithmeticC(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => arithmetic(x, y, fn)
}

function comparison(x: GraphN, y: GraphN, cmp: (p1: bigint, p2: bigint) => boolean): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        if (cmp(x.value, y.value)) {
            return combinator("K")
        }
        else {
            return combinator("A")
        }
    }
    throw new EvaluationException("invalid types for arithmetic operation, try evaluating arguments first")
}

function comparisonC(cmp: (p1: bigint, p2: bigint) => boolean): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => comparison(x, y, cmp)
}

export class Evaluator {

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
                case "comb":
                    [top, loopAgain] = evalCombExpr(top, lhs_stack)
                    break
                case "funcref":
                    [top, loopAgain] = this.evalFuncExpr(top, lhs_stack)
                    break
                default:
                    loopAgain = false
            }
            // this is where replace all occurences of this node in the graph with the evaluated node
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
            throw new EvaluationException("invalid eval") // sanity check

        return top;
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
            case "+":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 + p2))
            case "-":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 - p2))
            case "*":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 * p2))
            case "/":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 / p2 | 0n))
            case "%":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 % p2))
            case "=": // for lambda calculus
            case "==":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 == p2))
            case "/=":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 != p2))
            case "<=":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 <= p2))
            case "<":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 < p2))
            case ">=":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 >= p2))
            case ">":
                return this.performStrictFunc2(top, lhs_stack, comparisonC((p1, p2) => p1 > p2))
            case "and":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 & p2))
            case "or":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 | p2))
            case "shr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 >> p2))
            case "ashr":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 >> p2))
            case "shl":
                return this.performStrictFunc2(top, lhs_stack, arithmeticC((p1, p2) => p1 << p2))
            case "inv": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [arithmetic(intConst(0n), x, (p1, p2) => ~p2), true]
            }
            case "neg": {
                if (lhs_stack.length < 1) return [top, false]
                const x = this.evaluate(lhs_stack.pop()!.rhs)
                return [arithmetic(intConst(0n), x, (p1, p2) => p1 - p2), true]
            }
            default:
                throw new EvaluationException("unknown function " + top.name)
        }
    }

    evalExpStr(term: GraphN, depth: number): string {
        if (depth <= 0)
            return ">...<"
        switch (term.type) {
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
                    return " ( " + this.evalExpStr(term.lhs, depth - 1) + " " + this.evalExpStr(term.rhs, depth - 1) + " ) ";
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

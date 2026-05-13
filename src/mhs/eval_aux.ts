/**
 * @file
 * Contains auxiliary functions, mostly concerning numbers, for the Evaluator (mhs_eval.ts)
 */

import {app, combinator, GraphN, intConst} from "../types";
import {EvaluationException} from "../exceptions";


/**
 * Performs an integer arithmetic function on graph nodes.
 */
export function performArithmetic(x: GraphN, y: GraphN, fn: (p1: bigint, p2: bigint) => bigint): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        return intConst(fn(x.value, y.value))
    }
    throw new EvaluationException("invalid types for arithmetic operation, try evaluating arguments first "
        + x.type + y.type)
}

/**
 * Returns a function which accepts two graph nodes as arguments, performs _fn_ on the integers they contain,
 * converts the result to 64 bit unsigned int and returns it as a GraphN.
 */
export function arithmeticU(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => performArithmetic(x, y, (x, y) => BigInt.asUintN(64, fn(x, y)))
}

/**
 * Returns a function which accepts two graph nodes as arguments, performs _fn_ on the integers they contain,
 * converts the result to 64 bit signed int and returns it as a GraphN.
 */
export function arithmeticI(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => performArithmetic(x, y, (x, y) => BigInt.asIntN(64, fn(x, y)))
}

/**
 * Performs an integer comparison function on graph nodes.
 * @return combinator A (true) or K (false)
 */
function performComparison(x: GraphN, y: GraphN, cmp: (p1: bigint, p2: bigint) => boolean): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        if (cmp(x.value, y.value)) {
            // true and false values are inverse to lambda's Church encoding
            return combinator("A")
        } else {
            return combinator("K")
        }
    }
    throw new EvaluationException("invalid types for arithmetic operation, try evaluating arguments first")
}

/**
 * Returns a function which accepts two graph nodes as arguments, compares the integers they contain using _fn_
 * and returns the result as a combinator A (true) or K (false).
 */
export function comparison(cmp: (p1: bigint, p2: bigint) => boolean): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => performComparison(x, y, cmp)
}

/**
 * Three-way-compares two signed integers. Returns a comparison combinator by convention of MicroHs
 * @return (Z K) if x < y
 *         (K A) if x > y
 *         (K K) if x === y
 */
export function threeWayCompareI(x: GraphN, y: GraphN): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        const xi = BigInt.asIntN(64, x.value)
        const yi = BigInt.asIntN(64, y.value)

        if (xi < yi) return app(combinator("Z"), combinator("K"))
        else if (xi > yi) return app(combinator("K"), combinator("A"))
        else return app(combinator("K"), combinator("K"))
    }
    throw new EvaluationException("invalid types for arithmetic operation, try evaluating arguments first")
}

/**
 * Three-way-compares two unsigned integers. Returns a comparison combinator by convention of MicroHs
 * @return (Z K) if x < y
 *         (K A) if x > y
 *         (K K) if x === y
 */
export function threeWayCompareU(x: GraphN, y: GraphN): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        const xu = BigInt.asUintN(64, x.value)
        const yu = BigInt.asUintN(64, y.value)

        if (xu < yu) return app(combinator("Z"), combinator("K"))
        else if (xu > yu) return app(combinator("K"), combinator("A"))
        else return app(combinator("K"), combinator("K"))
    }
    throw new EvaluationException("invalid types for arithmetic operation, try evaluating arguments first")
}

/** Check if x is a function or a combinator of given name */
export function isNamed(x: GraphN, name: string): boolean {
    return (x.type === 'comb' || x.type === 'funcref') && x.name === name
}

/** Check if two terms are equal (deep equality) */
export function equalTerms(term1: GraphN, term2: GraphN): boolean {
    if (term1 === term2)
        return true
    if (term1.type !== term2.type)
        return false

    switch (term1.type) {
        case "ptr": {
            const t2 = term2 as typeof term1
            return term1.value === t2.value || equalTerms(term1.value.n, t2.value.n)
        }
        case "comb":
        case "funcref":
            return term1.name === (term2 as typeof term1).name
        case "str":
        case "int":
            return term1.value === (term2 as typeof term1).value
        case "app":
            return equalTerms(term1.lhs.n, (term2 as typeof term1).lhs.n) && equalTerms(term1.rhs.n, (term2 as typeof term1).rhs.n)
        case "arr": {
            const t2 = term2 as typeof term1
            if (term1.array === t2.array)
                return true
            return term1.array.length === t2.array.length &&
                term1.array.every((value, index) => equalTerms(value.n, t2.array[index].n))
        }
    }
}

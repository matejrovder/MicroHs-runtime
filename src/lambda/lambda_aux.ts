/**
 * @file
 * Contains auxiliary functions, mostly concerning numbers, for the lambda Evaluator (lambda_eval.ts)
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
            // Church encoding
            return combinator("K")
        } else {
            return combinator("A")
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

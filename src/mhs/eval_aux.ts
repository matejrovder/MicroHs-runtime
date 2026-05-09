/**
 * @file
 * Contains auxiliary functions, mostly concerning numbers, for the Evaluator (mhs_eval.ts)
 */

import {app, combinator, GraphN, intConst, PointedTo, Pointer} from "../types";
import {EvaluationException} from "../exceptions";

/** Makes a Pointer node and a PointedTo object holding the given node */
export function makePointer(node: GraphN): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: PointedTo = {'type': 'pointedto', 'evaluated': false, term: node}
    return {'type': "ptr", 'value': pointedTo}
}


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

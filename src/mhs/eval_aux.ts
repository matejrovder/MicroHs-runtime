import {app, combinator, GraphN, intConst, PointedTo, Pointer} from "../types";
import {EvaluationError} from "../errors";

export function makePointer(node: GraphN): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: PointedTo = {'type': 'pointedto', 'evaluated': false, term: node}
    return {'type': "ptr", 'value': pointedTo}
}

export function performArithmetic(x: GraphN, y: GraphN, fn: (p1: bigint, p2: bigint) => bigint): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        return intConst(fn(x.value, y.value))
    }
    throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first "
        + x.type + y.type)
}

export function arithmeticU(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => performArithmetic(x, y, (x, y) => BigInt.asUintN(64, fn(x, y)))
}

export function arithmeticI(fn: (p1: bigint, p2: bigint) => bigint): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => performArithmetic(x, y, (x, y) => BigInt.asIntN(64, fn(x, y)))
}

function performComparison(x: GraphN, y: GraphN, cmp: (p1: bigint, p2: bigint) => boolean): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        if (cmp(x.value, y.value)) {
            // true and false values are inverse to lambda's Church encoding
            return combinator("A")
        } else {
            return combinator("K")
        }
    }
    throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first")
}

export function comparison(cmp: (p1: bigint, p2: bigint) => boolean): (x: GraphN, y: GraphN) => GraphN {
    return (x: GraphN, y: GraphN) => performComparison(x, y, cmp)
}

export function threeWayCompareI(x: GraphN, y: GraphN): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        const xi = BigInt.asIntN(64, x.value)
        const yi = BigInt.asIntN(64, y.value)

        if (xi < yi) return app(combinator("Z"), combinator("K"))
        else if (xi > yi) return app(combinator("K"), combinator("A"))
        else return app(combinator("K"), combinator("K"))
    }
    throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first")
}

export function threeWayCompareU(x: GraphN, y: GraphN): GraphN {
    if (x.type === 'int' && y.type === 'int') {
        const xu = BigInt.asUintN(64, x.value)
        const yu = BigInt.asUintN(64, y.value)

        if (xu < yu) return app(combinator("Z"), combinator("K"))
        else if (xu > yu) return app(combinator("K"), combinator("A"))
        else return app(combinator("K"), combinator("K"))
    }
    throw new EvaluationError("invalid types for arithmetic operation, try evaluating arguments first")
}

export function isNamed(x: GraphN, name: string): boolean {
    return (x.type === 'comb' || x.type === 'funcref') && x.name === name
}
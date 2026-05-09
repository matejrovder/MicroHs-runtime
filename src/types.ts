import { LT } from "./lambda/lambda_types";

type Var = {
    type: 'var';
    varN: string;
}

// Types of graph nodes

type App = {
    type: 'app';
    lhs: GraphN;
    rhs: GraphN;
}

type Const = Comb | Str | Int | FuncRef | Arr;

type Arr = {
    type: 'arr'
    array: GraphN[];
}

type Comb = {
    type: 'comb';
    name: string;
}

type Str = {
    type: 'str';
    value: string;
}

type Int = {
    type: 'int';
    value: bigint;
}

type FuncRef = {
    type: 'funcref';
    name: string;
}

type Pointer = {
    type: 'ptr';
    value: PointedTo;
}

type PointedTo = {
    type: 'pointedto'
    evaluated: boolean
    term: GraphN;
}

type NumberedRef = {
    type: 'numref'
    value: bigint
}

/** the Graph node type */
type GraphN = App | Const | Pointer | NumberedRef


// Functions to simplify graph node creation

function strConst(x: string): Const {
    return { "type": "str", "value": x }
}

function intConst(x: bigint): Const {
    return { "type": "int", "value": x }
}

function combinator(x: string): Const {
    return { "type": "comb", "name": x }
}

function app(t1: GraphN, t2: GraphN): App {
    return { "type": "app", "lhs": t1, "rhs": t2 };
}

function funcref(f: string): FuncRef {
    return { "type": "funcref", "name": f };
}


/** Creates a (Cons x xs) node */
function mkCons(x: GraphN, xs: GraphN): App {
    return app(app(combinator("O"), x), xs)
    // O - cons combinator
}

/**
 * Converts a string to Cons-Nil representation,
 * using comb. O as Cons and comb. K as Nil.
 * The reverse conversion is a member of Evaluator, because it needs
 * to call evaluate.
 */
function stringToCons(x: string): App | Const {
    let res: Const | App = combinator("K") // false/Nil combinator
    for (let i = x.length - 1; i >= 0; i--) {
        const ord = intConst(BigInt(x.charCodeAt(i)))
        res = mkCons(ord, res)
    }

    return res
}

function expStr(term: LT | GraphN): string {
    // TODO: remove and replace
    switch (term.type) {
        case "var":
            {
                return term.varN;
            }
        case "comb":
        case "funcref":
            return term.name;
        case "str":
            return term.value;
        case "int":
            return term.value.toString();
        case "app":
        case "ltapp":
            {
                return " ( " + expStr(term.lhs) + " " + expStr(term.rhs) + " ) ";
            }
        case "abs":
            {
                return " ( λ " + term.var + " . " + expStr(term.term) + " ) ";
            }
        default:
            throw new Error("invalid lambda term type");
    }
}


export { GraphN, Pointer, PointedTo, Var, App, Const, Arr, Comb, Str, Int, FuncRef, combinator, strConst, stringToCons, intConst, app, funcref, expStr }

import { LT } from "./lambda/lambda_types";

type Var = {
    type: 'var';
    varN: string;
}

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
    value: number;
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
    value: number
}

type GraphN = App | Const | Pointer | NumberedRef
// Graph node

function strConst(x: string): Const {
    return { "type": "str", "value": x }
}

function mkCons(x: GraphN, xs: GraphN): App {
    return app(app(combinator("O"), x), xs)
    // O - cons combinator
}

function mkString(x: string): App | Const {
    let res: Const | App = combinator("K") // false/nil combinator
    for (let i = x.length - 1; i >= 0; i--) {
        const ord = intConst(x.charCodeAt(i))
        res = mkCons(ord, res)
    }

    return res
}

function intConst(x: number): Const {
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

export { GraphN, Pointer, PointedTo, Var, App, Const, Arr, Comb, Str, Int, FuncRef, combinator, strConst, mkString, intConst, app, funcref, expStr }

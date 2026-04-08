import { Str, Int, FuncRef, GraphN } from '../types'

type LT = Var | LTApp | Abs | LTConst | GraphN
type LTConst = | Str | Int | FuncRef;

type Var = {
    type: 'var';
    varN: string;
}

type LTApp = {
    type: 'ltapp';
    lhs: LT;
    rhs: LT;
}

type Abs = {
    type: 'abs';
    var: string;
    term: LT
}

function variable(x: string): Var {
    return { "type": "var", "varN": x };
}

function strConst(x: string): Str {
    return { "type": "str", "value": x }
}

function intConst(x: bigint): Int {
    return { "type": "int", "value": x }
}

function ltapp(t1: LT, t2: LT): LTApp {
    return { "type": "ltapp", "lhs": t1, "rhs": t2 };
}

function lam(x: string, term: LT): Abs {
    return { "type": "abs", "var": x, "term": term };
}

function funcref(f: string): FuncRef {
    return { "type": "funcref", "name": f };
}

function contains(term: LT, variable: string): boolean {
    switch (term.type) {
        case "var":
            {
                return term.varN === variable;
            }
        case "str":
            return false
        case "int":
        case "funcref":
        case "comb":
            return false;
        case "ltapp":
            {
                return contains(term.lhs, variable) || contains(term.rhs, variable);
            }
        case "abs":
            {
                return term.var !== variable && contains(term.term, variable);
            }
        default:
            throw new Error("invalid lambda term type");
    }
}

function etaReduction(term: LT, redVariable: string): LT | null {
    switch (term.type) {
        case "ltapp":
        case "app":
            {
                if (term.rhs.type === "var") {
                    if (term.rhs.varN === redVariable && !contains(term.lhs, redVariable))
                        return term.lhs;
                }

                return null;
            }
        default:
            return null;
    }
}

function makeAbstraction(x: string, term: LT) {
    const etaReduced = etaReduction(term, x);
    if (etaReduced !== null)
        return etaReduced;
    return lam(x, term);
}

export { LT, LTConst, Var, LTApp, Abs, variable, strConst, intConst, ltapp, funcref, makeAbstraction, etaReduction }
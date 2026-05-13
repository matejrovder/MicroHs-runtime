import {FuncRef, GraphN, Int, Str} from '../types'

/** A lambda term */
type LT = Var | LTApp | Abs | LTConst | GraphN

/** A constant allowed in a lambda term */
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

// Functions for building lambda expressions

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


/**
 * Makes abstraction.
 * This function was used when eta reduction was implemented
 * as a standalone function. It is not required, as it was
 * replaced by the optimizations.
 */
function makeAbstraction(x: string, term: LT) {
    // const etaReduced = etaReduction(term, x);
    // if (etaReduced !== null)
    //     return etaReduced;
    return lam(x, term);
}

/** 
 * Returns a string representation of a lambda term
 * or a lambda term converted to SKI
 */
function simpleExpString(term: LT | GraphN): string {
    switch (term.type) {
        case "var": {
            return term.varN;
        }
        case "comb":
        case "funcref":
            return term.name;
        case "str":
            return term.value;
        case "int":
            return term.value.toString();
        case "ltapp": {
            return " ( " + simpleExpString(term.lhs) + " " + simpleExpString(term.rhs) + " ) ";
        }
        case "app": {
            return " ( " + simpleExpString(term.lhs.n) + " " + simpleExpString(term.rhs.n) + " ) ";
        }
        case "abs": {
            return " ( λ " + term.var + " . " + simpleExpString(term.term) + " ) ";
        }
        default:
            throw new Error("invalid lambda term type");
    }
}

export { LT, LTConst, Var, LTApp, Abs, variable, strConst, intConst, ltapp, funcref, makeAbstraction, simpleExpString }

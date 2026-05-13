import { LT, ltapp } from './lambda_types'
import { app, GraphN, combinator, strConst } from '../types'

// Compilation of LT to SKI is implemented by allowing SKI types in LT AST as output from _compileSKI and abstractSKI,
// then this AST is recursively converted to SKI by _ensureSKI.
// The reasons for this are several, e.g.the way lambda abstractions are converted to SKI combinator expressions
// requires variables to be kept there during compilation and the strict SKI / Graph node type doesn't allow variables.

/** Checks if term is the given combinator */
function isComb(term: LT, name: string) {
    return term.type === 'comb' && term.name === name
}

/**
 * Optimizes the expression (S term1 term2)
 * according to the rules from Simon L. Peyton Jones'
 * "The Implementation of Programming Languages" p. 273
 */
function optimizeCombS(term1: LT, term2: LT): LT {

    if (term1.type === 'ltapp' && term2.type === 'ltapp') {
        const t1l = term1.lhs, t1r = term1.rhs
        const t2l = term2.lhs, t2r = term2.rhs

        if (isComb(t1l, "K") && isComb(t2l, "K"))
            return ltapp(combinator("K"), ltapp(t1r, t2r))
    }

    // replaces eta
    if (term1.type === 'ltapp' && isComb(term1.lhs, "K") && isComb(term2, "I")) {
        return term1.rhs
    }

    if (term1.type === 'ltapp' && isComb(term1.lhs, "K") && term2.type === 'ltapp' &&
        term2.lhs.type === 'ltapp' && isComb(term2.lhs.lhs, "B")) {
        return ltapp(ltapp(ltapp(combinator("B*"), term1.rhs), term2.lhs.rhs), term2.rhs)
    }

    if (term1.type === 'ltapp' && isComb(term1.lhs, "K")) {
        return ltapp(ltapp(combinator("B"), term1.rhs), term2)
    }

    if (term1.type === 'ltapp' && term1.lhs.type === 'ltapp' && isComb(term1.lhs.lhs, "B") && term2.type === 'ltapp' &&
        isComb(term2.lhs, "K")) {
        return ltapp(ltapp(ltapp(combinator("C'"), term1.lhs.rhs), term1.rhs), term2.rhs)
    }

    if (term2.type === 'ltapp' && isComb(term2.lhs, "K")) {
        return ltapp(ltapp(combinator("C"), term1), term2.rhs)
    }

    if (term1.type === 'ltapp' && term1.lhs.type === 'ltapp' && isComb(term1.lhs.lhs, "B")) {
        return ltapp(ltapp(ltapp(combinator("S'"), term1.lhs.rhs), term1.rhs), term2)
    }

    return ltapp(ltapp(combinator("S"), term1), term2);
}

/**
 * Checks and converts the expression to GraphN type.
 * All free variables are converted to string nodes with their names.
 */
function ensureSKI(term: LT): GraphN {
    switch (term.type) {
        case "str":
        case "int":
        case "funcref":
        case "comb":
            {
                return term;
            }
        case "var":
            {
                return strConst(term.varN);
            }
        case "ltapp":
            {
                return app(ensureSKI(term.lhs), ensureSKI(term.rhs));
            }
        case "app":
            {
                // might not be required
                return app(ensureSKI(term.lhs.n), ensureSKI(term.rhs.n));
            }
        default:
            throw new Error("invalid lambda term type: "+ term.type);
    }
}

/**
 * Abstracts the variable from the lambda term
 * according to the rules from Simon L. Peyton Jones'
 * "The Implementation of Programming Languages" p. 273
 */
function abstractSKI(term: LT, absVariable: string): LT {
    switch (term.type) {
        case "var":
            {
                if (term.varN === absVariable)
                    return combinator("I")
                else return ltapp(combinator("K"), term);
            }
        case "int":
        case "funcref":
        case "comb":
            {
                return ltapp(combinator("K"), term);
            }
        case "ltapp":
            {
                const term1 = abstractSKI(term.lhs, absVariable);
                const term2 = abstractSKI(term.rhs, absVariable);
                return optimizeCombS(term1, term2)
            }
        case "app":
            {
                const term1 = abstractSKI(term.lhs.n, absVariable);
                const term2 = abstractSKI(term.rhs.n, absVariable);
                return optimizeCombS(term1, term2)
            }
        case "abs":
            {
                const compiled = _compileSKI(term)
                return abstractSKI(compiled, absVariable);
            }
        default:
            throw new Error("invalid lambda term type: " + term.type);
    }
}

/**
 * For internal use only. 
 * ensureSKI needs to be called on result of this function.
 * Use the compileSKI wrapper.
 * 
 * Compiles the lambda term
 * according to the rules from Simon L. Peyton Jones'
 * "The Implementation of Programming Languages" p. 273
 */
function _compileSKI(term: LT): LT {
    switch (term.type) {
        case "var":
        case "int":
        case "funcref":
        case "comb":
            {
                return term;
            }
        case "ltapp":
            {
                return ltapp(_compileSKI(term.lhs), _compileSKI(term.rhs));
            }
        case "abs":
            {
                return abstractSKI(term.term, term.var);
            }
        default:
            throw new Error("invalid lambda term type: " + term.type);
    }
}

/**
 * Compiles the lambda term
 * according to the rules from Simon L. Peyton Jones'
 * "The Implementation of Programming Languages" p. 273
 * 
 * and returns valid GraphN node
 */
export function compileSKI(term: LT): GraphN {
    const compiled = _compileSKI(term)
    return ensureSKI(compiled)
}

import { etaReduction, LT, ltapp } from './lambda_types'
import { app, SKI, combinator, strConst } from '../ast'

// Compilation of LT to SKI is implemented by allowing SKI types in LT AST as output from _compileSKI and abstractSKI,
// then this AST is recursively converted to SKI by _ensureSKI.
// The reasons for this are several, e.g.the way lambda abstractions are converted to SKI combinator expressions
// requires variables to be kept there during compilation and the strict SKI / Graph node type doesn't allow variables.

function isComb(term: LT, name: string) {
    return term.type === 'const' && term.ctype === 'comb' && term.name === name
}

function optimizeCombS(term1: LT, term2: LT): LT {
    /**
     * @brief Optimizes expression S term1 term2
     */

    if (term1.type === 'ltapp' && term2.type === 'ltapp') {
        const t1l = term1.lhs, t1r = term1.rhs
        const t2l = term2.lhs, t2r = term2.rhs

        if (isComb(t1l, "K") && isComb(t2l, "K"))
            return ltapp(combinator("K"), ltapp(t1r, t2r))
    }

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

function ensureSKI(term: LT): SKI {
    switch (term.type) {
        case "const":
            {
                return term;
            }
        case "var":
            {
                return strConst(term.varN);
            }
        case "ltapp":
        case "app":
            // optionally keep only case "ltapp" to strongly distinguish
            // between App and LTApp / Graph nodes (SKI) and LT
            {
                return app(ensureSKI(term.lhs), ensureSKI(term.rhs));
            }
        default:
            throw new Error("invalid lambda term type");
    }
}

function abstractSKI(term: LT, absVariable: string): LT {
    switch (term.type) {
        case "var":
            {
                if (term.varN === absVariable)
                    return combinator("I")
                else return ltapp(combinator("K"), term);
            }
        case "const":
            {
                return ltapp(combinator("K"), term);
            }
        case "ltapp":
        case "app":
            {
                const etaReduced = etaReduction(term, absVariable);
                if (etaReduced !== null)
                    return _compileSKI(etaReduced)

                const term1 = abstractSKI(term.lhs, absVariable);
                const term2 = abstractSKI(term.rhs, absVariable);
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

function _compileSKI(term: LT): LT {
    switch (term.type) {
        case "var":
            {
                console.log("_compileSKI WARNING: variable " + term.varN + " present in the expression")
                return strConst(term.varN);
            }
        case "const":
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

export function compileSKI(term: LT): SKI {
    /**
     * @brief compiles to SKI and then ensures valid SKI (application/constant/pointer)
     */

    const compiled = _compileSKI(term)
    return ensureSKI(compiled)
}
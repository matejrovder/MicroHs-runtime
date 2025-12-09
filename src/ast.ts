
type Var = {
    type: 'var';
    varN: string;
}

type App = {
    type: 'app';
    lhs: LT;
    rhs: LT;
}

type Abs = {
    type: 'abs';
    var: string;
    term: LT
}

type Const = Comb | Str;

type Comb = {
    type: 'const'
    ctype: 'comb';
    name: string;
}

type Str = {
    type: 'const'
    ctype: 'str';
    value: string;
}

type Pointer = {
    type: 'ptr';
    value: PointedTo;
}

type PointedTo = {
    type: 'pointedto'
    evaluated: boolean
    term: SKI;
}

type LT = Var | App | Abs | Const | Pointer

type SKI = LT | Pointer 

// TODO: make next two functions return SKI
// Eta reduction doesnt work well if we convert var to const, must take a look at it
// Perhaps we can distinguish bounded and unbounded variables, unbounded will be converted to consts
// and bounded vars will be kept. At the end we will then check that there are no bounded vars

// Uncomment next line then
// type SKI = App | Const | Pointer


function abstractSKI(term: LT, absVariable: string): LT {
    switch (term.type) {
        case "var":
            {
                if (term.varN === absVariable)
                    return combinator("I")
                else return app(combinator("K"), term);
            }
        case "const":
            {
                return app(combinator("K"), term);
            }
        case "app":
            {
                const etaReduced = etaReduction(term, absVariable);
                if (etaReduced !== null)
                    return compileSKI(etaReduced)

                const term1 = app(combinator("S"), abstractSKI(term.lhs, absVariable));
                const term2 = abstractSKI(term.rhs, absVariable);
                return app(term1, term2)
            }
        case "abs":
            {
                const compiled = compileSKI(term)
                return abstractSKI(compiled, absVariable);
            }
        default:
            throw new Error("invalid lambda term type");
    }
}

function compileSKI(term: LT): LT {
    switch (term.type) {
        case "var":
        // {
        //     return strConst(term.varN);
        // } // THIS DOESNT WORK
        // eslint-disable-next-line no-fallthrough
        case "const":
            {
                return term;
            }
        case "app":
            {
                return app(compileSKI(term.lhs), compileSKI(term.rhs));
            }
        case "abs":
            {
                return abstractSKI(term.term, term.var);
            }
        default:
            throw new Error("invalid lambda term type");
    }
}


function etaReduction(term: LT, redVariable: string): LT | null {
    switch (term.type) {
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

function contains(term: LT, variable: string): boolean {
    switch (term.type) {
        case "var":
            {
                return term.varN === variable;
            }
        case "const":
            return false;
        case "app":
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

function variable(x: string): Var {
    return { "type": "var", "varN": x };
}

function strConst(x: string): Const {
    return { "type": "const", "ctype": "str", "value": x }
}

function combinator(x: string): Const {
    return { "type": "const", "ctype": "comb", "name": x }
}

function app(t1: LT, t2: LT): App {
    return { "type": "app", "lhs": t1, "rhs": t2 };
}

function lam(x: string, term: LT): Abs {
    return { "type": "abs", "var": x, "term": term };
}

function expStr(term: LT): string {
    switch (term.type) {
        case "var":
            {
                return term.varN;
            }
        case "const":
            {
                switch (term.ctype) {
                    case "comb":
                        return term.name;
                    case "str":
                        return term.value;
                    default: throw new Error("Invalid ctype");
                }
            }
        case "app":
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

function makeAbstraction(x: string, term: LT) {
    const etaReduced = etaReduction(term, x);
    if (etaReduced !== null)
        return etaReduced;
    return lam(x, term);
}

export { SKI, LT, Pointer, PointedTo, Var, App, Abs, Const, variable, combinator, strConst, app, expStr, makeAbstraction, compileSKI }

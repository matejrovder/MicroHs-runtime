interface lambdaterm {
    type: string;
}

interface abstraction extends lambdaterm {
    var: Ivariable
    term: lambdaterm;
}

interface Ivariable extends lambdaterm {
    name: string;
}

interface application extends lambdaterm {
    term1: lambdaterm;
    term2: lambdaterm;
}

function abstractSKI(term: lambdaterm, absVariable: Ivariable): lambdaterm {
    switch (term["type"]) {
        case "var":
            {
                const t = term as Ivariable;
                if (t["name"] === absVariable["name"])
                    return combinator("I")
                else return app(combinator("K"), t);
            }
        case "app":
            {
                const etaReduced = etaReduction(term, absVariable);
                if (etaReduced !== null)
                    return compileSKI(etaReduced)

                const t = term as application;
                const term1 = app(combinator("S"), abstractSKI(t.term1, absVariable));
                const term2 = abstractSKI(t.term2, absVariable);
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

function compileSKI(term: lambdaterm): lambdaterm {
    switch (term["type"]) {
        case "var":
            {
                return term
            }
        case "app":
            {
                const t = term as application;
                return app(compileSKI(t["term1"]), compileSKI(t["term2"]));
            }
        case "abs":
            {
                const t = term as abstraction;
                return abstractSKI(t["term"], t["var"]);
            }
        default:
            throw new Error("invalid lambda term type");
    }
}


function etaReduction(term: lambdaterm, redVariable: Ivariable): lambdaterm | null {
    switch (term["type"]) {
        case "app":
            {
                const t = term as application;
                if (t.term2.type === "var") {
                    const term2 = t.term2 as Ivariable;
                    if (term2.name === redVariable.name && !contains(t.term1, redVariable))
                        return t.term1;
                }

                return null;
            }
        case "abs":
        case "var":
            return null;
        default:
            throw new Error("invalid lambda term type");
    }
}

function contains(term: lambdaterm, variable: Ivariable): boolean {
    switch (term["type"]) {
        case "var":
            {
                const t = term as Ivariable;
                return t.name === variable.name;
            }
        case "app":
            {
                const t = term as application;
                return contains(t.term1, variable) || contains(t.term2, variable);
            }
        case "abs":
            {
                const t = term as abstraction;
                return t.var.name !== variable.name && contains(t.term, variable);
            }
        default:
            throw new Error("invalid lambda term type");
    }
}

function variable(x: string): Ivariable {
    return { "type": "var", "name": x };
}

function combinator(x: string) {
    return variable(x);
}

function app(t1: lambdaterm, t2: lambdaterm): application {
    return { "type": "app", "term1": t1, "term2": t2 };
}

function lam(x: Ivariable, term: lambdaterm): abstraction {
    return { "type": "abs", "var": x, "term": term };
}

function expStr(term: lambdaterm): string {
    switch (term["type"]) {
        case "var":
            {
                const t = term as Ivariable;
                return t.name;
            }
        case "app":
            {
                const t = term as application;
                return " ( " + expStr(t.term1) + " " + expStr(t.term2) + " ) ";
            }
        case "abs":
            {
                const t = term as abstraction;
                return " ( λ " + expStr(t.var) + " . " + expStr(t.term) + " ) ";
            }
        default:
            throw new Error("invalid lambda term type");
    }
}

function makeAbstraction(x: Ivariable, term: lambdaterm) {
    const etaReduced = etaReduction(term, x);
    if (etaReduced !== null)
        return etaReduced;
    return lam(x, term);
}

export { lambdaterm, abstraction, application, Ivariable, variable, combinator, app, expStr, makeAbstraction, compileSKI }

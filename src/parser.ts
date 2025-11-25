import { token, Lexer } from './lexer';
// import { ASTNode, AbstractionNode, ApplicationNode, VariableNode, CombinatorNode, EmptyNode, makeAbstraction } from './ast'
import { lambdaterm, abstraction, application, Ivariable, variable, combinator, app, expStr, makeAbstraction, compileSKI } from './ast'


class Parser {
    currentToken: token = token.eof;
    lexer: Lexer = new Lexer;

    constructor() {
        this.getNextToken();
    }

    getNextToken(): token {
        this.currentToken = this.lexer.getToken();
        return this.currentToken;
    }

    match(t: token) {
        if (this.currentToken !== t) {
            throw new Error("invalid token: " + this.currentToken);
        }
        this.getNextToken();
    }

    matchVariable(): Ivariable {
        if (this.currentToken !== token.var) {
            throw new Error("invalid token: " + this.currentToken);
        }
        const varName = this.lexer.varIdentifier;
        this.getNextToken();
        return variable(varName);
    }

    parse(lhs: lambdaterm | null = null): lambdaterm {
        switch (this.currentToken) {
            case token.bracketleft:
                {
                    this.getNextToken();
                    let rhs = this.parseBracketExpr(null);
                    if (lhs !== null)
                        lhs = app(lhs, rhs);
                    else
                        lhs = rhs
                    break;
                }
            case token.var:
                {
                    const v = variable(this.lexer.varIdentifier);
                    if (lhs === null) {
                        lhs = v;
                    }
                    else {
                        lhs = app(lhs, v);
                    }

                    this.getNextToken()
                    lhs = this.parse(lhs)
                    break;
                }
            case token.eof:
                if (lhs !== null)
                    return lhs;
                else throw new Error("end of file reached");
            default:
                if (lhs !== null)
                    return lhs;
                else throw new Error("invalid token: " + this.currentToken);
        }


        return this.parse(lhs);
    }


    parseBracketExpr(lhs: lambdaterm | null = null): lambdaterm {
        let rhs = null;

        switch (this.currentToken) {
            case token.lambda:
                {
                    this.getNextToken();
                    const varNode: Ivariable = this.matchVariable()
                    this.match(token.dot);
                    rhs = makeAbstraction(varNode, this.parse(null));
                    break;
                }
            default: {
                rhs = this.parse(lhs);
            }
        }

        this.match(token.bracketright)
        if (lhs !== null) {
            return app(lhs, rhs);
        }
        return rhs;
    }
    // parse
}

let p = new Parser();
let n = p.parse(null);
// n.printTree(0);
console.log(expStr(n));

let ski = compileSKI(n);
console.log(expStr(ski));

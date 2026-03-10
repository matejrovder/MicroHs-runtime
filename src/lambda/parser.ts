import { token, Lexer } from './lexer';
import { LT, ltapp, makeAbstraction, variable } from "./lambda_types";
import { combinator, funcref, intConst } from "../types";
// import { ASTNode, AbstractionNode, ApplicationNode, VariableNode, CombinatorNode, EmptyNode, makeAbstraction } from '../ast'

// import * as y ...

export class Parser {
    currentToken: token = token.eof;
    lexer: Lexer;
    knownFunctions: Set<string> = new Set(["+", "-", "*", "/", "print", "=", "double"]);

    constructor(input: string) {
        this.lexer = new Lexer(input)
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

    matchVariable(): string {
        if (this.currentToken !== token.var) {
            throw new Error("invalid token: " + this.currentToken);
        }
        const varName = this.lexer.varIdentifier;
        this.getNextToken();
        return varName;
    }

    parse(lhs: LT | null = null): LT {
        switch (this.currentToken) {
            case token.bracketleft:
                {
                    this.getNextToken();
                    let rhs = this.parseBracketExpr(null);
                    if (lhs !== null)
                        lhs = ltapp(lhs, rhs);
                    else
                        lhs = rhs
                    break;
                }
            case token.number: // TODO: DRY
                {
                    const c = intConst(this.lexer.numVal)
                    if (lhs === null) {
                        lhs = c;
                    }
                    else {
                        lhs = ltapp(lhs, c);
                    }

                    this.getNextToken()
                    lhs = this.parse(lhs)
                    break;
                }
            case token.var:
                {
                    let v: LT = variable(this.lexer.varIdentifier)
                    if (this.lexer.varIdentifier === "Y")
                        v = combinator("Y")
                    if (this.knownFunctions.has(this.lexer.varIdentifier))
                        v = funcref(this.lexer.varIdentifier);
                    if (lhs === null) {
                        lhs = v;
                    }
                    else {
                        lhs = ltapp(lhs, v);
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


    parseBracketExpr(lhs: LT | null = null): LT {
        let rhs = null;

        switch (this.currentToken) {
            case token.lambda:
                {
                    this.getNextToken();
                    const varN = this.matchVariable()
                    this.match(token.dot);
                    rhs = makeAbstraction(varN, this.parse(null));
                    break;
                }
            default: {
                rhs = this.parse(lhs);
            }
        }

        this.match(token.bracketright)
        if (lhs !== null) {
            return ltapp(lhs, rhs);
        }
        return rhs;
    }
    // parse
}

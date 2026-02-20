import { app, combinator, funcref, intConst, Pointer, SKI, strConst } from "../ast";
import { evalExpStr, Evaluator, makePointer } from "../eval";
import { MhsDumpLexer, mhsDumpToken } from "./mhs_dump_lexer";
import { MhsLexer } from "./mhs_lexer";

export class MhsDumpParser {
    currentToken: mhsDumpToken
    lexer: MhsDumpLexer

    constructor(input: string) {
        this.lexer = new MhsDumpLexer(input)
        this.currentToken = this.getNextToken()

    }

    private getNextToken(): mhsDumpToken {
        this.currentToken = this.lexer.getToken();
        return this.currentToken;
    }

    private match(token: mhsDumpToken, err: string | undefined = undefined): void {
        if (this.currentToken !== token)
            throw new Error(err === undefined ? "unexpected token" : err)
        this.currentToken = this.getNextToken()
    }

    parse(): [SKI, Map<string, Pointer>] {
        /**
         * @return main function and expression map
         */

        const expressions: Map<string, Pointer> = new Map()
        let main: SKI = strConst("empty main")

        if (this.currentToken !== mhsDumpToken.named || this.lexer.stringVal !== "combinators:")
            throw new Error("invalid header, expected 'combinators:'")
        this.currentToken = this.getNextToken()
        this.match(mhsDumpToken.newline)

        while (this.currentToken !== mhsDumpToken.eof) {
            this.match(mhsDumpToken.named)
            const name = this.lexer.stringVal
            this.match(mhsDumpToken.equals)
            const expr = this.parseExpr()
            if (expr === undefined)
                throw new Error("empty or invalid expression after =")

            expressions.set(name, makePointer(expr))
            if (/.+\.main/.test(name)) {
                main = expr
            }
            this.match(mhsDumpToken.newline)
        }

        return [main, expressions]
    }

    parseBracketExpr(lhs: SKI | undefined = undefined): SKI | undefined {
        const rhs = this.parseExpr(undefined)
        if (rhs === undefined)
            return lhs
        else if (lhs !== undefined)
            lhs = app(lhs, rhs)
        else
            lhs = rhs

        this.match(mhsDumpToken.bracketright, "unexpected token while parsing, was expecting )")
    }

    parseExpr(lhs: SKI | undefined = undefined): SKI | undefined {
        let rhs: SKI | undefined
        while (true) {
            switch (this.currentToken) {
                case mhsDumpToken.comb:
                    {
                        rhs = combinator(this.lexer.stringVal)
                        this.getNextToken();
                        break;
                    }
                case mhsDumpToken.intconst:
                    {
                        rhs = intConst(this.lexer.numVal)
                        this.getNextToken();
                        break;
                    }
                case mhsDumpToken.string:
                    {
                        rhs = strConst(this.lexer.stringVal)
                        this.getNextToken();
                        break;
                    }
                case mhsDumpToken.named:
                    {
                        rhs = funcref(this.lexer.stringVal)
                        this.getNextToken();
                        break;
                    }
                case mhsDumpToken.eof: {
                    rhs = undefined
                    throw new Error("Unexpected EOF while parsing")
                }
                case mhsDumpToken.bracketleft:
                    this.getNextToken();
                    rhs = this.parseBracketExpr(undefined);
                    break
                case mhsDumpToken.newline:
                case mhsDumpToken.bracketright:
                    this.getNextToken();
                    rhs = undefined
                    break
                case mhsDumpToken.equals:
                    throw new Error("Unexpected = token")
            }

            if (rhs === undefined)
                return lhs
            else if (lhs !== undefined)
                lhs = app(lhs, rhs)
            else
                lhs = rhs
        }
    }
}


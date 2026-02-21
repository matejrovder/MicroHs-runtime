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

    private match(token: mhsDumpToken, err: string | null = null): void {
        if (this.currentToken !== token)
            throw new Error(err === null ? "unexpected token " + this.currentToken + " ,was expecting " + token : err)
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
            if (expr === null)
                throw new Error("empty or invalid expression after =")

            expressions.set(name, makePointer(expr))
            if (/.+\.main/.test(name)) {
                main = expr
            }
            this.match(mhsDumpToken.newline)
        }

        return [main, expressions]
    }

    parseBracketExpr(lhs: SKI | null = null): SKI | null {
        const rhs = this.parseExpr(null)
        if (rhs === null) { /* empty */ }
        else if (lhs !== null)
            lhs = app(lhs, rhs)
        else
            lhs = rhs

        this.match(mhsDumpToken.bracketright, "unexpected token while parsing, was expecting )")
        return lhs
    }

    parseExpr(lhs: SKI | null = null): SKI | null {
        let rhs: SKI | null
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
                    rhs = null
                    throw new Error("Unexpected EOF while parsing")
                }
                case mhsDumpToken.bracketleft:
                    this.getNextToken();
                    rhs = this.parseBracketExpr(null);
                    break
                case mhsDumpToken.newline:
                case mhsDumpToken.bracketright:
                    rhs = null
                    break
                case mhsDumpToken.equals:
                    throw new Error("Unexpected = token")
            }

            if (rhs === null)
                return lhs
            else if (lhs !== null)
                lhs = app(lhs, rhs)
            else
                lhs = rhs
        }
    }
}

const fs = require('fs')

const input = fs.readFileSync('/dev/stdin').toString()

// const lex = new MhsDumpLexer(input)
// let token = lex.getToken()
// while (token !== mhsDumpToken.eof) {
//     console.log(token)
//     token = lex.getToken()
// }


const [main, expressions] = new MhsDumpParser(input).parse()
// const evaluator = new Evaluator(pointers)
// const ev = evaluator.evaluate(top)
// console.log("RESULT:")
// console.log(evalExpStr(ev))

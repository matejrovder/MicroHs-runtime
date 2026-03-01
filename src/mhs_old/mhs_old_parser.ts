import { app, combinator, funcref, intConst, Pointer, SKI, strConst } from "../ast";
import { evalExpStr, Evaluator, makePointer } from "../mhs_old_eval";
// import { evalExpStr, Evaluator, makePointer } from "../mhs_dump_eval";
import { MhsOldLexer, mhsOldToken } from "./mhs_old_lexer";
// import { MhsLexer } from "./mhs_lexer";

export class MhsOldParser {
    currentToken: mhsOldToken
    lexer: MhsOldLexer
    pointers: Map<number, Pointer> = new Map()

    constructor(input: string) {
        this.lexer = new MhsOldLexer(input)
        this.currentToken = this.getNextToken()
    }

    private getNextToken(): mhsOldToken {
        this.currentToken = this.lexer.getToken();
        return this.currentToken;
    }

    private match(token: mhsOldToken, err: string | null = null): void {
        if (this.currentToken !== token)
            throw new Error(err === null ? "unexpected token " + this.currentToken + " ,was expecting " + token : err)
        this.currentToken = this.getNextToken()
    }

    private checkToken(token: mhsOldToken, err: string | null = null): void {
        if (this.currentToken !== token)
            throw new Error(err === null ? "unexpected token " + this.currentToken + " ,was expecting " + token : err)
    }

    parse(): [SKI, Map<number, Pointer>] {
        /**
         * @return main function and expression map
         */

        const expr = this.parseExpr(null, true)
        if (expr === null)
            throw new Error("parser: empty program")

        return [expr, this.pointers]
    }

    parseBracketExpr(lhs: SKI | null = null): SKI | null {
        const rhs = this.parseExpr(null)
        if (rhs === null) { /* empty */ }
        else if (lhs !== null)
            lhs = app(lhs, rhs)
        else
            lhs = rhs

        this.match(mhsOldToken.bracketright, "unexpected token while parsing, was expecting )")
        return lhs
    }

    parseExpr(lhs: SKI | null = null, acceptEOF: boolean = false): SKI | null {
        let rhs: SKI | null
        while (true) {
            switch (this.currentToken) {
                case mhsOldToken.comb:
                    {
                        rhs = combinator(this.lexer.stringVal)
                        this.getNextToken();
                        break;
                    }
                case mhsOldToken.intconst:
                    {
                        rhs = intConst(this.lexer.numVal)
                        this.getNextToken();
                        break;
                    }
                case mhsOldToken.string:
                    {
                        rhs = strConst(this.lexer.stringVal)
                        this.getNextToken();
                        break;
                    }
                case mhsOldToken.named:
                    {
                        rhs = funcref(this.lexer.stringVal)
                        this.getNextToken();
                        break;
                    }
                case mhsOldToken.eof: {
                    if (!acceptEOF)
                        throw new Error("Unexpected EOF while parsing")
                    rhs = null
                    break
                }
                case mhsOldToken.bracketleft:
                    this.getNextToken();
                    rhs = this.parseBracketExpr(null);
                    break
                case mhsOldToken.newline:
                case mhsOldToken.bracketright:
                    rhs = null
                    break
                case mhsOldToken.ptrdef: {
                    const ptrnum = this.lexer.numVal
                    this.getNextToken()
                    rhs = this.parseExpr(null)
                    if (rhs === null)
                        throw new Error("empty shared expression definition")
                    this.pointers.set(ptrnum, makePointer(rhs))
                    break
                }
                case mhsOldToken.ref: {
                    const referenced = this.pointers.get(this.lexer.numVal)
                    if (referenced != undefined) {
                        rhs = referenced
                    }
                    else {
                        rhs = { 'type': 'numref', 'value': this.lexer.numVal }
                    }
                    this.getNextToken()
                    break
                }
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

// const lex = new MhsOldLexer(input)
// let token = lex.getToken()
// while (token !== mhsOldToken.eof) {
//     console.log(token)
//     token = lex.getToken()
// }


const [main, pointers] = new MhsOldParser(input).parse()
console.log(evalExpStr(main))
const evaluator = new Evaluator(pointers)
const ev = evaluator.evaluate(main)
console.log("RESULT:")
console.log(evalExpStr(ev))

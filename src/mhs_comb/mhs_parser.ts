import { app, combinator, funcref, intConst, Pointer, GraphN, strConst } from "../types";
import { evalExpStr, Evaluator, makePointer } from "../eval";
import { MhsLexer, mhsToken } from "./mhs_lexer";

export class MhsParser {
    currentToken: mhsToken
    lexer: MhsLexer

    constructor(input: string) {
        this.lexer = new MhsLexer(input)
        this.currentToken = this.getNextToken()

        this.skipHeader(true)
    }

    private skipHeader(debug: boolean) {
        if (this.currentToken != mhsToken.named)
            throw new Error("invalid header, version missing")
        if (debug)
            console.log("PARSER: input file version " + this.lexer.stringVal)
        if (this.getNextToken() != mhsToken.named)
            throw new Error("invalid header, shared expression count missing")
        if (debug)
            console.log("PARSER: " + this.lexer.stringVal + " shared expressions")
        this.getNextToken()
    }

    private getNextToken(): mhsToken {
        this.currentToken = this.lexer.getToken();
        return this.currentToken;
    }

    parse(): [GraphN, Map<number, Pointer>] {
        const stack: GraphN[] = []
        const pointers: Map<number, Pointer> = new Map()
        while (true) {
            switch (this.currentToken) {
                case mhsToken.comb:
                    stack.push(combinator(this.lexer.stringVal))
                    break
                case mhsToken.app: {
                    if (stack.length < 2)
                        throw new Error("@ with stack length < 2")
                    const rhs: GraphN = stack.pop()!
                    stack.push(app(stack.pop()!, rhs))
                    break
                }
                case mhsToken.intconst:
                    stack.push(intConst(this.lexer.numVal))
                    break
                case mhsToken.string:
                    stack.push(strConst(this.lexer.stringVal))
                    break
                case mhsToken.fficall:
                case mhsToken.named:
                    // TODO: this
                    stack.push(funcref(this.lexer.stringVal))
                    break
                case mhsToken.ref: {
                    const referenced = pointers.get(this.lexer.numVal)
                    if (referenced != undefined) {
                        stack.push(referenced)
                    }
                    else {
                        stack.push({ 'type': 'numref', 'value': this.lexer.numVal })
                    }
                    break
                }
                case mhsToken.ptrdef: {
                    if (stack.length < 1)
                        throw new Error("Shared expression creation with empty stack")
                    const top = stack.pop()!
                    const ptr = makePointer(top)
                    stack.push(ptr)
                    pointers.set(this.lexer.numVal, ptr)
                    break
                }
                case mhsToken.endbrace: {
                    if (stack.length < 1)
                        throw new Error("Empty stack at program end '}'")
                    if (stack.length > 1)
                        throw new Error("Stack length > 1 at program end '}'")
                    return [stack.pop()!, pointers]
                }
                case mhsToken.eof: {
                    throw new Error("Unexpected EOF while parsing")
                }
            }

            this.getNextToken()
        }
    }
}

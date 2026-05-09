import { app, combinator, funcref, intConst, Pointer, GraphN, strConst } from "../types";
import { evalExpStr, Evaluator, makePointer } from "./mhs_eval";
import { MhsLexer, mhsToken } from "./mhs_lexer";
import { ParsingError } from "../errors";

/**
 * Parser for the MicroHs combinator files.
 *
 * @param {string} input - the contents of the input file to parse
 */
export class MhsParser {
    private currentToken: mhsToken
    private lexer: MhsLexer

    constructor(input: string) {
        this.lexer = new MhsLexer(input)
        this.currentToken = this.getNextToken()

        this.skipHeader(true)
    }

    private skipHeader(debug: boolean) {
        if (this.currentToken != mhsToken.named)
            throw new ParsingError("invalid header, version missing")
        if (debug)
            console.log("PARSER: input file version " + this.lexer.stringVal)
        if (this.getNextToken() != mhsToken.named)
            throw new ParsingError("invalid header, shared expression count missing")
        if (debug)
            console.log("PARSER: " + this.lexer.stringVal + " shared expressions")
        this.getNextToken()
    }

    private getNextToken(): mhsToken {
        this.currentToken = this.lexer.getToken();
        return this.currentToken;
    }

    /**
     * Parses the input passed to the constructor.
     * @returns the root of the combinator graph and a map of numbered shared expressions.
     * @throws {ParsingError}
     */
    parse(): [GraphN, Map<bigint, Pointer>] {
        const stack: GraphN[] = []
        const pointers: Map<bigint, Pointer> = new Map()
        while (true) {
            switch (this.currentToken) {
                case mhsToken.comb:
                    stack.push(combinator(this.lexer.stringVal))
                    break
                case mhsToken.app: {
                    if (stack.length < 2)
                        throw new ParsingError("@ with stack length < 2")
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
                // As this runtime doesn't support FFI, it doesn't 
                // distinguish between an FFI call and a built-in primitive.
                case mhsToken.fficall:
                case mhsToken.named:
                    stack.push(funcref(this.lexer.stringVal))
                    break
                case mhsToken.ref: {
                    // If the referenced shared expression is already defined,
                    // use the pointer node referencing it.
                    // Else reference it by number.
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
                    // Defines a shared expression with the read label
                    if (stack.length < 1)
                        throw new ParsingError("Shared expression creation with empty stack")
                    const top = stack.pop()!
                    const ptr = makePointer(top)
                    stack.push(ptr)
                    pointers.set(this.lexer.numVal, ptr)
                    break
                }
                case mhsToken.endbrace: {
                    if (stack.length < 1)
                        throw new ParsingError("Empty stack at program end '}'")
                    if (stack.length > 1)
                        throw new ParsingError("Stack length > 1 at program end '}'")
                    return [stack.pop()!, pointers]
                }
                case mhsToken.eof: {
                    throw new ParsingError("Unexpected EOF while parsing")
                }
            }

            this.getNextToken()
        }
    }
}

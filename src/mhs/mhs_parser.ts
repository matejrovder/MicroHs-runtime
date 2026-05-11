import { app, combinator, funcref, intConst, Pointer, GraphN, strConst } from "../types";
import { MhsLexer, mhsToken } from "./mhs_lexer";
import { ParsingException } from "../exceptions";
import {makePointer} from "./eval_aux";

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

        // disable debug message
        this.skipHeader(false)
    }

    private skipHeader(debug: boolean) {
        if (this.currentToken != mhsToken.named)
            throw new ParsingException("invalid header, version missing")
        if (debug)
            console.log("PARSER: input file version " + this.lexer.stringVal)
        if (this.getNextToken() != mhsToken.named)
            throw new ParsingException("invalid header, shared expression count missing")
        if (debug)
            console.log("PARSER: " + this.lexer.stringVal + " shared expressions")
        // grep -v -e PARSER -e LEXER clears output of debug messages
        this.getNextToken()
    }

    private getNextToken(): mhsToken {
        this.currentToken = this.lexer.getToken();
        return this.currentToken;
    }

    /**
     * Parses the input passed to the constructor.
     * @returns the root of the combinator graph and a map of numbered shared expressions.
     * @throws {ParsingException}
     */
    parse(): GraphN {
        const stack: GraphN[] = []
        const pointers: Map<bigint, Pointer> = new Map()
        while (true) {
            switch (this.currentToken) {
                case mhsToken.comb:
                    stack.push(combinator(this.lexer.stringVal))
                    break
                case mhsToken.app: {
                    if (stack.length < 2)
                        throw new ParsingException("@ with stack length < 2")
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
                        const ptr = makePointer(strConst("undefined"))
                        pointers.set(this.lexer.numVal, ptr)
                        stack.push(ptr)
                    }
                    break
                }
                case mhsToken.ptrdef: {
                    // Defines a shared expression with the read label
                    if (stack.length < 1)
                        throw new ParsingException("Shared expression creation with empty stack")
                    const top = stack.pop()!
                    const referenced = pointers.get(this.lexer.numVal)
                    if (referenced != undefined) {
                        referenced.value.n = top
                        stack.push(referenced)
                    }
                    else {
                        const ptr = makePointer(top)
                        pointers.set(this.lexer.numVal, ptr)
                        stack.push(ptr)
                    }
                    break
                }
                case mhsToken.endbrace: {
                    if (stack.length < 1)
                        throw new ParsingException("Empty stack at program end '}'")
                    if (stack.length > 1)
                        throw new ParsingException("Stack length > 1 at program end '}'")
                    return stack.pop()!
                }
                case mhsToken.eof: {
                    throw new ParsingException("Unexpected EOF while parsing")
                }
            }

            this.getNextToken()
        }
    }
}

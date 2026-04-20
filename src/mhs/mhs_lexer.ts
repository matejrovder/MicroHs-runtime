import { ParsingError } from "../errors";

export enum mhsToken {
    eof,
    comb,
    app,
    fficall,
    string,
    ref,
    ptrdef,
    endbrace, // }
    named, // other named symbol, such as /=, IO.performIO, ...
    intconst,
}

const combinators: Set<string> = new Set([
    "S",
    "K",
    "I",
    "B",
    "C",
    "S'",
    "B'",
    "C'",
    "A",
    "U",
    "Y",
    "Z",
    "P",
    "R",
    "O",
    "K2",
    "K3",
    "K4",
    "C'B",
    "ord",
    "chr",
    "IO.>>",
    "IO.>>=",
])

export class MhsLexer {
    buffer: string;
    offset: number;
    stringVal: string = "";
    numVal: number = 0;
    ch: string;

    constructor(buffer: string) {
        this.buffer = buffer

        if (this.buffer.length < 1) {
            this.ch = "\0"
        }
        else {
            this.ch = this.buffer.charAt(0)
        }

        this.offset = 1;
    }

    private getChar(): string {
        if (this.buffer.length <= this.offset) {
            this.ch = "\0"
        }
        else {
            this.ch = this.buffer.charAt(this.offset)
            this.offset++;
        }

        return this.ch
    }

    private readInt(): void {
        let minus = false
        if (this.ch === "-") {
            minus = true
            this.ch = this.getChar()
        }

        if (!/\d/.test(this.ch))
            throw new ParsingError("invalid number")
        this.numVal = 0
        while (/\d/.test(this.ch)) {
            this.numVal *= 10
            this.numVal += parseInt(this.ch)
            this.ch = this.getChar()
        }
        if (minus)
            this.numVal *= -1
    }

    private readFnName(): void {
        this.stringVal = ""
        while (!/\s/.test(this.ch)) {
            this.stringVal += this.ch;
            this.ch = this.getChar();
        }
    }

    private readString(): void {
        // decode creative encoding used in MicroHs
        this.stringVal = ""
        while (!/"/.test(this.ch)) {
            switch (this.ch) {
                case "\\":
                    this.ch = this.getChar()
                    if (this.ch == "?")
                        this.ch = String.fromCodePoint(0x7F)
                    else if (this.ch == "_")
                        this.ch = String.fromCodePoint(0xFF)
                    break
                case "^":
                    this.ch = this.getChar()
                    if (this.ch.charCodeAt(0) < 0x40)
                        this.ch = String.fromCharCode(this.ch.charCodeAt(0) & 0x1f)
                    else
                        this.ch = String.fromCharCode((this.ch.charCodeAt(0) & 0x1f) | 0x80)
                    break
                case "|":
                    this.ch = this.getChar()
                    this.ch = String.fromCharCode(this.ch.charCodeAt(0) | 0x80)
                    break
                default:
                    break
            }
            this.stringVal += this.ch
            this.ch = this.getChar();
        }
    }

    getToken(): mhsToken {
        while (/\s/.test(this.ch)) {
            this.ch = this.getChar()
        }

        switch (this.ch) {
            case "\0":
                return mhsToken.eof
            case "@":
                this.getChar()
                return mhsToken.app
            case "}":
                this.getChar()
                return mhsToken.endbrace
            case ":":
                this.getChar()
                this.readInt()
                return mhsToken.ptrdef
            case "_":
                this.getChar()
                this.readInt()
                return mhsToken.ref
            case "^":
                this.getChar()
                this.readFnName()
                return mhsToken.fficall
            case "#":
                this.getChar()
                this.readInt()
                return mhsToken.intconst
            case "\"":
                this.getChar()
                this.readString()
                this.ch = this.getChar();
                return mhsToken.string
            default:
                this.readFnName()
                if (combinators.has(this.stringVal))
                    return mhsToken.comb
                return mhsToken.named
        }
    }
}

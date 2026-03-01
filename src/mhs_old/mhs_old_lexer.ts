export enum mhsOldToken {
    newline = "newline",
    eof = "eof",
    bracketleft = "(",
    bracketright = ")",
    ref = "_",
    ptrdef = ":",
    comb = "comb",
    string = "string",
    named = "named", // other named symbol, such as /=, IO.performIO, ...
    intconst = "intconst",
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
    // "IO.>>",
    // "IO.>>=",
])

export class MhsOldLexer {
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
        this.skipHeader()
    }

    private skipHeader(): void {
        this.readFnName()
        console.log("LEXER: version " + this.stringVal)
        if (this.getToken() !== mhsOldToken.newline)
            throw new Error("Lexer error: invalid header")
        if (this.getToken() !== mhsOldToken.intconst)
            throw new Error("Lexer error: invalid header")
        console.log("LEXER: shared expression count: " + this.numVal)
        if (this.getToken() !== mhsOldToken.newline)
            throw new Error("Lexer error: invalid header")
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
            throw new Error("invalid number")
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
        while (/[^\s()]/.test(this.ch)) {
            this.stringVal += this.ch;
            this.ch = this.getChar();
        }
    }

    private readString(): void {
        this.stringVal = ""
        while (!/"/.test(this.ch)) {
            switch (this.ch) {
                case "\\":
                    this.ch = this.getChar()
                    break
                default:
                    break
            }
            this.stringVal += this.ch
            this.ch = this.getChar();
        }
    }

    getToken(): mhsOldToken {
        while (/[ ]/.test(this.ch)) {
            this.ch = this.getChar()
        }

        if (/\d/.test(this.ch)) {
            this.readInt()
            return mhsOldToken.intconst
        }

        switch (this.ch) {
            case "\n":
            case "\r":
                while (/[\r\n]/.test(this.ch)) {
                    this.ch = this.getChar()
                }
                return mhsOldToken.newline
            case "\0":
                return mhsOldToken.eof;
            case "(":
                this.ch = this.getChar();
                return mhsOldToken.bracketleft;
            case ")":
                this.ch = this.getChar();
                return mhsOldToken.bracketright;

            case ":":
                this.getChar()
                this.readInt()
                return mhsOldToken.ptrdef
            case "_":
                this.getChar()
                this.readInt()
                return mhsOldToken.ref

            case "\"":
                this.getChar()
                this.readString()
                this.ch = this.getChar();
                return mhsOldToken.string
            case "$":
                this.getChar()
                this.readFnName()
                if (combinators.has(this.stringVal))
                    return mhsOldToken.comb
                return mhsOldToken.named

            default:
                throw new Error("LEXER: unexpected character: " + this.ch)
        }
    }
}

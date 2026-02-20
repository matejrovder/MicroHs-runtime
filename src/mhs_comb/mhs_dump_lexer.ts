export enum mhsDumpToken {
    newline = "\\n",
    eof = "eof",
    bracketleft = "(",
    bracketright = ")",
    equals = "=",
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

export class MhsDumpLexer {
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
        while (this.ch === "#")
            this.ch = this.getChar()
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

    getToken(): mhsDumpToken {
        while (/[ ]/.test(this.ch)) {
            this.ch = this.getChar()
        }

        switch (this.ch) {
            case "\n":
            case "\r":
                while (/[\r\n]/.test(this.ch)) {
                    this.ch = this.getChar()
                }
                return mhsDumpToken.newline
            case "\0":
                return mhsDumpToken.eof;
            case "(":
                this.ch = this.getChar();
                return mhsDumpToken.bracketleft;

            case ")":
                this.ch = this.getChar();
                return mhsDumpToken.bracketright;

            case "#":
                this.getChar()
                this.readInt()
                return mhsDumpToken.intconst
            case "\"":
                this.getChar()
                this.readString()
                this.ch = this.getChar();
                return mhsDumpToken.string

            case "=":
                this.ch = this.getChar()
                return mhsDumpToken.equals

            default:
                this.readFnName()
                if (combinators.has(this.stringVal))
                    return mhsDumpToken.comb
                return mhsDumpToken.named
        }
    }
}

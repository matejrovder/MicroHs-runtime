export enum token {
    lambda = "λ",
    bracketleft = "(", // (
    bracketright = ")", // )
    dot = ".",
    var = "var",
    eof = "eof",
    number = "number"
}

/** Lexer for lambda expressions */
export class Lexer {
    buffer: string;
    offset: number;
    varIdentifier: string = "";
    numVal: bigint = 0n;
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


    getToken(): token {
        while (/[\t\v\f ]/.test(this.ch)) {
            this.ch = this.getChar();
        }

        switch (this.ch) {
            case "\n":
            case "\r":
            case "\0":
                return token.eof;
            case "\\":
            case "λ":
                this.ch = this.getChar();
                return token.lambda;

            case "(":
                this.ch = this.getChar();
                return token.bracketleft;

            case ")":
                this.ch = this.getChar();
                return token.bracketright;

            case ".":
                this.ch = this.getChar();
                return token.dot;

            default:
                if (/\d/.test(this.ch)) {
                    this.numVal = BigInt(parseInt(this.ch));
                    this.ch = this.getChar();
                    while (/\d/.test(this.ch)) {
                        this.numVal *= 10n;
                        this.numVal += BigInt(parseInt(this.ch));
                        this.ch = this.getChar()
                    }
                    return token.number
                }

                this.varIdentifier = ""
                while (/[A-Za-z0-9+\-*/=]/.test(this.ch)) {
                    this.varIdentifier += this.ch;
                    this.ch = this.getChar();
                }
                return token.var;
        }

    }
}

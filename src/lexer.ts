export enum token {
    lambda = "λ",
    bracketleft = "(", // (
    bracketright = ")", // )
    dot = ".",
    var = "var",
    eof = "eof",
    number = "number"
}

export class Lexer {
    buffer: string;
    offset: number;
    newlineAsEof: boolean;
    varIdentifier: string = "";
    numVal: number = 0;
    ch: string;

    constructor(buffer: string, newlineAsEof: boolean = false) {
        this.newlineAsEof = newlineAsEof;
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
        while (/\s/.test(this.ch)) {
            this.ch = this.getChar();
        }

        switch (this.ch) {
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
                    this.numVal = parseInt(this.ch);
                    this.ch = this.getChar();
                    while (/\d/.test(this.ch)) {
                        this.numVal *= 10;
                        this.numVal += parseInt(this.ch);
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

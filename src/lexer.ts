export enum token {
    lambda = "λ",
    bracketleft = "(", // (
    bracketright = ")", // )
    dot = ".",
    var = "var",
    eof = "eof"
}
// type token = number;

export class Lexer {
    buffer: string;
    offset: number;
    newlineAsEof: boolean;
    varIdentifier: string = "";
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

    getChar(): string {
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
                // case "λ":
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

            case "\n":
                if (this.newlineAsEof)
                    return token.eof
            // eslint-disable-next-line no-fallthrough
            default:
                this.varIdentifier = ""
                while (/[A-Za-z]/.test(this.ch)) {
                    this.varIdentifier += this.ch;
                    this.ch = this.getChar();
                }
                return token.var;
        }

    }
}

// let lexer = new Lexer()
// let a = lexer.getToken()
// while (a != token.eof) {
//     console.log(a);
//     a = lexer.getToken()
// }
// console.log(a)

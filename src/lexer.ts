const fs = require('fs')

function getChar(): string {
  let buffer = Buffer.alloc(1)
  fs.readSync(0, buffer, 0, 1)
  return buffer.toString('utf8')
}
// fs.readLine()

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
    varIdentifier: string = "";
    ch = getChar();

    getToken(): token {
        while(/\s/.test(this.ch)) {
            this.ch = getChar();
        }

        switch (this.ch) {
            case "\0":
                return token.eof;
            case "\\":
            case "λ":
                this.ch = getChar();
                return token.lambda;
            
            case "(":
                this.ch = getChar();
                return token.bracketleft;

            case ")":
                this.ch = getChar();
                return token.bracketright;
            
            case ".":
                this.ch = getChar();
                return token.dot;

            default:
                this.varIdentifier = ""
                while (/[A-Za-z]/.test(this.ch)) {
                    this.varIdentifier += this.ch;
                    this.ch = getChar();
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

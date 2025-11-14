import { token, Lexer } from './lexer';
import { ASTNode, AbstractionNode, ApplicationNode, VariableNode, CombinatorNode, EmptyNode, makeAbstraction } from './ast'

class Parser {
    currentToken: token = token.eof;
    lexer: Lexer = new Lexer;

    constructor() {
        this.getNextToken();
    }

    getNextToken(): token {
        this.currentToken = this.lexer.getToken();
        return this.currentToken;
    }

    match(t: token) {
        if (this.currentToken !== t) {
            throw new Error("invalid token: " + this.currentToken);
        }
        this.getNextToken();
    }

    matchVariable(): VariableNode {
        if (this.currentToken !== token.var) {
            throw new Error("invalid token: " + this.currentToken);
        }
        const varName = this.lexer.varIdentifier;
        this.getNextToken();
        return new VariableNode(varName);
    }

    parse(lhs: ASTNode | null = null): ASTNode {
        switch (this.currentToken) {
            case token.bracketleft:
                {
                    this.getNextToken();
                    let rhs = this.parseBracketExpr(null);
                    if (lhs !== null) 
                        lhs = new ApplicationNode(lhs, rhs);
                    else
                        lhs = rhs
                    break;
                }
            case token.var:
                {
                    const variable = new VariableNode(this.lexer.varIdentifier);
                    if (lhs === null) {
                        lhs = variable;
                    }
                    else {
                        lhs = new ApplicationNode(lhs, variable);
                    }

                    this.getNextToken()
                    lhs = this.parse(lhs)
                    break;
                }
            case token.eof:
                if (lhs !== null)
                    return lhs;
                else throw new Error("end of file reached");
            default:
                if (lhs !== null)
                    return lhs;
                else throw new Error("invalid token: " + this.currentToken);
        }


        return this.parse(lhs);
    }


    parseBracketExpr(lhs: ASTNode | null = null): ASTNode {
        let rhs = new EmptyNode;

        switch (this.currentToken) {
            case token.lambda:
                {
                    this.getNextToken();
                    const varNode: VariableNode = this.matchVariable()
                    this.match(token.dot);
                    rhs = makeAbstraction(varNode.variable, this.parse(null));
                    break;
                }
            default: {
                rhs = this.parse(lhs);
            }
        }

        this.match(token.bracketright)
        if (lhs !== null) {
            return new ApplicationNode(lhs, rhs);
        }
        return rhs;
    }
    // parse
}

let p = new Parser();
let n = p.parse(null);
n.printTree(0);
console.log(n.expStr());

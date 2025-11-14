import { token, Lexer } from './lexer';
import { ASTNode, AbstractionNode, ApplicationNode, VariableNode, CombinatorNode, EmptyNode } from './ast'

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
                this.getNextToken();
                return this.parseBracketExpr(lhs);
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
                    return this.parse(lhs)
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


        return new EmptyNode;
    }


    parseBracketExpr(lhs: ASTNode | null = null): ASTNode {
        let retVal = new EmptyNode;

        switch (this.currentToken) {
            case token.lambda:
                {
                    this.getNextToken();
                    const varNode: VariableNode = this.matchVariable()
                    this.match(token.dot);
                    retVal = new AbstractionNode(varNode.variable, this.parse(null));
                    break;
                }
            default: {
                retVal = this.parse(lhs);
            }
        }

        this.match(token.bracketright)
        return retVal;
    }
    // parse
}

let p = new Parser();
let n = p.parse(null);
n.print(0);

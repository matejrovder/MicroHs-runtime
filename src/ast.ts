interface ASTNode {
    printTree(indent: number): void;
    expStr(): string;
}

class EmptyNode implements ASTNode {
    printTree(indent: number): void {
        throw new Error("Called print on an empty node");
    }
    expStr(): string {
        throw new Error("Called print on an empty node");
    }
}

class ApplicationNode implements ASTNode {
    lhs: ASTNode;
    rhs: ASTNode;

    constructor(lhs: ASTNode, rhs: ASTNode) {
        // super();
        this.lhs = lhs;
        this.rhs = rhs;
    }
    printTree(indent: number): void {
        let indentWhiteSpace= "";
        for (let i = 0; i < indent; i++) {
            indentWhiteSpace += "\t";
        }
        console.log(indentWhiteSpace + "Application");
        this.lhs.printTree(indent + 1);
        this.rhs.printTree(indent + 1);
    }
    expStr(): string {
        return " ( " + this.lhs.expStr() + " " + this.rhs.expStr() + " ) ";
    }
}

class AbstractionNode implements ASTNode {
    absVariable: string;
    node: ASTNode;

    constructor(absVariable: string, node: ASTNode) {
        // super();
        this.absVariable = absVariable;
        this.node = node;
    }
    printTree(indent: number): void {
        let indentWhiteSpace= "";
        for (let i = 0; i < indent; i++) {
            indentWhiteSpace += "\t";
        }
        console.log(indentWhiteSpace + "Abstraction lambda " + this.absVariable);
        this.node.printTree(indent + 1);
    }
    expStr(): string {
        return " ( λ " + this.absVariable + " . " + this.node.expStr() + " ) ";
    }
}

class VariableNode implements ASTNode {
    variable: string;

    constructor(variable: string) {
        // super();
        this.variable = variable;
    }
    printTree(indent: number): void {
        let indentWhiteSpace= "";
        for (let i = 0; i < indent; i++) {
            indentWhiteSpace += "\t";
        }
        console.log(indentWhiteSpace + this.variable);
    }
    expStr(): string {
        return this.variable;
    }
}

class CombinatorNode extends VariableNode {
    constructor(variable: string) {
        super(variable)
    }
}

export {ASTNode, AbstractionNode, ApplicationNode, VariableNode, CombinatorNode, EmptyNode};
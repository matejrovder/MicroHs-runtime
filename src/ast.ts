interface ASTNode {
    printTree(indent: number): void;
    expStr(): string;
    compileSKI(): ASTNode;
    abstract(absVariable: string): ASTNode;
}

class EmptyNode implements ASTNode {
    printTree(indent: number): void {
        throw new Error("Called print on an empty node");
    }
    expStr(): string {
        throw new Error("Called print on an empty node");
    }
    compileSKI(): ASTNode {
        throw new Error("Called compile on an empty node");
    }
    abstract(absVariable: string): ASTNode {
        throw new Error("Called abstract on an empty node");
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

    compileSKI(): ASTNode {
        return new ApplicationNode(this.lhs.compileSKI(), this.rhs.compileSKI());
    }

    abstract(absVariable: string): ASTNode {
        const lhs = new ApplicationNode(new CombinatorNode("S"), this.lhs.abstract(absVariable));
        const rhs = this.rhs.abstract(absVariable);
        return new ApplicationNode(lhs, rhs);
    }

    printTree(indent: number): void {
        let indentWhiteSpace = "";
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

    compileSKI(): ASTNode {
        return this.node.abstract(this.absVariable);
    }

    abstract(absVariable: string): ASTNode {
        return this.compileSKI().abstract(absVariable);
    }

    printTree(indent: number): void {
        let indentWhiteSpace = "";
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

    compileSKI(): ASTNode {
        return this;
    }

    abstract(absVariable: string): ASTNode {
        if (absVariable === this.variable) {
            return new CombinatorNode("I");
        }
        else {
            return new ApplicationNode(new CombinatorNode("K"), this);
        }
    }

    printTree(indent: number): void {
        let indentWhiteSpace = "";
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

export { ASTNode, AbstractionNode, ApplicationNode, VariableNode, CombinatorNode, EmptyNode };
abstract class ASTNode {
    abstract printTree(indent: number): void;
    abstract expStr(): string;
    abstract compileSKI(): ASTNode;
    abstract abstractSKI(absVariable: string): ASTNode;
    etaReduction(redVariable: string): ASTNode | null {
        return null;
    }
}

class EmptyNode extends ASTNode {
    printTree(indent: number): void {
        throw new Error("Called print on an empty node");
    }
    expStr(): string {
        throw new Error("Called print on an empty node");
    }
    compileSKI(): ASTNode {
        throw new Error("Called compile on an empty node");
    }
    abstractSKI(absVariable: string): ASTNode {
        throw new Error("Called abstract on an empty node");
    }
}

class ApplicationNode extends ASTNode {
    lhs: ASTNode;
    rhs: ASTNode;

    constructor(lhs: ASTNode, rhs: ASTNode) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
    }

    override etaReduction(redVariable: string): ASTNode | null {
        if (this.rhs instanceof VariableNode) {
            if (this.rhs.variable === redVariable) {
                return this.lhs;
            }
        }
        return null;
    }

    compileSKI(): ASTNode {
        return new ApplicationNode(this.lhs.compileSKI(), this.rhs.compileSKI());
    }

    abstractSKI(absVariable: string): ASTNode {
        let optimized = this.etaReduction(absVariable);
        if (optimized !== null)
            return optimized.compileSKI();

        const lhs = new ApplicationNode(new CombinatorNode("S"), this.lhs.abstractSKI(absVariable));
        const rhs = this.rhs.abstractSKI(absVariable);
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

class AbstractionNode extends ASTNode {
    absVariable: string;
    node: ASTNode;

    constructor(absVariable: string, node: ASTNode) {
        super();
        this.absVariable = absVariable;
        this.node = node;
    }

    compileSKI(): ASTNode {
        const optimized = this.node.etaReduction(this.absVariable);
        if (optimized !== null) {
            return optimized.compileSKI();
        }
        return this.node.abstractSKI(this.absVariable);
    }

    abstractSKI(absVariable: string): ASTNode {
        const compiled = this.compileSKI();
        const optimized = compiled.etaReduction(absVariable);
        if (optimized !== null) {
            return optimized.compileSKI();
        }

        return compiled.abstractSKI(absVariable);
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

class VariableNode extends ASTNode {
    variable: string;

    constructor(variable: string) {
        super();
        this.variable = variable;
    }

    compileSKI(): ASTNode {
        return this;
    }

    abstractSKI(absVariable: string): ASTNode {
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
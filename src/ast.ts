interface ASTNode {
    print(indent: number): void;
}

class EmptyNode implements ASTNode {
    print(indent: number): void {
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
    print(indent: number): void {
        let indentWhiteSpace= "";
        for (let i = 0; i < indent; i++) {
            indentWhiteSpace += "\t";
        }
        console.log(indentWhiteSpace + "Application");
        this.lhs.print(indent + 1);
        this.rhs.print(indent + 1);
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
    print(indent: number): void {
        let indentWhiteSpace= "";
        for (let i = 0; i < indent; i++) {
            indentWhiteSpace += "\t";
        }
        console.log(indentWhiteSpace + "Abstraction lambda " + this.absVariable);
        this.node.print(indent + 1);
    }
}

class VariableNode implements ASTNode {
    variable: string;

    constructor(variable: string) {
        // super();
        this.variable = variable;
    }
    print(indent: number): void {
        let indentWhiteSpace= "";
        for (let i = 0; i < indent; i++) {
            indentWhiteSpace += "\t";
        }
        console.log(indentWhiteSpace + this.variable);
    }
}

class CombinatorNode extends VariableNode {
    constructor(variable: string) {
        super(variable)
    }
}

export {ASTNode, AbstractionNode, ApplicationNode, VariableNode, CombinatorNode, EmptyNode};
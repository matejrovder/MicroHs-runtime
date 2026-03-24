export class ParsingError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ParsingError.prototype);
    }
}

export class EvaluationError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, EvaluationError.prototype);
    }
}

export class ProgramRaisedError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ProgramRaisedError.prototype);
    }
}

export class ParsingException extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ParsingException.prototype);
    }
}

export class EvaluationException extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, EvaluationException.prototype);
    }
}

export class ProgramRaisedException extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ProgramRaisedException.prototype);
    }
}

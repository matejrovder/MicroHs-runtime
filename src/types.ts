/**
 * @file
 * Contains definitions of types of nodes in SKI graphs,
 * helper functions and other functions concerning types.
 */


/** A wrapper for GraphN, used to 'emulate' pointers */
type Nodeptr = {
    n: GraphN
}

// Types of graph nodes

type App = {
    type: 'app';
    lhs: Nodeptr;
    rhs: Nodeptr;
}

type Const = Comb | Str | Int | FuncRef | Arr;

type Arr = {
    type: 'arr'
    array: Nodeptr[];
}

type Comb = {
    type: 'comb';
    name: string;
}

type Str = {
    type: 'str';
    value: string;
}

type Int = {
    type: 'int';
    value: bigint;
}

type FuncRef = {
    type: 'funcref';
    name: string;
}

type Pointer = {
    type: 'ptr';
    value: Nodeptr;
}

/** the Graph node type */
type GraphN = App | Const | Pointer 


// Functions to simplify graph node creation

function strConst(x: string): Const {
    return { "type": "str", "value": x }
}

function intConst(x: bigint): Const {
    return { "type": "int", "value": x }
}

function combinator(x: string): Const {
    return { "type": "comb", "name": x }
}

function app(t1: GraphN, t2: GraphN): App {
    return { "type": "app", "lhs": {n: t1}, "rhs": {n: t2} };
}

/** Takes two Nodeptr as arguments, returns an application as GraphN */
function npapp(t1: Nodeptr, t2: Nodeptr): GraphN {
    const app: App = { "type": "app", "lhs": t1, "rhs": t2 }
    return app;
}

/** Takes two Nodeptr as arguments, returns a Nodeptr containing an application */
function npappptr(t1: Nodeptr, t2: Nodeptr): Nodeptr {
    const app: App = { "type": "app", "lhs": t1, "rhs": t2 }
    return {n: app};
}

function funcref(f: string): FuncRef {
    return { "type": "funcref", "name": f };
}

// function mkIndir(np: Nodeptr): Indir {

// }

/** Creates a (Cons x xs) node */
function mkCons(x: GraphN, xs: GraphN): App {
    return app(app(combinator("O"), x), xs)
    // O - cons combinator
}

/**
 * Converts a string to Cons-Nil representation,
 * using comb. O as Cons and comb. K as Nil.
 * The reverse conversion is a member of Evaluator, because it needs
 * to call evaluate.
 */
function stringToCons(x: string): App | Const {
    let res: Const | App = combinator("K") // false/Nil combinator
    for (let i = x.length - 1; i >= 0; i--) {
        const ord = intConst(BigInt(x.charCodeAt(i)))
        res = mkCons(ord, res)
    }

    return res
}

/** Makes a Pointer node and a PointedTo object holding the given node */
function makePointer(node: GraphN): Pointer {
    if (node.type === 'ptr')
        return node;

    const pointedTo: Nodeptr = {n: node}
    return {'type': "ptr", 'value': pointedTo}
}

export { GraphN, Pointer, App, Const, Arr, Comb, Str, Int, FuncRef, Nodeptr, combinator, strConst, stringToCons,
         makePointer, intConst, app, npapp, npappptr, funcref }

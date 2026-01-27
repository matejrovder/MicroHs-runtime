import { compileSKI, expStr, SKI } from './ast'
import { Parser } from './parser'
import { evaluate, evalExpStr, stepEval } from './eval'

const fs = require('fs')

const input_lines = fs.readFileSync('/dev/stdin').toString().split('\n');

let p = new Parser(input_lines[0]);
let n = p.parse(null);
// n.printTree(0);
console.log(n);
console.log(expStr(n));

let ski = compileSKI(n);
console.log(ski);
console.log(expStr(ski));

let ev: SKI = evaluate(ski)
console.log(evalExpStr(ev))


console.log("-----Stepping through------")
// let evaluator = new Evaluator()
let [step, next] = stepEval(ski)
while (next) {
    [step, next] = stepEval(step)
    console.log(evalExpStr(step))
}
console.log("---------------------------")

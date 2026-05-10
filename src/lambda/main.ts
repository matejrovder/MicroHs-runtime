import { GraphN } from '../types'
import { compileSKI } from "./ski_compile";
import { Parser } from './parser'
import { evalExpStr, Evaluator } from './lambda_eval'
import {simpleExpString} from "./lambda_types";

const fs = require('fs')

const input_lines = fs.readFileSync('/dev/stdin').toString().split('\n');

let p = new Parser(input_lines[0]);
let n = p.parse(null);
// n.printTree(0);
console.log(n);
console.log(simpleExpString(n));

let ski = compileSKI(n);
console.log(ski);
console.log(simpleExpString(ski));

let etor = new Evaluator()
let ev: GraphN = etor.evaluate(ski)
console.log(evalExpStr(ev))


// console.log("-----Stepping through------")
// // let evaluator = new Evaluator()
// let [step, next] = stepEval(ski)
// while (next) {
//     [step, next] = stepEval(step)
//     console.log(evalExpStr(step))
// }
// console.log("---------------------------")

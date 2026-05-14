/**
 * @file
 * The program for running the lambda evaluator from console
 */

import { GraphN } from '../types'
import { compileSKI } from "./ski_compile";
import { Parser } from './parser'
import { Evaluator } from './lambda_eval'
import {simpleExpString} from "./lambda_types";

const fs = require('fs')

const input_lines = fs.readFileSync('/dev/stdin').toString().split('\n');

const parser = new Parser(input_lines[0]);
const parsed = parser.parse(null);

// console.log(parsed);
console.log("Parsed expression: " + simpleExpString(parsed));

const ski = compileSKI(parsed);
// console.log(ski);
console.log("Compiled and optimized SKI expression: " + simpleExpString(ski));

const evaluator = new Evaluator()
const evaluated: GraphN = evaluator.evaluate({n: ski})
console.log("Evaluated expression: " + evaluator.debugExpDump(evaluated, 20))

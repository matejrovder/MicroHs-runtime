import { evalExpStr, Evaluator } from "../eval"
import { MhsParser } from "./mhs_parser"

const fs = require('fs')

const input = fs.readFileSync('/dev/stdin').toString()

const [top, pointers] = new MhsParser(input).parse()
console.log(evalExpStr(top))
const evaluator = new Evaluator(pointers)
const ev = evaluator.evaluate(top)
console.log("RESULT:")
console.log(evalExpStr(ev))

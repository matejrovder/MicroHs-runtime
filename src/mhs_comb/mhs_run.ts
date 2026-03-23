import { evalExpStr, Evaluator } from "../eval"
import { MhsParser } from "./mhs_parser"

const fs = require('fs')

const input = fs.readFileSync('/dev/stdin').toString()

const [top, pointers] = new MhsParser(input).parse()
const evaluator = new Evaluator(pointers)
const ev = evaluator.execio(top)

const match = evaluator.match1("IO.return", ev)
if (match === null || match.type !== 'comb' || match.name !== 'I') {
    console.log("IO execution failure, instead of (IO.return I) got " + evalExpStr(ev))
    process.exit(1)
}

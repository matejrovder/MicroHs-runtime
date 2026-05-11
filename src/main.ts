/**
 * @file
 * Wrapper for the runtime system, supports Node.js. Accepts the path to the
 * combinator output of MicroHs as an argument.
 */

import { Evaluator } from "./mhs/mhs_eval"
import { StandardInput, StandardOutput } from "./node_tools"
import { MhsParser } from "./mhs/mhs_parser"

const fs = require('fs')

if (process.argv.length < 3) {
    console.error("Usage: node " + process.argv[1] + " <combinator file>")
    process.exit(1)
}

const input = fs.readFileSync(process.argv[2]).toString()

const top = new MhsParser(input).parse()
const evaluator = new Evaluator(new StandardOutput, new StandardInput)
const ev = evaluator.execio({n: top})

const match = evaluator.match1("IO.return", ev)
if (match === null || match.type !== 'comb' || match.name !== 'I') {
    console.log("IO execution failure, instead of (IO.return I) got " + evaluator.expStringDump(ev))
    process.exit(1)
}

import { Parser } from './parser'
import { expStr } from "../ast";
import { compileSKI } from "./ski_compile";

function test(name: string, input: string, output: string) {
    const p1 = new Parser(input)
    const compiled = compileSKI(p1.parse(null))

    const p2 = new Parser(output)
    const expected = p2.parse(null)

    if (expStr(compiled) !== expStr(expected)) {
        console.log("Test " + name + " failed.")
        console.log("Expected: " + expStr(expected))
        console.log("Actual: " + expStr(compiled))
    }
}

test("plus", "(\\ x . plus x x ) five", "S plus I five")
test("simple", "(\\ t . (\\f. t))", "K")
test("advancedEta", "(\\x.(\\y.x y x))", "S S K")
test("church0", "(\\s . (\\z. z))", "K I")
test("church1", "(\\s . (\\z. s z))", "I")
test("church2", "(\\s . (\\z. s (s z))) ", "((S ((S (K S)) K)) I)")



import { expect, test } from '@jest/globals';
import { StandardInput, StandardOutput } from "../../node_tools";
import { app, funcref, Int, intConst } from "../../types";
import { Evaluator } from "../mhs_eval";

const evaluator = new Evaluator(new StandardOutput, new StandardInput)

test("signed 2 ^ 63 wraps around", () => {
    const expr = app(app(funcref("+"), intConst(0x7FFF_FFFF_FFFF_FFFFn)), intConst(1n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int");
    expect((evaluated as Int).value < 0).toBe(true)
})

test("unsigned 2 ^ 64 wraps around", () => {
    const expr = app(app(funcref("u+"), intConst(0xFFFF_FFFF_FFFF_FFFFn)), intConst(1n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int");
    expect((evaluated as Int).value).toBe(0n)
})

test("1 << 33", () => {
    const expr = app(app(funcref("shl"), intConst(1n)), intConst(33n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int");
    expect((evaluated as Int).value).toBe(8589934592n)
})

test("shr by 1", () => {
    const expr = app(app(funcref("shr"), intConst(0x8000_0000_0000_0000n)), intConst(1n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int")
    expect((evaluated as Int).value).toBe(0x4000_0000_0000_0000n)
})

test("ashr keep MSB set", () => {
    const expr = app(app(funcref("ashr"), intConst(0x8000_0000_0000_0000n)), intConst(1n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int")
    expect((evaluated as Int).value).toBe(0xC000_0000_0000_0000n)
})

test("shl wraps around at 64 bits", () => {
    const expr = app(app(funcref("shl"), intConst(0x8000_0000_0000_0000n)), intConst(1n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int")
    expect((evaluated as Int).value).toBe(0n)
})

test("shl by 64 zeroes the value", () => {
    const expr = app(app(funcref("shl"), intConst(1n)), intConst(64n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int")
    expect((evaluated as Int).value).toBe(0n)
})

test("shr on 0xFFFF_FFFF_FFFF_FFFF", () => {
    const expr = app(app(funcref("shr"), intConst(0xFFFF_FFFF_FFFF_FFFFn)), intConst(1n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int")
    expect((evaluated as Int).value).toBe(0x7FFF_FFFF_FFFF_FFFFn)
})

test("ashr on 1", () => {
    const expr = app(app(funcref("ashr"), intConst(1n)), intConst(1n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int")
    expect((evaluated as Int).value).toBe(0n)
})

test("ashr of 0x8000_0000_0000_0000 by 64 yields 0xFFFF_FFFF_FFFF_FFFF", () => {
    const expr = app(app(funcref("ashr"), intConst(0x8000_0000_0000_0000n)), intConst(64n))
    const evaluated = evaluator.evaluate(expr)

    expect(evaluated.type).toBe("int")
    expect((evaluated as Int).value).toBe(0xFFFF_FFFF_FFFF_FFFFn)
})

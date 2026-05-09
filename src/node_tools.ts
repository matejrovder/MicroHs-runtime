import { Input, Output } from "./mhs/mhs_eval"
const readline = require('readline')
const fs = require('fs')

export class StandardOutput implements Output {
    print(str: string): void {
        process.stdout.write(str)
    }
    println(str: string): void {
        process.stdout.write(str)
        process.stdout.write("\n")
    }
}

export class StandardInput implements Input {
    getChar(): string {
        const buffer = Buffer.alloc(1)
        fs.readSync(0, buffer, 0, 1)
        const str = buffer.toString('utf8')
        if (str.length !== 1)
            throw new Error("standard input error")
        return str
    }
}
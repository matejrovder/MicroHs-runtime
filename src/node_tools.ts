import { Output } from "./eval"

export class StandardOutput implements Output {
    print(str: string): void {
        process.stdout.write(str)
    }
    println(str: string): void {
        process.stdout.write(str)
        process.stdout.write("\n")
    }
}

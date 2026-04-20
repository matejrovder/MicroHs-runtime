## Simple runtime for MicroHs
This runtime supports combinator files from the [MicroHs](https://github.com/augustss/MicroHs) Haskell compiler. After compilation with output file extension .comb (`mhs ... -o filename.comb`), start the runtime with command: 
`node dist/mhs/mhs_run.js filename.comb`

## Lambda expression compiler
You can run `node dist/lambda/main.js` and enter a lambda expression (followed by enter and Ctrl-D/EOF symbol) which will then be eta-reduced, compiled to SKI combinators and evaluated.

--------------
## Compilation
Node.js and npm is required, run `npm install` to install required packages and `tsc` to compile the TypeScript files to JavaScript files, which can be run using Node.

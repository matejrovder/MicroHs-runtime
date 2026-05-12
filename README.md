## Simple runtime for MicroHs
This runtime supports combinator files from the [MicroHs](https://github.com/augustss/MicroHs) Haskell compiler. After compilation with output file extension .comb (`mhs ... -o filename.comb`), start the runtime with command: 
`node dist/main.js filename.comb`

## Lambda expression compiler
You can run `node dist/lambda/main.js` and enter a lambda expression (followed by enter and Ctrl-D/EOF symbol) which will then be eta-reduced, compiled to SKI combinators and evaluated.

--------------
## Compilation
Node.js and npm is required, run `npm install` to install required packages and `npm run build` to compile the TypeScript files to JavaScript files, which can be run using Node.

<img src="https://fit.cvut.cz/static/images/fit-cvut-logo-en.svg" alt="FIT CTU logo" height="200">

This software was developed with the support of the **Faculty of Information Technology, Czech Technical University in Prague**.
For more information, visit [fit.cvut.cz](https://fit.cvut.cz).

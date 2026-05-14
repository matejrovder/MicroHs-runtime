# A simple TypeScript runtime for MicroHs
This runtime supports combinator files from the [MicroHs](https://github.com/augustss/MicroHs) Haskell compiler. 

### Requirements:
- Node.js & npm
- [MicroHs](https://github.com/augustss/MicroHs) for compiling Haskell to .comb files, supported by this runtime
    - the most recent MicroHs versions are not supported yet (it requires support for new combinators), recommended
      version is v0.14.27.0, git commit hash: `7120b95c11023fea1d5b82ed7a10e2f5709b93ac`.

### Compilation
- `npm install` to install dependencies, alternatively `npm install --production` installs only a minimal set of packages
- `npm run build` or `npx tsc` builds the program into `dist/`

### Usage
- Use MicroHs to compile Haskell programs into a combinator file (.comb):\
`mhs ... -o filename.comb`
- Run the program with the command:\
`node dist/main.js filename.comb`

### Testing
Compile the runtime first, using `npm run build`.

Run `./test.sh` to test. 

This test script first compiles the programs in the `tests` folder to combinator files using MicroHs and creates reference outputs using MicroHs or GHC, depending on the variable `REFHS` set in the script. The script uses timestamps to recompile and recreate reference outputs only when needed.

The tests are then run. If some of the test fail, the remaining tests are run anyway, but the script returns exit code 1.
- to ensure that all test cases are freshly compiled, run:\
`rm -f tests/combinators/* tests/*_out.txt`
- to run the tests, run:\
`./test.sh`
- to skip the compilation of combinator files and creation of reference outputs, run:\
`TEST_ONLY=1 ./test.sh`

The name of each test program must start with an uppercase letter and must contain no spaces. If the name of the program is `<Name>.hs`, the program should start with the line `module <Name> where`, the reference output file created will be named `<Name>_out.txt`. Additionally, if a file named `<Name>_in.txt` exists, its contents are piped to the program's standard input for the test.


## Lambda expression evaluator
A simple evaluator for lambda expressions is included. It compiles the entered lambda expression to SKI (including optimization) and evaluates it lazily (call-by-need reduction).

`node dist/lambda/main.js` accepts a lambda expression on its standard output (end with Ctrl-D / EOF symbol).

An example in Bash:

`node dist/lambda/main.js <<< 'Y (\f. (\x . = x 0 1 (* (f (- x 1)) x) ) ) 6'`

This calculates the factorial of 6.

Use `./lambda_test.sh` to run some tests of the lambda evaluator (lambda_tests directory). The test script ignores the first two lines of the evaluator output, which are the parsed expression and the expression after conversion to SKI combinators, the rest of the output is compared to the reference output.

------------------------------------------------------------------------------------
<img src="https://fit.cvut.cz/static/images/fit-cvut-logo-en.svg" alt="FIT CTU logo" height="200">

This software was developed with the support of the **Faculty of Information Technology, Czech Technical University in Prague**.
For more information, visit [fit.cvut.cz](https://fit.cvut.cz).

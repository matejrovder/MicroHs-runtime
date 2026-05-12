#!/bin/bash
TESTFOLDER=tests
COMBFOLDER=tests/combinators
NODE=node
MHS=mhs

# change this to either 'mhs' or 'ghc'
# ghc is much faster
REFHS=ghc

PROGRAM="dist/main.js"
SUFFIX=_out.txt
IN_SUFFIX=_in.txt
TO=$TEST_ONLY # if TEST_ONLY is 1, we skip creating ref. output and compilation
EXIT_STATUS=0

set -uo pipefail


if [[ $TO -ne 1 ]]; then
    # compile tests to .comb files
    $MHS --version > /dev/null || { echo "$MHS not found"; exit 1; }

    mkdir -p "${COMBFOLDER}"

    for i in $(find "$TESTFOLDER" -maxdepth 1 -name '*.hs' -exec basename -s .hs {} \;) ; do
        COMBFILE="${COMBFOLDER}/${i}.comb"
        PROGFILE="${TESTFOLDER}"/"${i}".hs
        if [ ! -f "$COMBFILE" ] || [ $0 -nt "$COMBFILE" ] || [ "$PROGFILE" -nt "$COMBFILE" ] ; then
            echo "$MHS ${PROGFILE} -o ${COMBFILE}"
            $MHS "${PROGFILE}" -o "${COMBFILE}"
        fi
    done


    # use $REFHS: mhs or ghc to compile tests and create reference output
    $REFHS --version > /dev/null || { echo "$REFHS not found"; exit 1; }

    for i in $(find "$TESTFOLDER" -maxdepth 1 -name '*.hs' -exec basename -s .hs {} \;) ; do
        IOUT="${TESTFOLDER}/${i}${SUFFIX}"
        IPROG="${TESTFOLDER}"/"${i}".hs
        INFILE="${TESTFOLDER}"/"${i}${IN_SUFFIX}"
        if [ ! -f "$IOUT" ] || [ "$0" -nt "$IOUT" ] || [ "$IPROG" -nt "$IOUT" ] ; then
            if [ "$REFHS" == "ghc" ]; then
                # ghc requires us to specify which module contains main
                $REFHS -main-is "${i}" "${IPROG}" -o tmpout
            else
                echo "$REFHS ${IPROG} -o tmpout"
                $REFHS "${IPROG}" -o tmpout
            fi
            if [ -f "$INFILE" ]; then
                ./tmpout < "$INFILE" > "${IOUT}"
            else
                ./tmpout > "${IOUT}"
            fi
            [ "$REFHS" == "ghc" ] && rm "${TESTFOLDER}/${i}".{hi,o}
            rm tmpout
        fi
    done
fi

$NODE --version > /dev/null || { echo "$NODE not found"; exit 1; }
[ -f "$PROGRAM" ] || { echo "$PROGRAM not found, run 'npm run build'"; exit 1; }

if TMPFILE="$(mktemp)"; then
    trap 'rm -f "$TMPFILE"' EXIT
else
    TMPFILE="tmp.txt"
fi

# runs the tests
for i in $(find "$TESTFOLDER" -name '*.hs' -exec basename -s .hs {} \;) ; do
    COMBFILE="${COMBFOLDER}"/"${i}".comb

    if [ ! -f "$COMBFILE" ]; then
        echo "${COMBFILE} not found"
        EXIT_STATUS=1
        continue
    fi

    INFILE="${TESTFOLDER}"/"${i}${IN_SUFFIX}"
    if [ -f "$INFILE" ]; then
        "$NODE" "$PROGRAM" "$COMBFILE" < "$INFILE" > "$TMPFILE"
    else
        "$NODE" "$PROGRAM" "$COMBFILE" <<< "" > "$TMPFILE"
    fi

    if diff "$TMPFILE" "${TESTFOLDER}/${i}${SUFFIX}"; then
        echo "${i} success"
    else 
        echo "${i} failure"
        EXIT_STATUS=1
    fi
done

exit "$EXIT_STATUS"

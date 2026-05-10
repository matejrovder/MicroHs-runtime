#!/bin/bash
TESTFOLDER=tests
COMBFOLDER=tests/combinators
NODE=node
PROGRAM="dist/main.js"
SUFFIX=_out.txt
IN_SUFFIX=_in.txt

EXIT_STATUS=0

if TMPFILE="$(mktemp)"; then
    trap 'rm -f "$TMPFILE"' EXIT
else
    TMPFILE="tmp.txt"
fi

for i in $(find "$TESTFOLDER" -name '*.hs' -exec basename -s .hs {} \;) ; do
    COMBFILE="${COMBFOLDER}"/"${i}".comb

    if [ ! -f $COMBFILE ]; then
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

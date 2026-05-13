#!/bin/bash
TESTFOLDER=lambda_tests
NODE=node
PROGRAM="dist/lambda/main.js"
EXIT_STATUS=0

$NODE --version > /dev/null || { echo "$NODE not found"; exit 1; }
[ -f "$PROGRAM" ] || { echo "$PROGRAM not found, run 'npm run build'"; exit 1; }

if TMPFILE="$(mktemp)"; then
    trap 'rm -f "$TMPFILE"' EXIT
else
    TMPFILE="tmp.txt"
fi

for i in "${TESTFOLDER}"/*_in*; do
    number=$(echo "$i" | grep -E -o "[0-9]{2}")
    
    $NODE "$PROGRAM" < "$i" | tail -n +3 > "$TMPFILE"

    if diff "$TMPFILE" "${TESTFOLDER}/${number}_out.txt"; then
        echo "${i} success"
    else 
        echo "${i} failure"
        EXIT_STATUS=1
    fi
done

exit "$EXIT_STATUS"

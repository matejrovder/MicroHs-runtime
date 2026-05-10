#!/bin/bash
set -euo pipefail

TESTFOLDER=tests
COMBFOLDER=tests/combinators
MHS=mhs

$MHS --version > /dev/null || { echo "$MHS not found"; exit 1; }

mkdir -p "${COMBFOLDER}"

for i in $(find "$TESTFOLDER" -maxdepth 1 -name '*.hs' -exec basename -s .hs {} \;) ; do
    COMBFILE="${COMBFOLDER}/${i}.comb"
    PROGFILE="${TESTFOLDER}"/"${i}".hs
    if [ ! -f "$COMBFILE" ] || [ $0 -nt "$COMBFILE" ] || [ "$PROGFILE" -nt "$COMBFILE" ] ; then
        $MHS "${PROGFILE}" -o "${COMBFILE}"
    fi
done

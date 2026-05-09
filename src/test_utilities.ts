/**
 * @file
 * Functions to be used in unit tests.
 */

import { GraphN } from "./types"

export function equalTerms(term1: GraphN, term2: GraphN): boolean {
    if (term1 === term2)
        return true
    if (term1.type !== term2.type)
        return false

    switch (term1.type) {
        case "numref":
            return term1.value === (term2 as typeof term1).value
        case "ptr": {
            const t2 = term2 as typeof term1
            return term1.value === t2.value || equalTerms(term1.value.term, t2.value.term)
        }
        case "comb":
        case "funcref":
            return term1.name === (term2 as typeof term1).name
        case "str":
        case "int":
            return term1.value === (term2 as typeof term1).value
        case "app":
            return equalTerms(term1.lhs, (term2 as typeof term1).lhs) && equalTerms(term1.rhs, (term2 as typeof term1).rhs)
        case "arr": {
            const t2 = term2 as typeof term1
            if (term1.array === t2.array)
                return true
            return term1.array.length === t2.array.length &&
                term1.array.every((value, index) => value === t2.array[index])
        }
    }
}

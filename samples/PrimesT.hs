module PrimesT where

-- David Turner's primes list
-- https://wiki.haskell.org/Prime_numbers
primes =
    sieve [2..]
  where
    sieve (p:xs) = p : sieve [x | x <- xs, rem x p > 0]

main = print $ take 500 primes

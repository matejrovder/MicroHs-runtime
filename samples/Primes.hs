module Primes where

primes =
    sieve [2..]
  where
    sieve (p:xs) = p : sieve [x | x <- xs, rem x p > 0]

main = print $ take 500 primes

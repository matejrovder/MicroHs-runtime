module FibList where

fiblist :: [Int]
fiblist = 1 : 1 : zipWith (+) fiblist (tail fiblist)

main = print $ take 30 fiblist

module Lsum where

xfoldr :: (a -> b -> b) -> b -> [a] -> b
xfoldr f z list = case list of
    [] -> z
    (a : tl) -> f a (xfoldr f z tl)

range :: Int -> [Int] -> [Int]
range 0 acc = acc
range x acc = range (x - 1) (x : acc)

lsum_rec :: [Int] -> Int -> Int
lsum_rec [] x = x
lsum_rec (head : tail) x = 
    let 
        sum = x + head
    in
        (lsum_rec tail sum)
        -- seq (sum) (lsum_rec tail sum)

lsum :: [Int] -> Int
lsum list = lsum_rec list 0


main :: IO()
main = print (lsum (range 500 []))

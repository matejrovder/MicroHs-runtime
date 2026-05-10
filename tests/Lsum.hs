module Lsum where

-- Definition of lists and trees, as in the seminars/lectures
data List a = Nil | Cons a (List a)
              deriving (Show)

xfoldr :: (a -> b -> b) -> b -> List a -> b
xfoldr f z list = case list of
    Nil -> z
    Cons a tl -> f a (xfoldr f z tl)

range :: Int -> List Int -> List Int
range 0 acc = acc
range x acc = range (x - 1) (Cons x acc)

lsum_rec :: List Int -> Int -> Int
lsum_rec Nil x = x
lsum_rec (Cons head tail) x = 
    let 
        sum = x + head
    in
        (lsum_rec tail sum)
        -- seq (sum) (lsum_rec tail sum)

lsum :: List Int -> Int
lsum list = lsum_rec list 0


main :: IO()
main = print (lsum (range 500 Nil))

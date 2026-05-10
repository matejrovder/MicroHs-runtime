module Factrange where

fact :: Int -> Int
fact 0 = 1
fact x = x * fact (x - 1)

data List a = Nil | Cons a (List a)
              deriving (Show)

-- Basic HOFs on lists 
xmap :: (a -> b) -> List a -> List b
xmap f list = case list of
    Nil -> Nil
    Cons a tl -> Cons (f a) (xmap f tl)


range :: Int -> List Int -> List Int
range 0 acc = acc
range x acc = range (x - 1) (Cons x acc)

main :: IO()
main = do
    print (xmap fact (range 10 Nil))

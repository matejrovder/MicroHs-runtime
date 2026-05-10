module Listy where

data L = N | C Int L
    deriving Show

sq :: Int -> L
sq 0 = N
sq n = C n (sq (n-1))

ln :: L -> Int
ln N = 0
ln (C _ l) = 1 + (ln l)

inf :: L
inf = C 1 inf

tk :: Int -> L -> L
tk 0 _ = N
tk _ N = N
tk n (C i l) = C i (tk (n-1) l)


main = do
    print (tk 12 inf)
    print (take 10 [1..100])
    print (take 10 [1,2,3,4,5,6,7,8,9,10,11,12])
    
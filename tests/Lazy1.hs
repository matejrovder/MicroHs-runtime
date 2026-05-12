module Lazy1 where

data L = N | C Int L
    deriving Show

-- returns an infinite list (L) of ones
inf :: L
inf = C 1 inf

-- takes first n members of list
tk :: Int -> L -> L
tk 0 _ = N
tk _ N = N
tk n (C i l) = C i (tk (n-1) l)

main = do
    print (tk 12 inf)
    
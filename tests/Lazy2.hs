module Lazy2 where
import System.IO.Unsafe

data L = N | C Int L
    deriving Show

-- prints "side effect" and returns its argument
sideEffect :: Int -> Int
sideEffect n = unsafePerformIO (putStrLn "side effect" >> pure n)

-- returns a list of (sideEffect i) for i in n..1
rangeRev :: Int -> L
rangeRev 0 = N
rangeRev n = C (sideEffect n) (rangeRev (n-1))

-- takes first n members of list
tk :: Int -> L -> L
tk 0 _ = N
tk _ N = N
tk n (C i l) = C i (tk (n-1) l)

-- returns sum of a list
lsum :: L -> Int
lsum N = 0
lsum (C i l) = i + (lsum l)

main :: IO()
main = let
        nums = (tk 3 (rangeRev 10))
        in
            do
                print $ lsum nums -- 10 + 9 + 8 = 27
                print $ lsum nums

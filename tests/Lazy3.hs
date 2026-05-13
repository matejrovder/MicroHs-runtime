module Lazy3 where

import System.IO.Unsafe

trace :: String -> a -> a
trace s a = unsafePerformIO (putStrLn s >> pure a)

test1 :: Int -> Int
test1 n =
    let
        m = trace "hi" n
    in
        m + m

test2 :: Int -> Int
test2 n =
    let
        bin n | trace ("bin: " ++ show n) False = undefined
              | n == 0     = 0
              | otherwise  =
                 let
                    rec = bin (n-1)
                 in
                    rec + rec + 1
    in
        bin n

test3 :: Int -> Int
test3 n =
    let
        ignoreFst x y = y
    in
        ignoreFst (trace "do not touch" (-n)) n


main = do
    print $ test1 5
    -- Expected output:
    --   hi
    --   10

    putStrLn ""

    print $ test2 5
    -- Expected output:
    --   bin: 5
    --   bin: 4
    --   bin: 3
    --   bin: 2
    --   bin: 1
    --   bin: 0
    --   31

    putStrLn ""

    print $ test3 5
    -- Expected output:
    --   5

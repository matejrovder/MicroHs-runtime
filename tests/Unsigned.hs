module Unsigned where

import Data.Word

main :: IO ()
main = do
    let x :: Word64
        x = maxBound  -- 2^64 - 1

    let y = x + 1
    if y > 0 then
        putStrLn "> 0"
    else
        putStrLn "<= 0"
    
    print y

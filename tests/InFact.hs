module InFact where

fact :: Int -> Int
fact 0 = 1
fact x = x * fact (x - 1)

main :: IO()
main = do
    putStrLn "Input a number"
    x <- getLine
    print (fact (read x))

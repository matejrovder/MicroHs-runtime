module InFib where
import Prelude

fib :: Int -> Int
fib 0 = 1
fib 1 = 1
fib n = fib (n - 1) + fib (n - 2)

main :: IO()
main = do
    x <- getLine
    print (fib (read x))

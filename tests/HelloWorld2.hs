module HelloWorld2(main) where
import Prelude

main :: IO()
main = putStrLn "Hi" >> putStrLn "Hello"

-- from PPA course at FIT CTU in Prague

module TypeClass where
import Data.List

data T = A | B | C deriving Show

instance Eq T where
    (==) x y = case (x,y) of
        (A,A) -> True
        (B,B) -> True
        (C,C) -> True
        _     -> False

instance Ord T where
    (<=) x y = case (x,y) of
        (A,_) -> True
        (B,B) -> True
        (_,C) -> True
        _     -> False


main :: IO()
main = do
    print $ sort [B, C, A, C]

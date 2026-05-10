module Functions where
import Prelude hiding
    (drop, elem, filter, foldl, foldl', foldr1, foldl1, foldr, maximum, minimum, product, until, init, (!!), and, or, any, all, concat, concatMap, scanl, scanl1, scanr, scanr1, iterate, repeat, replicate, cycle, head, last, length, null, takeWhile, dropWhile, span, break, splitAt, notElem, lookup, map, product, reverse, splitAt, sum, tail, take, words, zipWith, zip, zip3, zipWith3, unzip, unzip3)


-- Definition of lists and trees, as in the seminars/lectures
data List a = Nil | Cons a (List a)
              deriving (Show)

data Tree a = Empty | Node a (Tree a) (Tree a)
              deriving (Show, Eq)


-- Definitions of Point and Move types, needed for tasks: 1, 2, 3
data Point = Coordinates Int Int
             deriving (Show, Eq)

data Move = NoMove | North Int | South Int | West Int | East Int
            deriving (Show, Eq)

-- Definition of the direction type, needed for task 4
data Decision = L | R | S
                deriving (Show, Eq)

-- Definition of Rose Trees, needed for tasks 6, 7, 8, 9, 10
data RTree a = RNode a (List (RTree a))
               deriving (Show)


-- Basic HOFs on lists 
map :: (a -> b) -> List a -> List b
map f list = case list of
    Nil -> Nil
    Cons a tl -> Cons (f a) (map f tl)

filter :: (a -> Bool) -> List a -> List a
filter p list = case list of
    Nil -> Nil
    Cons a tl ->
        if p a then Cons a (filter p tl)
               else filter p tl

foldr :: (a -> b -> b) -> b -> List a -> b
foldr f z list = case list of
    Nil -> z
    Cons a tl -> f a (foldr f z tl)

foldl :: (b -> a -> b) -> b -> List a -> b
foldl f z list = case list of
    Nil -> z
    Cons a tl -> foldl f (f z a) tl


-- Task 1
movePoint :: Point -> Move -> Point
movePoint point NoMove = point
movePoint (Coordinates x y) move =
    case move of
        North m -> Coordinates x (y + m)
        South m -> Coordinates x (y - m)
        West m -> Coordinates (x - m) y
        East m -> Coordinates (x + m) y



-- Task 2
movePointList :: Point -> List Move -> Point
movePointList point Nil = point
movePointList point (Cons head tail) =
    movePointList (movePoint point head) tail


-- Task 3
optimizeMoves :: List Move -> List Move
optimizeMoves list = optimizeMovesAcc list NoMove

optimizeMovesAcc :: List Move -> Move -> List Move
optimizeMovesAcc Nil NoMove = Nil
optimizeMovesAcc Nil acc = Cons acc Nil
optimizeMovesAcc (Cons NoMove tail) acc = optimizeMovesAcc tail acc
optimizeMovesAcc (Cons move tail) acc =
    case (move, acc) of
        (North m1, North m2) -> optimizeMovesAcc tail (North (m1 + m2))
        (South m1, South m2) -> optimizeMovesAcc tail (South (m1 + m2))
        (East m1, East m2)   -> optimizeMovesAcc tail (East (m1 + m2))
        (West m1, West m2)   -> optimizeMovesAcc tail (West (m1 + m2))
        (move, NoMove) -> optimizeMovesAcc tail move
        (move, acc) -> Cons acc (optimizeMovesAcc tail move)



-- Task 4
trace :: Ord a => a -> Tree a -> List Decision
trace _ Empty = Nil
trace elem (Node x left right) =
    if elem == x then Cons S Nil
    else if elem < x then Cons L (trace elem left)
    else Cons R (trace elem right)


maxNum :: Int -> Int -> Int
maxNum x y
    | x <= y = y
    | otherwise = x

-- Task 5
balancedHeight :: Tree a -> Maybe Int
balancedHeight Empty = Just 0
balancedHeight (Node _ left right) =
    let l = balancedHeight left
        r = balancedHeight right
        in
            case (l, r) of
                (Just x, Just y) -> if abs (x - y) <= 1
                                        then Just (1 + maxNum x y)
                                        else Nothing
                _ -> Nothing


-- Task 6
rsum :: RTree Int -> Int
rsum (RNode x Nil) = x
rsum (RNode x list) =
    foldl (+) x (map (rsum) list)


-- Task 7
rmap :: (a -> b) -> RTree a -> RTree b
rmap f (RNode x list) = RNode (f x) (rmapList f list)

rmapList :: (a -> b) -> List (RTree a) -> List (RTree b)
rmapList f Nil = Nil
rmapList f (Cons tree tail) = Cons (rmap f tree) (rmapList f tail)


-- Task 8
eq :: RTree Int -> RTree Int -> Bool
eq (RNode x Nil) (RNode y Nil) = x == y
eq (RNode x list1) (RNode y list2) =
    x == y && treeListEq list1 list2

treeListEq :: List (RTree Int) -> List (RTree Int) -> Bool
treeListEq (Cons x tail1) (Cons y tail2) =
    eq x y && treeListEq tail1 tail2
treeListEq Nil Nil = True
treeListEq _ _ = False


main :: IO()
main = do
    print (trace 2 (Node 1 Empty Empty))
    print (movePoint (Coordinates 0 0) (West 10))
    print (movePointList (Coordinates 0 0) (Cons (North 10) (Cons (East 10) Nil)))
    print (optimizeMoves (Cons (East 10) (Cons NoMove (Cons (East 5) Nil))))
    print (trace 2 (Node 1 Empty (Node 3 (Node 2 Empty Empty) Empty)))
    print (let t = (RNode 1 (Cons (RNode 2 (Cons (RNode 4 Nil) (Cons (RNode 3 Nil) Nil))) Nil)) in eq t t)
    print (balancedHeight (Node 0 (Node 0 Empty Empty) (Node (-1) Empty Empty)))
    print (rsum (RNode 4 (Cons (RNode 2 (Cons (RNode 3 Nil) Nil)) Nil)))

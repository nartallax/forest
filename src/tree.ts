/** A tree with arbitrary number of children */
export type Tree<T, B> = TreeLeaf<T> | TreeBranch<T, B>

/** Tree leaf is a type of tree that will never have any children and only consists of a value. */
export type TreeLeaf<T> = {
	readonly value: T
}

/** Tree branch is a type of tree can have arbitrary number of children. */
export type TreeBranch<T, B> = {
	readonly value: B
	readonly children: readonly Tree<T, B>[]
}

export const isTreeBranch = <T, B>(x: Tree<T, B>): x is TreeBranch<T, B> => "children" in x

/** Forest path is a sequence of indices (first being root) that point to some element in tree */
export type ForestPath = readonly number[]

export const areForestPathsEqual = (a: ForestPath, b: ForestPath): boolean => {
	if(a.length !== b.length){
		return false
	}
	// we are starting comparing from the leaf
	// because a lot of tree paths will have similar starts
	// but probably not many of them will end the same even when starting the same
	// so it should help to find difference faster, on average
	for(let i = a.length - 1; i >= 0; i--){
		if(a[i] !== b[i]){
			return false
		}
	}
	return true
}
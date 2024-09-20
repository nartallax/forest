export type Tree<T, B> = TreeLeaf<T> | TreeBranch<T, B>

export interface TreeLeaf<T>{
	value: T
}

export interface TreeBranch<T, B>{
	value: B
	children: Tree<T, B>[]
}

export function isTreeBranch<T, B>(x: Tree<T, B>): x is TreeBranch<T, B> {
	return "children" in x
}

/** Forest path is a sequence of indices (first being root) that point to some element in tree */
export type ForestPath = readonly number[]
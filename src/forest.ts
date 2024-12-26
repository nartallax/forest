import {ForestPath, isTreeBranch, Tree, TreeBranch, TreeLeaf} from "tree"
import {nonNull} from "utils"

type Comparator<T, B> = (a: Tree<T, B>, b: Tree<T, B>) => number

/** Forest is an immutable structure representing a set of trees */
export class Forest<T, B> {
	constructor(readonly trees: readonly Tree<T, B>[]) {}

	/** Get all tree nodes that are in this forest (nested too) */
	getAllTrees(): IterableIterator<[Tree<T, B>, ForestPath]> {
		return this.getTreeNodesInternal(this.trees, () => true)
	}

	/** Get all leaf values from this forest, with their respective paths */
	* getLeavesWithPaths(): IterableIterator<[T, ForestPath]> {
		for(const [leaf, path] of this.getTreeNodesInternal(this.trees, (tree): tree is TreeLeaf<T> => !isTreeBranch(tree))){
			yield[leaf.value, path]
		}
	}

	/** Get all leaf values from this forest */
	* getLeaves(): IterableIterator<T> {
		for(const [value] of this.getLeavesWithPaths()){
			yield value
		}
	}

	/** Get all branch values from this forest, with their respective paths */
	* getBranchesWithPath(): IterableIterator<[B, ForestPath]> {
		for(const [branch, path] of this.getTreeNodesInternal(this.trees, isTreeBranch)){
			yield[branch.value, path]
		}
	}

	/** Get all branch values from this forest */
	* getBranches(): IterableIterator<B> {
		for(const [value] of this.getBranchesWithPath()){
			yield value
		}
	}

	/** Given a predicate, find a tree node that matches it and return its path
	Will check all the nodes in the forest */
	findPathByTree(isThisIt: (tree: Tree<T, B>) => boolean): ForestPath | null {
		for(const [, path] of this.getTreeNodesInternal(this.trees, isThisIt)){
			return path
		}
		return null
	}

	/** Given a predicate, find a value that matches it and return its path
	Will check all the values in the forest */
	findPath(isThisIt: (value: T | B) => boolean): ForestPath | null {
		return this.findPathByTree(tree => isThisIt(tree.value))
	}

	/** Given a predicate, find a value that matches it and return it */
	find(isThisIs: (value: T | B) => boolean): T | B | null {
		let result: T | B | null = null
		this.findPath(value => {
			if(isThisIs(value)){
				result = value
				return true
			}
			return false
		})
		return result
	}

	/** Get value of the first leaf in the forest */
	getFirstLeaf(): T | null {
		for(const [value] of this.getLeavesWithPaths()){
			return value
		}
		return null
	}

	/** Get path to the first leaf in the forest */
	getFirstLeafPath(): ForestPath | null {
		for(const [,path] of this.getLeavesWithPaths()){
			return path
		}
		return null
	}

	/** Drop nodes with values that do not match the predicate. Will create a new forest. */
	filter(shouldKeep: (value: T | B, path: ForestPath) => boolean): Forest<T, B> {
		return new Forest(this.filterInternal(this.trees, (tree, path) => shouldKeep(tree.value, path)))
	}

	/** Drop all the nodes that do not match the predicate. Will create a new forest. */
	filterTrees(shouldKeep: (tree: Tree<T, B>, path: ForestPath) => boolean): Forest<T, B> {
		return new Forest(this.filterInternal(this.trees, shouldKeep))
	}

	/** Drop all leaves with values that do not match the predicate. Will create a new forest.
	@param dropEmptyBranches if true, will remove all the branches that have no children. Leaves are removed first, then branches are maybe removed.  */
	filterLeaves(shouldKeep: (value: T, path: ForestPath) => boolean, dropEmptyBranches = false): Forest<T, B> {
		return this.filterTrees((tree, path) => {
			if(isTreeBranch(tree)){
				return tree.children.length > 0 || !dropEmptyBranches
			} else {
				return shouldKeep(tree.value, path)
			}
		})
	}

	/** Change every single value in the forest using two provided functions. Will create a new forest. */
	map<TT, BB>(
		mapLeaf: (value: T, path: ForestPath) => TT,
		mapBranch: (value: B, path: ForestPath) => BB
	): Forest<TT, BB>
	map<TT>(
		mapLeaf: (value: T, path: ForestPath) => TT,
	): Forest<TT, B>
	map<TT, BB>(
		mapLeaf: (value: T, path: ForestPath) => TT,
		mapBranch?: (value: B, path: ForestPath) => BB
	): Forest<TT, BB> {
		return new Forest(this.mapInternal(this.trees, mapLeaf, mapBranch ?? (value => value as unknown as BB)))
	}

	/** Resolve a path to tree node. */
	getTreeAt(path: ForestPath): Tree<T, B> {
		return this.pathToTrees(path)[path.length - 1]!
	}

	getTreesAt(path: ForestPath, amount: number): readonly Tree<T, B>[] {
		if(path.length === 0){
			return []
		}
		let trees: readonly Tree<T, B>[]
		if(path.length === 1){
			trees = this.trees
		} else {
			const parent = this.getTreeAt(path.slice(0, path.length - 1))
			if(!isTreeBranch(parent)){
				throw errorNotBranch()
			}
			trees = parent.children
		}
		const start = path[path.length - 1]!
		return trees.slice(start, start + amount)
	}

	/** Resolve a path to leaf node. Throws if not leaf. */
	getLeafTreeAt(path: ForestPath): TreeLeaf<T> {
		const tree = this.getTreeAt(path)

		if(isTreeBranch(tree)){
			throw errorNotLeaf()
		}

		return tree
	}

	/** Resolve a path to leaf value. */
	getLeafAt(path: ForestPath): T {
		return this.getLeafTreeAt(path).value
	}

	/** Resolve a path to branch node. Throws if not branch. */
	getBranchTreeAt(path: ForestPath): TreeBranch<T, B> {
		const tree = this.getTreeAt(path)

		if(!isTreeBranch(tree)){
			throw errorNotBranch()
		}

		return tree
	}

	/** Resolve a path to branch value. */
	getBranchAt(path: ForestPath): B {
		return this.getBranchTreeAt(path).value
	}

	/** Update tree node at given path. Will create a new forest. */
	updateTreeAt(path: ForestPath, updater: (tree: Tree<T, B>) => Tree<T, B>, comparator?: Comparator<T, B>): Forest<T, B> {
		return new Forest(this.updateInternal(this.trees, path, updater, comparator))
	}

	/** Update leaf value at given path. Will create a new forest. */
	updateLeafAt(path: ForestPath, updater: (value: T) => T, comparator?: Comparator<T, B>): Forest<T, B> {
		return this.updateTreeAt(path, tree => {
			if(isTreeBranch(tree)){
				throw errorNotLeaf()
			}
			return {value: updater(tree.value)}
		}, comparator)
	}

	/** Update branch value at given path. Will create a new forest. */
	updateBranchAt(path: ForestPath, updater: (value: B) => B, comparator?: Comparator<T, B>): Forest<T, B> {
		return this.updateTreeAt(path, tree => {
			if(!isTreeBranch(tree)){
				throw errorNotBranch()
			}
			return {value: updater(tree.value), children: tree.children}
		}, comparator)
	}

	/** Delete tree node at given path. Will create a new forest. */
	deleteAt(path: ForestPath): Forest<T, B> {
		return new Forest(this.deleteAtInternal(this.trees, path, 1))
	}

	/** Delete several tree nodes starting at given path. Will create a new forest. */
	deleteSeveralAt(path: ForestPath, amount: number): Forest<T, B> {
		return new Forest(this.deleteAtInternal(this.trees, path, amount))
	}

	private deleteAtInternal(trees: readonly Tree<T, B>[], path: ForestPath, amount: number): readonly Tree<T, B>[] {
		if(path.length === 0){
			throw errorZeroLengthPath()
		}

		const lastPathPart = path[path.length - 1]!
		if(path.length === 1){
			trees = dropElements(trees, lastPathPart, amount)
		} else {
			trees = this.updateInternal(trees, path.slice(0, path.length - 1), tree => {
				if(!isTreeBranch(tree)){
					throw errorNotBranch()
				}
				return {value: tree.value, children: dropElements(tree.children, lastPathPart, amount)}
			})
		}

		return trees
	}

	/** Insert several tree nodes at given path. Will create a new forest.
	See @method insertTreesAt for further explainations */
	insertTreesAt(path: ForestPath, newTrees: readonly Tree<T, B>[], comparator?: Comparator<T, B>): Forest<T, B> {
		return new Forest(this.insertAtInternal(this.trees, path, newTrees, comparator))
	}

	/** Insert given tree node at given path. Will create a new forest.
	When inserted at the place of existing node, that existing node will be shifted to higher index;
	this way new node will sit at given path, and existing node will sit at one index down.

	If @param comparator is passed, containing branch/root will be sorted. The rest of the tree won't be sorted.
	Usually sorting does not rely on children/parents, so it's fine to do and will reduce overhead.
	If your case DOES rely on something like that - you can always call .sort() after */
	insertTreeAt(path: ForestPath, newTree: Tree<T, B>, comparator?: Comparator<T, B>): Forest<T, B> {
		return new Forest(this.insertAtInternal(this.trees, path, [newTree], comparator))
	}

	/** Create new leaf node at given path. Will create a new forest. */
	insertLeafAt(path: ForestPath, leaf: T, comparator?: Comparator<T, B>): Forest<T, B> {
		return this.insertTreeAt(path, {value: leaf}, comparator)
	}

	/** Create new leaf nodes at given path. Will create a new forest. */
	insertLeavesAt(path: ForestPath, leaves: T[], comparator?: Comparator<T, B>): Forest<T, B> {
		return this.insertTreesAt(path, leaves.map(leaf => ({value: leaf})), comparator)
	}

	/** Create new branch node at given path. Will create a new forest. */
	insertBranchAt(path: ForestPath, branch: B, children: readonly Tree<T, B>[] = [], comparator?: Comparator<T, B>): Forest<T, B> {
		if(comparator){
			const newChildren = [...children]
			newChildren.sort(comparator)
			children = newChildren
		}
		return this.insertTreeAt(path, {value: branch, children}, comparator)
	}

	private insertAtInternal(trees: readonly Tree<T, B>[], path: ForestPath, newTrees: readonly Tree<T, B>[], comparator?: Comparator<T, B>): Tree<T, B>[] {
		if(path.length === 0){
			throw errorZeroLengthPath()
		}

		let result: Tree<T, B>[]
		const lastPathPart = path[path.length - 1]!
		if(path.length === 1){
			result = insertElements(trees, newTrees, lastPathPart)
			if(comparator){
				result.sort(comparator)
			}
		} else {
			result = this.updateInternal(trees, path.slice(0, path.length - 1), tree => {
				if(!isTreeBranch(tree)){
					throw errorNotBranch()
				}
				const children = insertElements(tree.children, newTrees, lastPathPart)
				if(comparator){
					children.sort(comparator)
				}
				return {value: tree.value, children}
			})
		}

		return result
	}

	/** Move a tree node from one place in the forest to another. Will create a new forest.
	Insert-shifting rules apply, see insertTreeAt() */
	move(from: ForestPath, to: ForestPath, comparator?: Comparator<T, B>): Forest<T, B> {
		return this.moveSeveral(from, to, 1, comparator)
	}

	/** Move several tree nodes from one place in the forest to another. Will create a new forest.
	Insert-shifting rules apply, see insertTreeAt() */
	moveSeveral(from: ForestPath, to: ForestPath, amount: number, comparator?: Comparator<T, B>): Forest<T, B> {
		const movedTrees = this.getTreesAt(from, amount)
		to = updateMovePath(from, to, amount)

		let trees = this.trees
		trees = this.deleteAtInternal(trees, from, amount)
		trees = this.insertAtInternal(trees, to, movedTrees, comparator)
		return new Forest(trees)
	}

	/** Get sibling nodes of node at given path. This excludes target node. */
	getSiblingTreesAt(path: ForestPath): Tree<T, B>[] {
		if(path.length === 0){
			throw errorZeroLengthPath()
		}

		const parentPath = path.slice(0, path.length - 1)
		let parentChildren: readonly Tree<T, B>[]
		if(parentPath.length === 0){
			parentChildren = this.trees
		} else {
			const parent = this.getTreeAt(parentPath)
			if(!isTreeBranch(parent)){
				throw errorNotBranch()
			}
			parentChildren = parent.children
		}

		const childIndex = path[path.length - 1]!
		return dropElements(parentChildren, childIndex, 1)
	}

	/** Get values of sibling nodes of node at given path. This excludes target node value. */
	getSiblingsAt(path: ForestPath): (T | B)[] {
		return this.getSiblingTreesAt(path).map(tree => tree.value)
	}

	/** Return a tree for each element of path */
	pathToTrees(path: ForestPath): Tree<T, B>[] {
		const result: Tree<T, B>[] = []
		let trees = this.trees
		for(let i = 0; i < path.length; i++){
			const part = path[i]!
			const tree = trees[part]
			if(!tree){
				throw errorOutOfBounds(part, i)
			}
			result.push(tree)

			if(i === path.length - 1){
				break
			}

			if(!isTreeBranch(tree)){
				throw errorNotBranchAt(part, i)
			}

			trees = tree.children
		}

		return result
	}

	/** Given a list of values that represent a path within forest, convert those values to indices.
	Returns null if any of the values cannot be found. */
	valuesToPath(values: readonly (T | B)[]): ForestPath | null {
		let trees = this.trees
		const result: number[] = []
		outer: for(let arrayIndex = 0; arrayIndex < values.length; arrayIndex++){
			const arrayValue = values[arrayIndex]
			let i = 0
			for(const tree of trees){
				if(tree.value === arrayValue){
					result.push(i)

					if(arrayIndex === values.length - 1){
						return result
					}

					if(isTreeBranch(tree)){
						trees = tree.children
					} else {
						throw errorNotBranch()
					}
					continue outer
				}
				i++
			}
			return null
		}
		throw new Error("Unreachable")
	}

	/** Given a path, resolve each element of this path to corresponding value. */
	pathToValues(path: ForestPath): (T | B)[] {
		return this.pathToTrees(path).map(tree => tree.value)
	}

	private updateInternal(
		trees: readonly Tree<T, B>[],
		path: ForestPath,
		updater: (tree: Tree<T, B>) => Tree<T, B>,
		comparator?: Comparator<T, B>,
		index = 0
	): Tree<T, B>[] {
		const pathPart = path[index]!
		let tree = trees[pathPart]
		if(!tree){
			throw errorOutOfBounds(pathPart, index)
		}

		if(index >= path.length - 1){
			tree = updater(tree)
		} else {
			if(!isTreeBranch(tree)){
				throw errorNotBranchAt(pathPart, index)
			}
			tree = {
				...tree,
				children: this.updateInternal(tree.children, path, updater, comparator, index + 1)
			}
		}

		const result = [...trees]
		result[pathPart] = tree
		if(comparator){
			result.sort(comparator)
		}
		return result
	}

	private mapInternal<TT, BB>(
		trees: readonly Tree<T, B>[],
		mapLeaf: (leaf: T, path: ForestPath) => TT,
		mapBranch: (value: B, path: ForestPath) => BB,
		path: ForestPath = []
	): Tree<TT, BB>[] {
		return trees.map((tree, i) => {
			const treePath = [...path, i]
			if(isTreeBranch(tree)){
				return {
					value: mapBranch(tree.value, treePath),
					children: this.mapInternal(tree.children, mapLeaf, mapBranch, treePath)
				}
			} else {
				return {value: mapLeaf(tree.value, treePath)}
			}
		})
	}

	private filterInternal(
		trees: readonly Tree<T, B>[],
		shouldKeep: (tree: Tree<T, B>, path: ForestPath) => boolean,
		path: ForestPath = []
	): Tree<T, B>[] {
		return trees.map((tree, i) => {
			const treePath = [...path, i]

			if(isTreeBranch(tree)){
				const children = this.filterInternal(tree.children, shouldKeep, treePath)
				tree = {value: tree.value, children}
			}

			return shouldKeep(tree, treePath) ? tree : null
		}).filter(nonNull)

	}

	private getTreeNodesInternal<T, B, R extends Tree<T, B>>(
		trees: readonly Tree<T, B>[],
		isThisIt: (tree: Tree<T, B>) => tree is R,
		path?: ForestPath
	): IterableIterator<[R, ForestPath]>
	private getTreeNodesInternal<T, B>(
		trees: readonly Tree<T, B>[],
		isThisIt: (tree: Tree<T, B>) => boolean,
		path?: ForestPath
	): IterableIterator<[Tree<T, B>, ForestPath]>
	private* getTreeNodesInternal<T, B, R extends Tree<T, B>>(
		trees: readonly Tree<T, B>[],
		isThisIt: (tree: Tree<T, B>) => tree is R,
		path: ForestPath = []
	): IterableIterator<[R, ForestPath]> {
		for(let i = 0; i < trees.length; i++){
			const treePath = [...path, i]
			const tree = trees[i]!
			if(isThisIt(tree)){
				yield[tree, treePath]
			}

			if(isTreeBranch(tree)){
				yield* this.getTreeNodesInternal(tree.children, isThisIt, treePath)
			}
		}
	}

	/** Reorder trees in root and each branch according to comparator. */
	sort(comparator: Comparator<T, B>): Forest<T, B> {
		const trees = [...this.trees]
		this.sortTreesRecursively(trees, comparator)
		return new Forest(trees)
	}

	private sortTreesRecursively(trees: Tree<T, B>[], comparator: Comparator<T, B>): void {
		trees.sort(comparator)
		for(let i = 0; i < trees.length; i++){
			const tree = trees[i]!
			if(isTreeBranch(tree)){
				const children = [...tree.children]
				this.sortTreesRecursively(children, comparator)
				trees[i] = {
					value: tree.value,
					children
				}
			}
		}
	}

	toString(): string {
		return this.toStringInternal(this.trees).join("\n")
	}

	private toStringInternal(
		trees: readonly Tree<T, B>[],
		depth: number = 0,
		result: string[] = [],
		prefixArr: string[] = []
	): string[] {
		for(let i = 0; i < trees.length; i++){
			const prefix = [...prefixArr].join("") + (i < trees.length - 1 ? "├" : "└")
			const tree = trees[i]!
			result.push(prefix + tree.value)
			if(isTreeBranch(tree)){
				prefixArr.push(i < trees.length - 1 ? "│" : " ")
				this.toStringInternal(tree.children, depth + 1, result, prefixArr)
				prefixArr.pop()
			}
		}
		return result
	}

}

const errorNotLeaf = () =>
	new Error("Failed to resolve tree by path: expected leaf, but got branch")

const errorNotBranch = () =>
	new Error("Failed to resolve tree by path: expected branch, but got leaf")

const errorOutOfBounds = (pathPart: number, index: number) =>
	new Error(`Failed to resolve tree by path: path element ${pathPart} (at ${index}) is out of bounds`)

const errorNotBranchAt = (pathPart: number, index: number) =>
	new Error(`Failed to resolve tree by path: path element ${pathPart} (at ${index}) points to a leaf, but it's not the last path element.`)

const errorZeroLengthPath = () => new Error("Zero length forest paths are not allowed.")

const dropElements = <T>(arr: readonly T[], index: number, amount: number): T[] => [...arr.slice(0, index), ...arr.slice(index + amount)]
const insertElements = <T>(arr: readonly T[], newElements: readonly T[], index: number): T[] =>
	[...arr.slice(0, index), ...newElements, ...arr.slice(index)]

const updateMovePath = (from: ForestPath, to: ForestPath, amount: number): ForestPath => {
	const result = [...to]
	for(let i = 0; i < Math.min(from.length, to.length); i++){
		if(from[i]! < to[i]!){
			result[i]! -= amount
			break
		}
	}
	return result
}
import {ForestPath, isTreeBranch, Tree, TreeLeaf} from "tree"
import {nonNull} from "utils"

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

	/** Resolve a path to leaf value. */
	getLeafAt(path: ForestPath): T {
		const tree = this.getTreeAt(path)

		if(isTreeBranch(tree)){
			throw errorNotLeaf()
		}

		return tree.value
	}

	/** Update tree node at given path. Will create a new forest. */
	updateTreeAt(path: ForestPath, updater: (tree: Tree<T, B>) => Tree<T, B>): Forest<T, B> {
		return new Forest(this.updateInternal(this.trees, path, updater))
	}

	/** Update leaf value at given path. Will create a new forest. */
	updateLeafAt(path: ForestPath, updater: (value: T) => T): Forest<T, B> {
		return this.updateTreeAt(path, tree => {
			if(isTreeBranch(tree)){
				throw errorNotLeaf()
			}
			return {value: updater(tree.value)}
		})
	}

	/** Update branch value at given path. Will create a new forest. */
	updateBranchAt(path: ForestPath, updater: (value: B) => B): Forest<T, B> {
		return this.updateTreeAt(path, tree => {
			if(!isTreeBranch(tree)){
				throw errorNotBranch()
			}
			return {value: updater(tree.value), children: tree.children}
		})
	}

	/** Delete tree node at given path. Will create a new forest. */
	deleteAt(path: ForestPath): Forest<T, B> {
		return new Forest(this.deleteAtInternal(this.trees, path))
	}

	private deleteAtInternal(trees: readonly Tree<T, B>[], path: ForestPath): readonly Tree<T, B>[] {
		if(path.length === 0){
			throw errorZeroLengthPath()
		}

		const lastPathPart = path[path.length - 1]!
		if(path.length === 1){
			trees = dropElement(trees, lastPathPart)
		} else {
			trees = this.updateInternal(trees, path.slice(0, path.length - 1), tree => {
				if(!isTreeBranch(tree)){
					throw errorNotBranch()
				}
				return {value: tree.value, children: dropElement(tree.children, lastPathPart)}
			})
		}

		return trees
	}

	/** Insert given tree node at given path. Will create a new forest.
	When inserted at the place of existing node, that existing node will be shifted to higher index;
	this way new node will sit at given path, and existing node will sit at one index down. */
	insertTreeAt(path: ForestPath, newTree: Tree<T, B>): Forest<T, B> {
		return new Forest(this.insertAtInternal(this.trees, path, newTree))
	}

	/** Create new leaf node at given path. Will create a new forest. */
	insertLeafAt(path: ForestPath, leaf: T): Forest<T, B> {
		return this.insertTreeAt(path, {value: leaf})
	}

	/** Create new branch node at given path. Will create a new forest. */
	insertBranchAt(path: ForestPath, branch: B, children: readonly Tree<T, B>[] = []): Forest<T, B> {
		return this.insertTreeAt(path, {value: branch, children})
	}

	private insertAtInternal(trees: readonly Tree<T, B>[], path: ForestPath, newTree: Tree<T, B>): readonly Tree<T, B>[] {
		if(path.length === 0){
			throw errorZeroLengthPath()
		}

		const lastPathPart = path[path.length - 1]!
		if(path.length === 1){
			trees = insertElement(trees, newTree, lastPathPart)
		} else {
			trees = this.updateInternal(trees, path.slice(0, path.length - 1), tree => {
				if(!isTreeBranch(tree)){
					throw errorNotBranch()
				}
				return {value: tree.value, children: insertElement(tree.children, newTree, lastPathPart)}
			})
		}

		return trees
	}

	/** Move a tree node from one place in the forest to another. Will create a new forest.
	Insert-shifting rules apply, see insertTreeAt() */
	move(from: ForestPath, to: ForestPath): Forest<T, B> {
		const tree = this.getTreeAt(from)
		to = updateMovePath(from, to)

		let trees = this.trees
		trees = this.deleteAtInternal(trees, from)
		trees = this.insertAtInternal(trees, to, tree)
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
		return dropElement(parentChildren, childIndex)
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

	/** Given a list of values that represent a path within forest, convert those values to indices. */
	valuesToPath(values: readonly (T | B)[]): ForestPath {
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
				children: this.updateInternal(tree.children, path, updater, index + 1)
			}
		}

		const result = [...trees]
		result[pathPart] = tree
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

const dropElement = <T>(arr: readonly T[], index: number): T[] => [...arr.slice(0, index), ...arr.slice(index + 1)]
const insertElement = <T>(arr: readonly T[], value: T, index: number): T[] =>
	[...arr.slice(0, index), value, ...arr.slice(index)]

const updateMovePath = (from: ForestPath, to: ForestPath): ForestPath => {
	const result = [...to]
	for(let i = 0; i < Math.min(from.length, to.length); i++){
		if(from[i]! < to[i]!){
			result[i]!--
			break
		}
	}
	return result
}
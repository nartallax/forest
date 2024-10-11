import {describe, test} from "@nartallax/clamsensor"
import {expect} from "chai"
import {Forest} from "forest"
import {isTreeBranch, Tree} from "tree"

describe("Forest", () => {

	const valueA = {value: 5}
	const valueB = {value: 6}
	const valueC = {value: 7}

	const emptyDir = {value: "emptyDir", children: []}
	const emptySubdir = {value: "emptySubdir", children: []}
	const subdir = {
		value: "subdir", children: [
			valueC,
			emptySubdir
		]
	}
	const nonEmptyDir = {
		value: "nonEmptyDir", children: [
			valueB,
			subdir
		]
	}

	const trees: Tree<number, string>[] = [
		emptyDir,
		valueA,
		nonEmptyDir
	]

	test("toString", () => {
		expect("\n" + new Forest([...trees, {value: 9}])).to.eql(`
├emptyDir
├5
├nonEmptyDir
│├6
│└subdir
│ ├7
│ └emptySubdir
└9`)
	})

	test("getAllTrees", () => {
		expect([...new Forest(trees).getAllTrees()]).to.eql([
			[emptyDir, [0]],
			[valueA, [1]],
			[nonEmptyDir, [2]],
			[valueB, [2, 0]],
			[subdir, [2, 1]],
			[valueC, [2, 1, 0]],
			[emptySubdir, [2, 1, 1]]
		])
	})

	test("getLeaves", () => {
		expect([...new Forest(trees).getLeavesWithPaths()]).to.eql([
			[5, [1]],
			[6, [2, 0]],
			[7, [2, 1, 0]]
		])
	})

	test("getLeafValues", () => {
		expect([...new Forest(trees).getLeaves()]).to.eql([5, 6, 7])
	})

	test("findPath", () => {
		const forest = new Forest(trees)
		expect(forest.findPathByTree(tree => tree.value === "emptySubdir")).to.eql([2, 1, 1])
		expect(forest.findPathByTree(tree => tree.value === 5)).to.eql([1])
		expect(forest.findPathByTree(tree => tree.value === 6)).to.eql([2, 0])
		expect(forest.findPathByTree(tree => tree.value === "emptyDir")).to.eql([0])
		expect(forest.findPathByTree(() => false)).to.eql(null)
	})

	test("findPathByValue", () => {
		const forest = new Forest(trees)
		expect(forest.findPath(value => value === "emptySubdir")).to.eql([2, 1, 1])
		expect(forest.findPath(value => value === 5)).to.eql([1])
		expect(forest.findPath(value => value === 6)).to.eql([2, 0])
		expect(forest.findPath(value => value === "emptyDir")).to.eql([0])
		expect(forest.findPath(() => false)).to.eql(null)
	})

	test("getFirstLeafValue", () => {
		expect(new Forest(trees).getFirstLeaf()).to.eql(5)
	})

	test("getFirstLeafPath", () => {
		expect(new Forest(trees).getFirstLeafPath()).to.eql([1])
	})

	test("filterTrees", () => {
		expect([...new Forest(trees).filterTrees(x => isTreeBranch(x)).getAllTrees()])
			.to.eql([
				[{value: "emptyDir", children: []}, [0]],
				[{value: "nonEmptyDir", children: [{value: "subdir", children: [{value: "emptySubdir", children: []}]}]}, [1]],
				[{value: "subdir", children: [{value: "emptySubdir", children: []}]}, [1, 0]],
				[{value: "emptySubdir", children: []}, [1, 0, 0]]
			])

		expect([...new Forest(trees).filterTrees(x => typeof(x.value) === "number").getAllTrees()])
			.to.eql([[valueA, [0]]])

		expect([...new Forest(trees).filterTrees(x => typeof(x.value) !== "string" || x.value.includes("mpty")).getAllTrees()])
			.to.eql([
				[{value: "emptyDir", children: []}, [0]],
				[{value: 5}, [1]],
				[{value: "nonEmptyDir", children: [{value: 6}]}, [2]],
				[{value: 6}, [2, 0]]
			])
	})

	test("filterLeaves", () => {
		expect([...new Forest(trees).filterLeaves(x => x > 6).getAllTrees()])
			.to.eql([
				[{value: "emptyDir", children: []}, [0]],
				[{value: "nonEmptyDir", children: [{value: "subdir", children: [{value: 7}, {value: "emptySubdir", children: []}]}]}, [1]],
				[{value: "subdir", children: [{value: 7}, {value: "emptySubdir", children: []}]}, [1, 0]],
				[{value: 7}, [1, 0, 0]],
				[{value: "emptySubdir", children: []}, [1, 0, 1]]
			])

		expect([...new Forest(trees).filterLeaves(x => x > 6, true).getAllTrees()])
			.to.eql([
				[{value: "nonEmptyDir", children: [{value: "subdir", children: [{value: 7}]}]}, [0]],
				[{value: "subdir", children: [{value: 7}]}, [0, 0]],
				[{value: 7}, [0, 0, 0]]
			])
	})

	test("map", () => {
		expect([...new Forest(trees).map(x => x + 1).trees])
			.to.eql([
				{value: "emptyDir", children: []},
				{value: 6},
				{
					value: "nonEmptyDir", children: [
						{value: 7},
						{
							value: "subdir", children: [
								{value: 8},
								{value: "emptySubdir", children: []}
							]
						}
					]
				}
			])

		expect([...new Forest(trees).map(x => x.toString(2), x => x.length).trees])
			.to.eql([
				{value: 8, children: []},
				{value: "101"},
				{
					value: 11, children: [
						{value: "110"},
						{
							value: 6, children: [
								{value: "111"},
								{value: 11, children: []}
							]
						}
					]
				}
			])
	})

	test("move", () => {
		expect("\n" + new Forest(trees).move([2, 0], [0]))
			.to.eql(`
├6
├emptyDir
├5
└nonEmptyDir
 └subdir
  ├7
  └emptySubdir`)

		expect("\n" + new Forest(trees).move([2, 0], [2, 0])).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 └subdir
  ├7
  └emptySubdir`)

		// nothing changes in this case
		// we are moving "6" to place of "subdir"
		// and when inserting element on place of existing element - that existing element is supposed to be shifted to higher index
		// hovewer, because we removed an element earlier, indices are shifted down by 1
		// that's why 2,1 is new 2,0
		expect("\n" + new Forest(trees).move([2, 0], [2, 1])).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 └subdir
  ├7
  └emptySubdir`)

		expect("\n" + new Forest(trees).move([2, 1], [2, 0])).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├subdir
 │├7
 │└emptySubdir
 └6`)

		expect("\n" + new Forest(trees).move([2, 0], [2, 2])).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├subdir
 │├7
 │└emptySubdir
 └6`)

		expect("\n" + new Forest(trees).move([1], [2, 2])).to.eql(`
├emptyDir
└nonEmptyDir
 ├6
 ├subdir
 │├7
 │└emptySubdir
 └5`)

		expect("\n" + new Forest(trees).move([2, 1], [1])).to.eql(`
├emptyDir
├subdir
│├7
│└emptySubdir
├5
└nonEmptyDir
 └6`)
	})

	test("delete", () => {
		expect("\n" + new Forest(trees).deleteAt([1])).to.eql(`
├emptyDir
└nonEmptyDir
 ├6
 └subdir
  ├7
  └emptySubdir`)

		expect("\n" + new Forest(trees).deleteAt([2, 1])).to.eql(`
├emptyDir
├5
└nonEmptyDir
 └6`)
	})

	test("update", () => {
		expect("\n" + new Forest(trees).updateBranchAt([2, 1], x => x + "!")).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 └subdir!
  ├7
  └emptySubdir`)


		expect("\n" + new Forest(trees).updateLeafAt([2, 1, 0], x => x + 5)).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 └subdir
  ├12
  └emptySubdir`)
	})

	test("insert", () => {
		expect("\n" + new Forest(trees).insertLeafAt([2, 2], 8)).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 ├subdir
 │├7
 │└emptySubdir
 └8`)

		expect("\n" + new Forest(trees).insertBranchAt([2, 1], "new branch")).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 ├new branch
 └subdir
  ├7
  └emptySubdir`)
	})

	test("getSiblings", () => {
		expect(new Forest(trees).insertBranchAt([2, 1], "new branch").getSiblingsAt([2, 1])).to.eql([6, "subdir"])
	})

	test("sorting", () => {
		expect("\n" + new Forest(trees).sort((a, b) => (a.value + "") < (b.value + "") ? 1 : -1)).to.eql(`
├nonEmptyDir
│├subdir
││├emptySubdir
││└7
│└6
├emptyDir
└5`)

		expect("\n" + new Forest(trees).sort((a, b) => (a.value + "") < (b.value + "") ? -1 : 1)).to.eql(`
├5
├emptyDir
└nonEmptyDir
 ├6
 └subdir
  ├7
  └emptySubdir`)
	})

	test("sorting on insert", () => {
		expect("\n" + new Forest(trees).insertLeafAt([2, 0], 8, (a, b) => (a.value + "") < (b.value + "") ? -1 : 1)).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 ├8
 └subdir
  ├7
  └emptySubdir`)
	})

	test("sorting on update", () => {
		const f = new Forest(trees)
			.insertLeafAt([2, 0], 4)
			.updateLeafAt([2, 0], () => 9, (a, b) => (a.value + "") < (b.value + "") ? -1 : 1)
		expect("\n" + f).to.eql(`
├5
├emptyDir
└nonEmptyDir
 ├6
 ├9
 └subdir
  ├7
  └emptySubdir`)
	})

	test("sorting on move", () => {
		const f = new Forest(trees)
			.insertLeafAt([2, 0], 8)
			.move([2, 0], [2, 5], (a, b) => (a.value + "") < (b.value + "") ? -1 : 1)
		expect("\n" + f).to.eql(`
├emptyDir
├5
└nonEmptyDir
 ├6
 ├8
 └subdir
  ├7
  └emptySubdir`)
	})

})
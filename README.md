# @nartallax/forest

TypeScript library about trees, groups of trees and various operations over them.

## Install

```bash
npm install @nartallax/forest
```

## Use

Main functionality of this library is contained within `Forest` class:

```typescript
import {Forest} from "@nartallax/forest"


let forest = new Forest({value: "branch", children: [{value: "leaf"}]})
console.log(forest + "")

forest = forest.insertLeafAt([0, 1], "new leaf"))
console.log(forest + "")

// etc, much more methods there, check'em out in typings
```

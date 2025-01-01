import {buildUtils} from "@nartallax/ts-build-utils"

const {
	npm, clear, typecheck, build, copyToTarget, cutPackageJson, runTests, generateDts
} = buildUtils({
	defaultBuildOptions: {
		entryPoints: ["./src/main.ts"],
		bundle: true,
		sourcemap: true,
		platform: "neutral",
		packages: "external",
		format: "esm"
	}
})

const main = async mode => {
	switch(mode){
		case "typecheck": {
			await typecheck()
		} break

		case "build": {
			await clear()
			await build()
			await generateDts()
			await copyToTarget("README.md", "LICENSE")
			await cutPackageJson()
			console.log("Done.")
		} break

		case "test": {
			await clear()
			await runTests()
		} break
		
		case "publish": {
			await main("typecheck")
			await main("test")
			await main("build")
			await npm.publish()
		}
	}
}

void main(process.argv[2])
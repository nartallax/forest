import * as esbuild from "esbuild"
import {promises as Fs} from "fs"
import * as Process from "process"
import * as ChildProcess from "child_process"
import * as Path from "path"

const tsconfig = JSON.parse(await Fs.readFile("./tsconfig.json"))
const sourcesRoot = tsconfig.compilerOptions.rootDir
const releaseEntrypoint = Path.resolve(sourcesRoot, "main.ts")

const generatedSourcesRoot = Path.resolve(sourcesRoot, "generated")
const testEntrypoint = Path.resolve(generatedSourcesRoot, "test.ts")

const targetDir = "./target"
const testJs = Path.resolve(targetDir, "test.js")

const configBase = {
	bundle: true,
	platform: "neutral",
	packages: "external",
}

main(Process.argv[2])

async function main(mode) {
	await Fs.rm(targetDir, {recursive: true, force: true})

	switch(mode ?? "release"){

		case "release": {
			await typecheck(sourcesRoot)

			const packageJson = JSON.parse(await Fs.readFile("./package.json", "utf-8"))

			await esbuild.build({
				...configBase,
				sourcemap: true,
				minify: true,
				entryPoints: [releaseEntrypoint],
				outfile: Path.resolve(targetDir, packageJson.main),
			})

			await generateDts({
				outputFile: Path.resolve(targetDir, packageJson.types),
				inputFile: releaseEntrypoint
			})

			await Fs.copyFile("./LICENSE", Path.resolve(targetDir, "LICENSE"))
			await Fs.copyFile("./README.md", Path.resolve(targetDir, "README.md"))
			await cutPackageJson({outputFile: Path.resolve(targetDir, "package.json")})
		} break


		case "test": {
			await Fs.rm(testEntrypoint, {force: true})
			await generateTestEntrypoint({sourcesRoot, testEntrypoint})

			await esbuild.build({
				...configBase,
				entryPoints: [testEntrypoint],
				outfile: testJs,
			})

			await runJs({jsFile: testJs, exitOnError: true})
		} break


		case "typecheck": {
			await typecheck(sourcesRoot)
		} break


		case "publish": {
			await main("test")
			await main("release")
			await publishToNpm({targetDir})
		}

	}
}


function runShell(opts){
	return new Promise((resolve, reject) => {
		let {executable, args, cwd} = opts
		let spawnOpts = {
			cwd: cwd ?? ".",
			stdio: "inherit"
		}

		if(Process.platform === "win32"){
			spawnOpts.shell = true
			executable = `"${executable}"` // in case of spaces in path
		}
		
		let proc = ChildProcess.spawn(executable, args, spawnOpts)

		proc.on("exit", (code, signal) => {
			if(code || signal){
				if(opts.exitOnError){
					Process.exit(1)
				}
				reject(new Error(`${executable} exited with wrong code/signal: code = ${code}, signal = ${signal}`))
			} else {
				resolve()
			}
		})
	})
}

async function generateDts(args){
	await runShell({
		executable:"npx", 
		args: [
			"dts-bundle-generator", 
			"--out-file", args.outputFile, 
			"--project", "tsconfig.json", 
			"--export-referenced-types=false",
			"--no-banner", 
			args.inputFile
		]
})
}

async function cutPackageJson(args){
	await runShell({
		executable: "npx", 
		args: ["package-cutter", "--output", args.outputFile]
	})
}

async function generateTestEntrypoint(args){
	await runShell({
		executable: "npx", 
		args: ["clamsensor_codegen", args.sourcesRoot, args.testEntrypoint]
	})
}

async function runJs(args){
	await runShell({
		executable: Process.argv[0], 
		args: [args.jsFile],
		exitOnError: args.exitOnError
	})
}

async function typecheck(directory){
	await runShell({
		executable: "npx", 
		args: ["tsc", "--noEmit"],
		cwd: directory,
		exitOnError: true
	})
}

async function publishToNpm(args){
	await runShell({
		executable: "npm", 
		args: ["publish", "--access", "public"],
		cwd: args.targetDir
	})
}
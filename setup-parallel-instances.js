import { cp, access, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const platform = typeof Deno !== 'undefined' ? 'deno' : (typeof process !== 'undefined' && process.versions?.bun ? 'bun' : 'node')

async function copySetupDirectory() {
	try {
		const args = process.argv.slice(2)
		const forceFlag = args.includes('--force') || args.includes('-f')

		const sourceDir = join(dirname(fileURLToPath(import.meta.url)), '.wp-now')
		await access(sourceDir)

		let destDir = args.find(arg => !arg.startsWith('-')) || '.wp-now'
		destDir = isAbsolute(destDir) ? destDir : join(process.cwd(), destDir)

		if (!forceFlag) {
			try {
				await access(destDir)
				console.error('Error: Destination directory already exists. Use --force or -f to overwrite it.')
				process.exit(1)
			} catch {
				// Destination doesn't exist, we can proceed
			}
		}

		await cp(sourceDir, destDir, { recursive: true, force: forceFlag })
		console.log(`Successfully added parallel setup files to ${destDir}`)

		try {
			const projectName = basename(process.cwd())
			const wpConfigPath = join(destDir, 'shared/wp-config.php')
			await access(wpConfigPath)
			const content = await readFile(wpConfigPath, 'utf8')
			const updatedContent = content.replace(/__PROJECT_DIR__/g, projectName)
			await writeFile(wpConfigPath, updatedContent, 'utf8')
		} catch (error) {
			console.error('Error updating project variables in the code.', error.message)
		}

	} catch (error) {
		console.error('Error copying directory:', error.message)
		process.exit(1)
	}
}

copySetupDirectory()
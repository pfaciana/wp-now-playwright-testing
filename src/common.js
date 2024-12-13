import { existsSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export const args = process.argv.slice(2)

export const hasFlag = (function() {
	const flags = args.map(arg => arg.toLowerCase())
	return function() {
		return [...arguments].map(flag => flag.toLowerCase()).some(flag => flags.includes(flag))
	}
})()

export const setFlag = function(args) {
	const result = {}, parsed = {}
	args.forEach(function(arg) {
		let [k, v = 'true'] = arg.split('=')
		let pv = v
		k = k.replace(/^-+/, '')
		try { pv = JSON.parse(v) } catch (e) {}
		result[k] = v
		parsed[k] = pv
	})
	return function(key = null, defaultValue = undefined, parse = true) {
		if (key !== null) {
			return key in result ? (parse ? parsed[key] : result[key]) : defaultValue
		}
		return parse ? parsed : result
	}
}

export const getFlag = setFlag(args)

export function getBooleanInput(input) {
	return !['', 'undefined', 'null', 'false', '0', 'no', 'off'].includes(String(input).toLowerCase().trim())
}

export function getBooleanFlag(input) {
	return !['null', 'false', '0', 'no', 'off'].includes(String(input).toLowerCase().trim())
}

export async function getFilesRecursively(dirPath, relativeTo = dirPath) {
	const directories = []
	const files = []

	dirPath = resolve(dirPath)
	relativeTo = resolve(relativeTo)

	for (const entry of await readdir(dirPath, { withFileTypes: true })) {
		const fullPath = join(dirPath, entry.name)
		const relativePath = fullPath.slice(relativeTo.length + 1)

		if (entry.isDirectory()) {
			directories.push(relativePath)
			const subContent = await getFilesRecursively(fullPath, relativeTo)
			directories.push(...subContent.directories)
			Object.assign(files, subContent.files)
		} else {
			files[relativePath] = await readFile(fullPath, 'utf8')
		}
	}

	return { directories, files }
}

export async function getSubDirs(search, options = {}) {
	const { pattern, absolutePath } = { ...{ pattern: false, absolutePath: true }, ...options }
	try {
		let dirs = await readdir(search, { withFileTypes: true })
		dirs = dirs.filter(dir => dir.isDirectory())
		if (pattern) {
			dirs = dirs.filter(dir => pattern.test(dir.name))
		}
		dirs = dirs.map(dir => absolutePath ? join(search, dir.name) : dir.name)
		return dirs
	} catch (error) {
		console.error('Error reading directory:', error)
		return []
	}
}

export async function rmAll(items) {
	if (!Array.isArray(items)) {
		items = [items]
	}
	try {
		await Promise.all(items.map(item => rm(item, { recursive: true, force: true })))
	} catch (error) {
		throw error
	}
}

export async function rmContents(dir) {
	try {
		const entries = await readdir(dir)
		const deletePromises = entries.map(async (entry) => {
			const filePath = join(dir, entry)
			await rm(filePath, { recursive: true, force: true })
		})
		await Promise.all(deletePromises)
	} catch (error) {
		throw error
	}
}

export async function loadJsonFile(path, options = 'utf8') {
	try {
		if (!existsSync(path)) {
			console.warn(`JSON file: ${path} does not exist. Using empty file object.`)
			return {}
		}
		return JSON.parse(await readFile(path, options))
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in file ${path}: ${error.message}`)
		}
		throw error
	}
}
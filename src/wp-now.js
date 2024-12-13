import { readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, isAbsolute, join, sep } from 'node:path'
import { createInterface } from 'node:readline'
import { getWpNowConfig } from '@wp-now/wp-now'
import { SupportedPHPVersionsList } from '@php-wasm/universal'
import isPortReachable from 'is-port-reachable'
import { getFilesRecursively, getSubDirs, loadJsonFile, rmAll, rmContents } from './common.js'

let phpVersions
if (!SupportedPHPVersionsList || !Array.isArray(SupportedPHPVersionsList) || !SupportedPHPVersionsList.length) {
	// https://www.php.net/supported-versions.php
	phpVersions = [
		'7.4', // 2019 - 2022
		'8.0', // 2020 - 2023
		'8.1', // 2021 - 2025
		'8.2', // 2022 - 2026
		'8.3', // 2023 - 2027
		// '8.4', // 2024 - 2028
	]
} else {
	phpVersions = [...SupportedPHPVersionsList].sort()
}

// https://wordpress.org/download/releases/ (with RC and beta)
// https://wordpress.org/documentation/article/wordpress-versions/
export const FALLBACK_WP_VERSIONS = {
	'4.9': '4.9.26', // November 15, 2017
	'5.9': '5.9.10', // January 25, 2022
	'6.0': '6.0.9', // May 24, 2022
	'6.1': '6.1.7', // November 1, 2022
	'6.2': '6.2.6', // March 29, 2023
	'6.3': '6.3.5', // August 8, 2023
	'6.4': '6.4.5', // November 7, 2023
	'6.5': '6.5.5', // April 2, 2024
	'6.6': '6.6.2', // July 16, 2024
	'6.7': '6.7.1', // November 12, 2024
	'latest': 'latest',
}

export const getWpVersions = (function() {
	let wpVersions = null
	return async function(options) {
		const { latest, options: fetchOptions } = { ...{ latest: true }, ...options }
		if (!(wpVersions && typeof wpVersions === 'object' && Object.keys(wpVersions).length)) {
			wpVersions = await fetchWordPressVersions(fetchOptions)
		}
		if (!latest) {
			const { latest: removedKey, ...wpVersionsNoLatest } = wpVersions
			return wpVersionsNoLatest
		}
		return wpVersions
	}
})()

export async function fetchWordPressVersions(options = {}) {
	const { timeout, fallback, latest } = { ...{ timeout: 3000, fallback: FALLBACK_WP_VERSIONS, latest: true }, ...options }
	try {

		const controller = new AbortController()
		const timeoutID = setTimeout(() => { controller.abort() }, timeout)
		const response = await fetch('https://api.wordpress.org/core/version-check/1.7/', { signal: controller.signal })
		clearTimeout(timeoutID)

		if (!response.ok) {
			console.warn(`API request failed: ${response.status} ${response.statusText}`)
			return fallback
		}

		const data = await response.json()

		if (!data?.offers?.length) {
			console.warn('API response missing offers data')
			return fallback
		}

		const versions = {}
		data.offers.reverse().forEach(({ version }) => {
			if (!version) return
			const [major, minor] = version.split('.')
			const majorMinor = `${major}.${minor}`
			versions[majorMinor] = version
		})

		if (!Object.keys(versions).length) {
			console.warn('No valid versions found in API response')
			return fallback
		}

		if (latest) {
			versions.latest = 'latest'
		}

		return versions
	} catch (error) {
		console.warn('Unexpected error:', error.message)
		return fallback
	}
}

export function isValidVersion(version, currentVersions, quite = false) {
	version = /^\d+\.\d+$/.test(version) ? `${version}.0` : version
	const versionLC = version.toLowerCase()

	const hasExactMatch = currentVersions.some(match => versionLC === match.toLowerCase())
	if (hasExactMatch) {
		return true
	}

	const [major, minor, patch] = currentVersions.at(-1).split('.')
	const prefixes = {
		rcMajorVersion: `${+major + 1}.0-RC`,
		rcMinorVersion: `${major}.${+minor + 1}-RC`,
		rcPatchVersion: `${major}.${minor}.${+patch + 1}-RC`,
		betaMajorVersion: `${+major + 1}.0-beta`,
		betaMinorVersion: `${major}.${+minor + 1}-beta`,
	}

	const isValid = Object.values(prefixes).some(prefix => versionLC.startsWith(prefix.toLowerCase()))
	if (!quite && !isValid && (versionLC && versionLC !== 'latest')) {
		console.warn(`Outdated or invalid version: ${version}\n`)
	}
	return isValid
}

export const versionParser = (shortcode) => {
	const digits = shortcode.replace(/\D/g, '')

	if (digits.length < 2) {
		return false
	}

	let ignore, php, wp, port, hasWpVersion
	const matches = (/^\D*(\d{2})\D*(\d+\.\d+(?:\.\d+)?(?:-rc|-beta)\d)\D*(\d{4,5})?/i).exec(shortcode)
	if (matches) {
		[, php, wp, port] = matches
		port ??= `${php}99`
		php = php.replace(/(\d+)(\d+)/, '$1.$2')
		return { php, wp, port: +port }
	}

	php = `${digits[0]}.${digits[1]}`
	hasWpVersion = digits.length >= 4
	wp = hasWpVersion ? `${digits[2]}.${digits[3]}` : 'latest'

	if (digits.length >= 8) {
		port = +digits.slice(4, 9)
	} else {
		port = +(hasWpVersion ? digits.slice(0, 4) : digits.slice(0, 2) + '99')
	}

	return { php, wp, port }
}

async function getBlueprintMigrationSteps(localDir, serverDir, loadFiles = null, localRoot = null) {
	let steps = []

	if (await readdir(localDir).then(x => x.length).catch(() => false)) {
		steps.push({
			'step': 'mkdir',
			'path': `${serverDir}`.replace(/\\/g, '/'),
		})
		const { directories, files } = await getFilesRecursively(localDir)
		directories.forEach((dir) => {
			steps.push({
				'step': 'mkdir',
				'path': `${serverDir}/${dir}`.replace(/\\/g, '/'),
			})
		})
		Object.entries(files).forEach(([file, content]) => {
			steps.push({
				'step': 'writeFile',
				'path': `${serverDir}/${file}`.replace(/\\/g, '/'),
				'data': content,
			})
		})
		if (loadFiles) {
			if (typeof loadFiles === 'string') {
				loadFiles = loadFiles.split(',')
			}
			loadFiles.forEach((loadFile) => {
				if (existsSync(join(localDir, loadFile))) {
					steps.push({
						'step': 'runPHP',
						'code': `<?php require_once '${serverDir}/${loadFile}';`,
					})
				}
			})
		}
	}

	return steps
}

export async function getWpNowConfigs(shortcodes, options = {}) {
	if (!shortcodes) {
		return []
	}

	let { localRoot, localShare, serverRoot, serverShare, loadFiles, blueprintBaseFile, blueprintFile, skipBrowser, wpVersions } = {
		...{
			localRoot: process.cwd(),
			localShare: '.wp-now/shared',
			serverRoot: null,
			serverShare: '.wp-now',
			loadFiles: null,
			blueprintBaseFile: '.wp-now/blueprint.base.json',
			blueprintFile: '.wp-now/blueprint.json',
			wpVersions: await getWpVersions(),
			skipBrowser: true,
		}, ...options,
	}
	if (!serverRoot) {
		serverRoot = `${(await getWpNowConfig({ path: localRoot })).documentRoot}/wp-content`
	}

	if (typeof shortcodes === 'string' || typeof shortcodes === 'number') {
		shortcodes = String(shortcodes).split(',')
	}
	let wpNowConfigs = shortcodes.map((versions) => {
		const wpNowConfig = versionParser(versions)
		if (!wpNowConfig || !(phpVersions.includes(wpNowConfig.php))) {
			return false
		}
		const { latest: removedKey, ...wpVersionsNoLatest } = wpVersions
		if (wpVersionsNoLatest[wpNowConfig.wp]) {
			wpNowConfig.wp = wpVersionsNoLatest[wpNowConfig.wp]
		} else if (!isValidVersion(wpNowConfig.wp, Object.values(wpVersionsNoLatest))) {
			wpNowConfig.wp = 'latest'
		}
		wpNowConfig.path = localRoot
		return wpNowConfig
	}).filter(Boolean)

	if (blueprintFile) {
		const localDir = join(localRoot, localShare)
		const serverDir = `${serverRoot}/${serverShare}`
		const steps = await getBlueprintMigrationSteps(localDir, serverDir, loadFiles, localRoot)

		let blueprint = {}
		if (blueprintBaseFile) {
			if (!isAbsolute(blueprintBaseFile)) {
				blueprintBaseFile = join(localRoot, blueprintBaseFile)
			}
			if (existsSync(blueprintBaseFile)) {
				blueprint = await loadJsonFile(blueprintBaseFile)
			}
		}
		blueprint.steps ??= []
		blueprint.steps = [...steps, ...blueprint.steps]

		if (!isAbsolute(blueprintFile)) {
			blueprintFile = join(localRoot, blueprintFile)
		}
		await writeFile(blueprintFile, JSON.stringify(blueprint, null, 2)).catch(err => console.error('Failed to write blueprint file:', err))

		wpNowConfigs = wpNowConfigs.map((wpNowConfig) => {
			wpNowConfig.blueprint = blueprintFile
			return wpNowConfig
		})
	}

	wpNowConfigs = wpNowConfigs.map((wpNowConfig) => {
		wpNowConfig.skipBrowser = skipBrowser
		return wpNowConfig
	})

	return wpNowConfigs
}

const processExit = (function() {
	let processed = false
	return function() {
		if (!processed && (processed = true)) {
			if (process.platform === 'win32') {
				const rl = createInterface({ input: process.stdin, output: process.stdout })
				rl.on('SIGINT', () => process.emit('SIGINT'))
				rl.on('exit', () => process.emit('exit'))
				process.on('exit', () => rl?.close())
			}
		}
	}
})()

export async function preServerSetup(wpNowConfigs, options) {
	let { reset, clean } = { ...{ reset: false, clean: false }, ...options }

	if (!Array.isArray(wpNowConfigs)) {
		wpNowConfigs = [wpNowConfigs]
	}

	if (!wpNowConfigs.length) {
		return false
	}

	let activeConfigs = [], ignoredConfigs = []
	for (const wpNowConfig of wpNowConfigs) {
		if (await isPortReachable(wpNowConfig.port, { host: 'localhost' })) {
			ignoredConfigs.push(wpNowConfig)
			console.log(`Port ${wpNowConfig.port} is in use.`)
		} else {
			activeConfigs.push(wpNowConfig)
		}
	}

	if (!ignoredConfigs.length) {
		const wpNowConfig = await getWpNowConfig(activeConfigs[0])
		if (reset) {
			console.log(`Resetting ${wpNowConfig.wpContentPath}...`)
			await rm(wpNowConfig.wpContentPath, { recursive: true, force: true })
		}
		if (clean) {
			processExit()
			const teardown = async (code) => process.exit(await postServerTeardown(activeConfigs[0], { reset: clean }) ? code : 1)
			process.on('SIGINT', async () => teardown(0))
			process.on('exit', async (code) => teardown(code))
		}
	}
}

export async function postServerTeardown(wpNowConfigs, options) {
	let { reset } = { ...{ reset: false }, ...options }

	if (!Array.isArray(wpNowConfigs)) {
		wpNowConfigs = [wpNowConfigs]
	}

	if (!wpNowConfigs.length) {
		return false
	}

	const wpNowConfig = await getWpNowConfig(wpNowConfigs[0])

	if (reset) {
		console.log(`Cleaning ${wpNowConfig.wpContentPath}...`)
		await rm(wpNowConfig.wpContentPath, { recursive: true, force: true })
	}

	return true
}

/*
83-67
82-66
81-65 *
80-60
74-59
*/

export function getWpNowDirs(wpConfig) {
	const pathParts = wpConfig.wpContentPath.split(sep)
	const wpContentIndex = pathParts.indexOf('wp-content')
	const wpNowHiddenDir = pathParts.slice(0, wpContentIndex).join(sep)
	return {
		hidden: wpNowHiddenDir,
		versions: join(wpNowHiddenDir, 'wordpress-versions'),
		content: join(wpNowHiddenDir, 'wp-content'),
		full: wpConfig.wpContentPath,
		basename: basename(wpConfig.wpContentPath),
		prefix: basename(wpConfig.projectPath),
	}
}

export async function rmWpNowProjectDirs(wpConfig, dryRun = false) {
	if (!wpConfig || typeof wpConfig !== 'object') {
		wpConfig = wpConfig === '*' ? null : wpConfig
		wpConfig = await getWpNowConfig({ path: wpConfig ?? process.cwd() })
	}

	if (arguments[0] === '*') {
		const wpContentDir = getWpNowDirs(wpConfig).content
		!dryRun && rmContents(wpContentDir)
		return [wpContentDir + sep + arguments[0]]
	} else if (wpConfig.mode === 'playground') {
		!dryRun && rmAll(wpConfig.wpContentPath)
		return [wpConfig.wpContentPath]
	} else {
		const wpNowDirs = getWpNowDirs(wpConfig)
		const matchingDirs = await getSubDirs(wpNowDirs.content, { pattern: new RegExp(`^${wpNowDirs.prefix}-[a-f0-9]{40}$`) })
		!dryRun && rmAll(matchingDirs)
		return matchingDirs
	}
}

export async function rmWpNowOutdatedWordPress(wpConfig, dryRun = false) {
	if (!wpConfig || typeof wpConfig !== 'object') {
		wpConfig = wpConfig === '*' ? null : wpConfig
		wpConfig = await getWpNowConfig({ path: wpConfig ?? process.cwd() })
	}

	const wpNowDirs = getWpNowDirs(wpConfig)
	const wpVersionsDir = wpNowDirs.versions

	if (arguments[0] === '*') {
		!dryRun && rmContents(wpVersionsDir)
		return [wpVersionsDir + sep + arguments[0]]
	}

	const allVersionDirs = await getSubDirs(wpVersionsDir, { pattern: /^\d+\.\d+(?:\.\d+)?(?:-(?:RC|beta)-?\d+)?$/ })
	const currentWpVersions = Object.values(await getWpVersions({ latest: false }))
	const outdatedVersionDirs = allVersionDirs.filter(dir => !isValidVersion(basename(dir), currentWpVersions, true))

	!dryRun && rmAll(outdatedVersionDirs)

	return outdatedVersionDirs
}

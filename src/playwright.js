import os from 'node:os'
import { join } from 'node:path'
import { devices as allDevices } from '@playwright/test'
import { getSubDirs, rmAll } from './common.js'

export async function getPlaywrightDir() {
	try {
		const { registryDirectory } = await import('playwright-core/lib/server/registry/index')
		return registryDirectory
	} catch (error) {
		let cacheDirectory
		if (process.platform === 'win32') cacheDirectory = process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local')
		else if (process.platform === 'darwin') cacheDirectory = join(os.homedir(), 'Library', 'Caches')
		else cacheDirectory = process.env.XDG_CACHE_HOME || join(os.homedir(), '.cache')
		return join(cacheDirectory, 'ms-playwright')
	}
}

export async function rmPlaywrightOldBrowsers(browsers = null, dryRun = false) {
	const playwrightDir = await getPlaywrightDir()
	let dirToRemove = []

	browsers = browsers === '*' ? null : browsers
	browsers ??= ['chromium', 'firefox', 'webkit', 'ffmpeg']
	for (const browserBase of browsers) {
		for (const suffix of ['', '_headless_shell']) {
			const browser = `${browserBase}${suffix}`
			const matchingDirs = await getSubDirs(playwrightDir, { pattern: new RegExp(`^(${browser})-(\\d+)$`), absolutePath: false })
			if (arguments[0] === '*') {
				dirToRemove = [...dirToRemove, ...matchingDirs]
			} else if (matchingDirs.length > 1) {
				const allVersions = matchingDirs.map(version => parseInt(version.replace(`${browser}-`, '')))
				const maxVersion = Math.max(...allVersions)
				const nonMaxVersions = allVersions.filter(version => version !== maxVersion)
				dirToRemove = [...dirToRemove, ...nonMaxVersions.map(version => join(playwrightDir, `${browser}-${version}`))]
			}
		}
	}

	!dryRun && rmAll(dirToRemove)
	return dirToRemove
}

export function deviceParser(shortcode, validItems) {
	if (typeof shortcode !== 'string') {
		return false
	}

	shortcode = shortcode.replaceAll(/-/g, ' ').toLowerCase().trim()
	if (!shortcode) {
		return false
	}

	const isLandscape = shortcode.endsWith(' l')
	if (isLandscape) {
		shortcode = shortcode.slice(0, -2)
	}

	const validItemsLowerCase = validItems.map(x => x.toLowerCase())
	const pos = validItemsLowerCase.indexOf(isLandscape ? `${shortcode} landscape` : shortcode)
	if (pos !== -1) {
		return validItems[pos]
	}

	let match = false
	for (let prefix of ['', 'desktop ']) {
		validItemsLowerCase.forEach((e, i) => {
			if (!e.startsWith(prefix + shortcode)) {
				return
			}
			if (isLandscape && e.endsWith(' landscape')) {
				match = validItems[i]
			} else if (!isLandscape && !e.endsWith(' landscape')) {
				match = validItems[i]
			}
		})
		if (match) {
			return match
		}
	}

	return match
}

export function getPlaywrightConfig(wpNowConfigs, webServerCommand, options) {
	let { devices, validDevices, addMetadata, server, reset, clean } = {
		...{
			devices: 'chrome',
			validDevices: allDevices,
			addMetadata: true,
			server: `http://localhost`,
			reset: false,
			clean: false,
		}, ...options,
	}

	if (typeof devices === 'string') {
		devices = devices.split(',')
	}

	let projects = []
	wpNowConfigs.forEach((env) => {
		devices.forEach((device) => {
			const deviceName = validDevices ? deviceParser(device, Object.keys(validDevices)) : device
			if (deviceName) {
				projects.push({
					name: `${deviceName} php${env.php} wp${env.wp}`,
					...(addMetadata ? { metadata: { device: deviceName, php: env.php, wp: env.wp, port: env.port, server: server } } : {}),
					use: {
						baseURL: `${server}:${env.port}`,
						...validDevices[deviceName],
					},
				})
			}
		})
	})

	const webServer = wpNowConfigs.map((wpNowConfig) => {
		return {
			command: webServerCommand,
			url: `${server}:${wpNowConfig.port}`,
			env: {
				WP_NOW: `${JSON.stringify(wpNowConfig)}`,
				RESET: reset ? 1 : 0,
				CLEAN: clean ? 1 : 0,
			},
			reuseExistingServer: !process.env.CI,
			stdout: 'pipe',
			stderr: 'pipe',
		}
	}).filter(Boolean)

	return { projects, webServer }
}
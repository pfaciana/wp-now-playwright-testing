import { isAbsolute, join, resolve } from 'node:path'
import { getBooleanInput, preServerSetup as setup, getFlag, getWpNowConfigs as setWpNowConfigs, getPlaywrightConfig as setPlaywrightConfig } from './index.js'

const RESET = getBooleanInput(getFlag('reset') ?? process.env.RESET ?? true)
const CLEAN = getBooleanInput(getFlag('clean') ?? process.env.CLEAN ?? false)
const SKIP_BROWSER = getBooleanInput(getFlag('skip-browser') ?? process.env.SKIP_BROWSER ?? true)

const PHP = getFlag('php', null, false) ?? process.env.PHP ?? null
const WP = getFlag('wp', null, false) ?? process.env.WP ?? null
const PORT = getFlag('port') ?? process.env.PORT ?? null
const PATH = getFlag('path') ?? process.env.ROOT ?? null

const USE_VERSIONS = getFlag('versions') ?? process.env.USE_VERSIONS ?? ((PHP || WP || PORT) ? null : '81')
const USE_BROWSERS = getFlag('browsers') ?? process.env.USE_BROWSERS ?? 'chrome'

const LOCAL_ROOT = getFlag('local-root') ?? process.env.LOCAL_ROOT ?? process.cwd()
const LOCAL_SHARE = getFlag('local-share') ?? process.env.LOCAL_SHARE ?? '.wp-now/shared' // writeFiles
const SERVER_SHARE = getFlag('server-share') ?? process.env.SERVER_SHARE ?? '.wp-now' // mkdir
const LOAD_FILES = getFlag('load-files') ?? process.env.LOAD_FILES ?? 'loader.php' // runPHP

const BASE_BLUEPRINT_FILE = getFlag('base-blueprint') ?? process.env.BASE_BLUEPRINT_FILE ?? '.wp-now/blueprint.base.json'
const BLUEPRINT_FILE = getFlag('blueprint') ?? process.env.BLUEPRINT_FILE ?? '.wp-now/blueprint.json'

const SERVER_CMD = getFlag('server-cmd') ?? process.env.SERVER_CMD ?? 'node node_modules/wp-now-playwright-testing/playwright-webserver.js'

const getWpNowConfigs = (function() {
	let wpNowConfigs = null
	return async function(options = {}) {
		const { useCache, setCache, versions, ...wpConfigOptions } = {
			...{
				useCache: true,
				setCache: true,
				versions: USE_VERSIONS,
				localRoot: resolve(LOCAL_ROOT),
				localShare: LOCAL_SHARE,
				serverShare: SERVER_SHARE,
				loadFiles: LOAD_FILES,
				blueprintBaseFile: BASE_BLUEPRINT_FILE,
				blueprintFile: BLUEPRINT_FILE,
				skipBrowser: SKIP_BROWSER,
			}, ...options,
		}

		if (useCache && wpNowConfigs) {
			return wpNowConfigs
		}
		let tmpWpNowConfigs = await setWpNowConfigs(versions, wpConfigOptions)
		if (PHP || WP || PORT) {
			const { localRoot, blueprintFile, skipBrowser } = wpConfigOptions
			tmpWpNowConfigs.unshift({
				php: PHP,
				wp: WP,
				port: PORT,
				path: PATH ?? localRoot,
				blueprint: !isAbsolute(blueprintFile) ? join(PATH ?? localRoot, blueprintFile) : blueprintFile,
				skipBrowser: skipBrowser,
				reset: false,
			})
		}
		return setCache ? (wpNowConfigs = tmpWpNowConfigs) : tmpWpNowConfigs
	}
})()
const preServerSetup = async function(options = {}) {
	return await setup(await getWpNowConfigs(), { ...{ reset: RESET, clean: CLEAN }, ...options })
}
const getPlaywrightConfig = (function() {
	let playwrightConfig = null
	return async function(options = {}) {
		const { useCache, setCache, serverCmd, browsers, addMetadata, reset, clean } = {
			...{
				useCache: true,
				setCache: true,
				serverCmd: SERVER_CMD,
				browsers: USE_BROWSERS,
				addMetadata: true,
				reset: RESET,
				clean: CLEAN,
			}, ...options,
		}

		if (useCache && playwrightConfig) {
			return playwrightConfig
		}
		const tmpPlaywrightConfig = setPlaywrightConfig(await getWpNowConfigs(), serverCmd, {
			devices: browsers,
			addMetadata,
			reset: (await getWpNowConfigs()).length === 1 ? reset : false,
			clean: (await getWpNowConfigs()).length === 1 ? clean : false,
		})
		return setCache ? (playwrightConfig = tmpPlaywrightConfig) : tmpPlaywrightConfig
	}
})()

export { getWpNowConfigs, getPlaywrightConfig, preServerSetup }

import path from 'path'
import { getWpNowConfig } from '@wp-now/wp-now'
import { getBooleanInput, getFlag, watchAndSync } from './index.js'

const LOCAL_ROOT = getFlag('local-root') ?? process.env.LOCAL_ROOT ?? process.cwd()
const LOCAL_SHARE = getFlag('local-share') ?? process.env.LOCAL_SHARE ?? '.wp-now/shared'
const SERVER_SHARE = getFlag('server-share') ?? process.env.SERVER_SHARE ?? '.wp-now'

const ignoreInitial = getBooleanInput(getFlag('ignore-initial') ?? process.env.IGNORE_INITIAL ?? true)
const verbose = getBooleanInput(getFlag('verbose') ?? process.env.VERBOSE ?? true)

export const syncSharedDirs = async () => {
	const wpConfig = await getWpNowConfig({ path: LOCAL_ROOT })
	const srcPath = path.join(LOCAL_ROOT, LOCAL_SHARE)
	const destPath = path.join(wpConfig.wpContentPath, SERVER_SHARE)
	watchAndSync(srcPath, destPath, { verbose, ignoreInitial })
}

await syncSharedDirs()
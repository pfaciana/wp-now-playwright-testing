import { getWpNowConfig, startServer } from '@wp-now/wp-now'
import { preServerSetup, getBooleanInput, getFlag } from './index.js'

const WP_NOW = getFlag('wp-now') ?? JSON.parse(process.env.WP_NOW ?? '{}')
const RESET = getBooleanInput(getFlag('reset') ?? process.env.RESET ?? false)
const CLEAN = getBooleanInput(getFlag('clean') ?? process.env.CLEAN ?? false)

await preServerSetup(WP_NOW, { reset: RESET, clean: CLEAN })
await startServer(await getWpNowConfig(WP_NOW))

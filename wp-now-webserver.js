import { getWpNowConfig, startServer } from '@wp-now/wp-now'
import isPortReachable from 'is-port-reachable'
import { getWpNowConfigs, preServerSetup } from './playground.config.js'

const wpNowConfigs = await getWpNowConfigs()
await preServerSetup()
for (const wpNowConfig of wpNowConfigs) {
	console.group(`php = ${wpNowConfig.php} | wp = ${wpNowConfig.wp} | port = ${wpNowConfig.port}`)
	if (!await isPortReachable(wpNowConfig.port, { host: 'localhost' })) {
		await startServer(await getWpNowConfig(wpNowConfig))
		console.log('Started...')
	} else {
		console.log(`Skipped, port ${wpNowConfig.port} is already in use...`)
	}
	console.groupEnd()
}
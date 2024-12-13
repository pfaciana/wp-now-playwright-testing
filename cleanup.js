import { rmPlaywrightOldBrowsers, rmWpNowOutdatedWordPress, rmWpNowProjectDirs, hasFlag, args } from './index.js'

const dryRun = hasFlag('--simulate')
const all = hasFlag('--all')

if (dryRun) {
	console.log('Simulation mode: No directories will be deleted.\n')
} else if (all) {
	console.log('Force delete all content in directory\n')
}

const versions = all ? '*' : null

if (hasFlag('--wp-content', '-wc')) {
	console.log('Removed wp-now Projects: ', await rmWpNowProjectDirs(versions, dryRun))
}

if (hasFlag('--wordpress', '-wp')) {
	console.log('Removed Outdated WordPress Versions: ', await rmWpNowOutdatedWordPress(versions, dryRun))
}

if (hasFlag('--playwright', '-pw')) {
	console.log('Removed Old Playwright Browsers: ', await rmPlaywrightOldBrowsers(versions, dryRun))
}

if (!args.length) {
	console.log('No flags were provided. Available flags: --wp-content (-wc), --wordpress (-wp), --playwright (-pw) | --simulate')
}
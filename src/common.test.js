import { describe, it, expect } from 'vitest'
import { setFlag } from './common.js'

describe('setFlag', () => {
	const testCases = {
		'simple flag with no value': [['debug'], 'debug', true, 'true'],
		'simple -flag with no value': [['-debug'], 'debug', true, 'true'],
		'simple --flag with no value': [['--debug'], 'debug', true, 'true'],
		'simple --flag with empty value': [['--debug='], 'debug', '', ''],
		'simple --flag with true value': [['--debug=true'], 'debug', true, 'true'],
		'simple --flag with false value': [['--debug=false'], 'debug', false, 'false'],
		'simple --flag with falsey value': [['--debug=0'], 'debug', 0, '0'],
		'flag with string value': [['name=test'], 'name', 'test', 'test'],
		'flag with numeric value': [['port=8080'], 'port', 8080, '8080'],
		'flag with boolean value': [['verbose=false'], 'verbose', false, 'false'],
		'flag with version value': [['php=8.0'], 'php', 8, '8.0'],
		'flag with version value as string': [['php="8.0"'], 'php', '8.0', '"8.0"'],
		'multiple flags': [['debug=true', 'port=3000', 'name=test'], 'port', 3000, '3000'],
		'flag with JSON value': [
			['config={"host":"localhost","port":8080}'],
			'config',
			{ host: 'localhost', port: 8080 },
			'{"host":"localhost","port":8080}'],
	}

	it.each(Object.entries(testCases))('%s', (name, [args, key, parsed, raw]) => {
		const flag = setFlag(args)

		expect(flag(key)).toEqual(parsed)
		expect(flag(key, undefined, false)).toBe(raw)
	})

	it('returns default value when key does not exist', () => {
		const flag = setFlag(['debug=true'])
		expect(flag('nonexistent', 'default')).toBe('default')
	})

	it('returns all values when no key is provided', () => {
		const flag = setFlag(['debug=true', 'port=8080'])
		expect(flag()).toEqual({
			debug: true,
			port: 8080,
		})
		expect(flag(null, undefined, false)).toEqual({
			debug: 'true',
			port: '8080',
		})
	})
})

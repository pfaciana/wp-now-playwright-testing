import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { versionParser, fetchWordPressVersions, FALLBACK_WP_VERSIONS } from './wp-now.js'

describe('versionParser', () => {
	const testCases = [
		['123415678', { php: '1.2', wp: '3.4', port: 15678 }],
		['12345678', { php: '1.2', wp: '3.4', port: 5678 }],
		['1234567', { php: '1.2', wp: '3.4', port: 1234 }],
		['123456', { php: '1.2', wp: '3.4', port: 1234 }],
		['12345', { php: '1.2', wp: '3.4', port: 1234 }],
		['1234', { php: '1.2', wp: '3.4', port: 1234 }],
		['123', { php: '1.2', wp: 'latest', port: 1299 }],
		['12', { php: '1.2', wp: 'latest', port: 1299 }],
		['1', false],
		['', false],
		['987654321', { php: '9.8', wp: '7.6', port: 54321 }],
		['98765432', { php: '9.8', wp: '7.6', port: 5432 }],
		['9876543', { php: '9.8', wp: '7.6', port: 9876 }],
		['987654', { php: '9.8', wp: '7.6', port: 9876 }],
		['98765', { php: '9.8', wp: '7.6', port: 9876 }],
		['9876', { php: '9.8', wp: '7.6', port: 9876 }],
		['987', { php: '9.8', wp: 'latest', port: 9899 }],
		['98', { php: '9.8', wp: 'latest', port: 9899 }],
		['9', false],
		['php98wp76port54321', { php: '9.8', wp: '7.6', port: 54321 }],
		['ab98cde76fghijk_*|[]54321', { php: '9.8', wp: '7.6', port: 54321 }],
		['986.7-beta154321', { php: '9.8', wp: '6.7-beta1', port: 54321 }],
		['986.7.2-RC154321', { php: '9.8', wp: '6.7.2-RC1', port: 54321 }],
		['php98wp6.7.2-RC1port', { php: '9.8', wp: '6.7.2-RC1', port: 9899 }],
		['986.7-beta1543210', { php: '9.8', wp: '6.7-beta1', port: 54321 }],
		['986.7-beta1543', { php: '9.8', wp: '6.7-beta1', port: 9899 }],
		['986.7.2-RC1', { php: '9.8', wp: '6.7.2-RC1', port: 9899 }],
		['php98wp6.7.2-RC1port', { php: '9.8', wp: '6.7.2-RC1', port: 9899 }],
	]

	it.each(testCases)('versionParser %s', (input, expected) => {
		expect(versionParser(input)).toEqual(expected)
	})
})


const MOCK_API_RESPONSE = {
	offers: [
		{ version: '6.1.7' },
		{ version: '6.2.6' },
		{ version: '6.3.5' },
		{ version: '6.4.5' },
		{ version: '6.5.5' },
		{ version: '6.6.2' },
		{ version: '6.7.1' },
	],
}

const EXPECTED_PARSED_VERSIONS = {
	'6.1': '6.1.7',
	'6.2': '6.2.6',
	'6.3': '6.3.5',
	'6.4': '6.4.5',
	'6.5': '6.5.5',
	'6.6': '6.6.2',
	'6.7': '6.7.1',
	'latest': 'latest',
}

describe('fetchWordPressVersions', () => {
	beforeEach(async () => {
		vi.clearAllMocks()
		vi.spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(async () => { })

	it('should fetch and parse versions correctly', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true, json: () => Promise.resolve(MOCK_API_RESPONSE),
		})

		const result = await fetchWordPressVersions()

		expect(result).toEqual(EXPECTED_PARSED_VERSIONS)
		expect(fetch).toHaveBeenCalledTimes(1)
		expect(fetch).toHaveBeenCalledWith(
			'https://api.wordpress.org/core/version-check/1.7/',
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		)
	})

	it('should handle API errors gracefully', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			statusText: 'Not Found',
		})

		const result = await fetchWordPressVersions()

		expect(result).toEqual(FALLBACK_WP_VERSIONS)
		expect(console.warn).toHaveBeenCalledWith('API request failed: 404 Not Found')
	})

	it('should handle network timeouts', async () => {
		global.fetch = vi.fn().mockImplementation(async (url, options) => {
			return new Promise((resolve, reject) => {
				const timeoutId = setTimeout(() => {
					resolve({ ok: true, json: () => Promise.resolve({}) })
				}, 2)
				options.signal?.addEventListener('abort', () => {
					clearTimeout(timeoutId)
					reject(new DOMException('The operation was aborted', 'AbortError'))
				})
			})
		})

		const result = await fetchWordPressVersions({ timeout: 1 })

		expect(result).toEqual(FALLBACK_WP_VERSIONS)
		expect(console.warn).toHaveBeenCalledWith('Unexpected error:', 'The operation was aborted')
	})

	it('should handle malformed API response', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true, json: () => Promise.resolve({ offers1: [] }),
		})

		const result = await fetchWordPressVersions()

		expect(result).toEqual(FALLBACK_WP_VERSIONS)
		expect(console.warn).toHaveBeenCalledWith('API response missing offers data')
	})

	it('should handle invalid version data', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true, json: () => Promise.resolve({
				offers: [
					{ version: null },
					{ version: undefined },
					{ version: '' },
				],
			}),
		})

		const result = await fetchWordPressVersions()

		expect(result).toEqual(FALLBACK_WP_VERSIONS)
		expect(console.warn).toHaveBeenCalledWith('No valid versions found in API response')
	})

	it('should always include latest version', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true, json: () => Promise.resolve(MOCK_API_RESPONSE),
		})

		const result = await fetchWordPressVersions()

		expect(result.latest).toBe('latest')
	})
})

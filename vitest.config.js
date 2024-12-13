import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		exclude: [
			'**/node_modules/**',
			'**/tests/**',
			'**/dist/**',
			'**/.{idea,git,cache,output,temp}/**',
		],
	},
})

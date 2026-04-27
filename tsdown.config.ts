import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true, // TODO: migrate to 'tsgo', once stable.
	exports: true,
	minify: true,
	sourcemap: true,
	clean: true,
})

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['server/realtime/index.ts', 'server/worker/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  splitting: false,
  clean: true,
  dts: false,
  sourcemap: true,
})

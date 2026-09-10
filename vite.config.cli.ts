import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

/**
 * Builds the `mdr` command-line renderer.
 *
 * An SSR build, so Vite resolves the `?raw` stylesheet imports and the JSX
 * while leaving Node built-ins and the heavy runtime dependencies external —
 * katex's fonts and mermaid's bundle are read from node_modules at run time
 * rather than inlined into this bundle, which keeps the published package
 * small and lets both be swapped without a rebuild.
 */
export default defineConfig({
  plugins: [react()],
  define: { __MDR_VERSION__: JSON.stringify(version) },
  build: {
    ssr: true,
    target: 'node20',
    outDir: 'dist-cli',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: 'src/cli-entry.ts',
      external: ['katex', 'mermaid', 'shiki'],
      output: {
        format: 'esm',
        entryFileNames: 'mdr.mjs',
        chunkFileNames: '[name].mjs',
        banner: '#!/usr/bin/env node',
      },
    },
  },
})

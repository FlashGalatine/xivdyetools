import { defineConfig } from 'vite'
import { resolve } from 'path'
import { asyncCss } from './vite-plugin-async-css'
import { changelogParser } from './vite-plugin-changelog-parser'
import pkg from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  root: 'src',
  base: '/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    minify: 'esbuild',
    sourcemap: true,
    target: 'ES2020',
    reportCompressedSize: true,
    emptyOutDir: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lit') || id.includes('@lit')) return 'vendor-lit';
            if (id.includes('@xivdyetools/core')) return 'vendor-core';
            if (id.includes('spectral.js')) return 'vendor-spectral';
            return 'vendor';
          }
          if (
            id.includes('src/components/welcome-modal.ts') ||
            id.includes('src/components/changelog-modal.ts')
          ) return 'modals';
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    strictPort: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@shared': resolve(__dirname, './src/shared'),
      '@apps': resolve(__dirname, './src/apps'),
      '@data': resolve(__dirname, './src/data'),
      '@assets': resolve(__dirname, './assets'),
      '@mockups': resolve(__dirname, './src/mockups'),
      '@v4': resolve(__dirname, './src/components/v4'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  plugins: [
    asyncCss(),
    changelogParser(),
  ],
})

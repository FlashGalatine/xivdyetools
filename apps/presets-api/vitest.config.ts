/**
 * @entrypoint Vitest loads this config by file-name convention; its only importer is
 * tests/vitest-alias-boundary.test.ts, which checks that relative .js imports map to
 * TypeScript while dependency filenames stay intact.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
    globals: true,
  },
  resolve: {
    alias: [
      // Adapt relative TypeScript imports without stripping dependency filenames.
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' },
    ],
  },
  esbuild: {
    target: 'node18',
  },
});

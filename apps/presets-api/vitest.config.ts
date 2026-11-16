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
    // About twenty files here run against a real local D1 (tests/sqlite-d1.ts), and their
    // concurrency cases already take 2-5 s on a quiet machine. On a busy runner they overran the
    // 5 s default: two cases in preview-image-runtime.test.ts took 5.4 s and 8.3 s and failed a
    // production deploy on 2026-11-16, and submission-admission-runtime.test.ts did the same
    // locally at 5.2 s. The limit is headroom, not a normal duration.
    testTimeout: 30_000,
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

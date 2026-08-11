import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    server: {
      deps: {
        inline: ['@xivdyetools/core', '@xivdyetools/test-utils', 'spectral.js'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        // Test scaffolding, not shipped code — counting its mocks as product
        // surface understated the real figure by ~8 points on functions.
        'src/**/test-setup.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
    globals: true,
  },
  resolve: {
    alias: [
      { find: /^(\..+)\.js$/, replacement: '$1' },
    ],
  },
});

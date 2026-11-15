import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // index.logger-context.test.ts resets modules before every case, so each one
    // re-imports the whole bootstrap graph. Cold, on a busy runner, that import
    // alone overran the 5 s default and the late import then double-counted
    // `login` in the next case. The limit is headroom, not a normal duration.
    testTimeout: 30_000,
    server: {
      deps: {
        inline: ['@xivdyetools/core', '@xivdyetools/test-utils'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test-utils/**',
        'src/types/**',
        'src/index.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
});

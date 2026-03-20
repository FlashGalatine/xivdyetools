import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/types.ts',
        '**/*.test.ts',
        '**/*.d.ts',
        'src/__tests__/mocks/**',
        // Durable Objects — not testable via vitest (requires workerd runtime)
        'src/services/rate-limit-do.ts',
        'src/durable-objects/**',
      ],
      thresholds: {
        statements: 90,
        branches: 88,
        functions: 90,
        lines: 90,
      },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      // BUG-127: on, so `run test` (and turbo/CI) enforces the thresholds below instead of only recording them.
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      all: true,
      clean: true,
      skipFull: false,
    },
    include: ['src/**/*.test.ts'],
    reporters: ['verbose'],
  },
});

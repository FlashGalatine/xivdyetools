import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
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
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      all: true,
      clean: true,
      skipFull: false,
    },
    include: ['src/**/*.test.ts'],
    reporters: ['verbose'],
  },
});

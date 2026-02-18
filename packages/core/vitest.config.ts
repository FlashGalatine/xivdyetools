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
        'src/**/__tests__/**',
        'src/data/**',
        'src/index.ts',
        'src/constants/index.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/.{git,cache,output,temp}/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 88,
        statements: 90,
      },
      all: true,
      clean: true,
      skipFull: false,
      perFile: false,
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

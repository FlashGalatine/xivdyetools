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
        'src/index.ts',
        'src/types.ts',
        'src/adapters/index.ts',
        'src/core/index.ts',
        'src/presets/index.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/.{git,cache,output,temp}/**',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
      all: true,
      clean: true,
      skipFull: false,
    },
    include: ['src/**/*.test.ts'],
    reporters: ['verbose'],
  },
});

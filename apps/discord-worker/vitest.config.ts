import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: ['@xivdyetools/core', '@xivdyetools/test-utils'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/types/**',
        'src/locales/**',
        'src/fonts/**',
        'src/data/**',
        'src/services/svg/renderer.ts',
        'src/services/svg/dye-info-card.ts',
        'src/services/svg/random-dyes-grid.ts',
        'src/services/svg/budget-comparison.ts',
        'src/services/budget/**',
        'src/handlers/commands/budget.ts',
        'src/handlers/commands/extractor.ts',
        'src/handlers/commands/swatch.ts',
        'src/handlers/commands/mixer-v4.ts',
        'src/handlers/commands/gradient.ts',
        'src/handlers/commands/preferences.ts',
        'src/services/announcements.ts',
        'src/services/changelog-parser.ts',
        'src/utils/verify.ts',
        'src/utils/github-verify.ts',
        'src/handlers/modals/index.ts',
        'src/handlers/commands/index.ts',
        'src/services/image/index.ts',
        'src/services/svg/index.ts',
      ],
      thresholds: {
        global: {
          statements: 85,
          branches: 70,
          functions: 85,
          lines: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

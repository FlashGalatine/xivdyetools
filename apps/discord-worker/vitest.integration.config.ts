import { defineConfig } from 'vitest/config';
import { markdownAsText } from './vitest.markdown-plugin.js';

export default defineConfig({
  // Same `.md`-as-text resolution as vitest.config.ts (see that file).
  plugins: [markdownAsText()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 15000,
    server: {
      deps: {
        inline: ['@xivdyetools/core', '@xivdyetools/test-utils'],
      },
    },
    // No coverage thresholds — integration tests supplement, not replace
  },
});

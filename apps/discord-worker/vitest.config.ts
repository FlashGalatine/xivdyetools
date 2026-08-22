import { defineConfig, configDefaults } from 'vitest/config';
import { markdownAsText } from './vitest.markdown-plugin.js';

export default defineConfig({
  // `.md` imports resolve to their text, as wrangler's Text rule does in the
  // deployed Worker (/changelog bundles CHANGELOG-laymans.md that way).
  plugins: [markdownAsText()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // vitest.integration.config.ts owns *.integration.test.ts — without this
    // exclude, `src/**/*.test.ts` also matches it and test:all runs it twice.
    exclude: [...configDefaults.exclude, 'src/**/*.integration.test.ts'],
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
        // Test scaffolding, not shipped code
        'src/test-utils.ts',
        // 2026-08-18 dead-code audit (DEAD-007): the include/exclude split
        // that stops *.integration.test.ts from double-running under the
        // unit config also stops it exercising this integration-only helper
        // under `test:coverage` — it has no unit-test consumer, so it needs
        // the same scaffolding exclusion as test-utils.ts above.
        'src/test-utils.integration.ts',
        'src/types/**',
        'src/fonts/**',
        'src/data/**',
        'src/services/svg/renderer.ts',
        'src/services/budget/**',
        'src/handlers/commands/budget.ts',
        'src/handlers/commands/extractor.ts',
        'src/handlers/commands/swatch.ts',
        'src/handlers/commands/mixer-v4.ts',
        'src/handlers/commands/gradient.ts',
        'src/handlers/commands/preferences.ts',
        'src/utils/github-verify.ts',
        'src/handlers/commands/index.ts',
      ],
      // Statements / functions / lines clear the 80% bar comfortably.
      // Branches is a RATCHET at the achieved figure rather than the 80%
      // target: the remaining gap is concentrated in `src/index.ts` (the
      // interaction router) and `handlers/commands/preset.ts`, which between
      // them hold ~190 uncovered branches. Raise this as those land; do not
      // lower it.
      //
      // 2026-08-18 dead-code audit (DEAD-001/002/003): removing
      // component-context.ts, the preset-api.ts moderation client and the
      // three orphaned modules deleted code that was itself fully unit
      // tested, so it lowered the aggregate statements figure (85.4% ->
      // 84.88%) even though nothing got LESS covered. `statements` moved
      // down to the new achieved figure; don't lower it further without a
      // similar reason.
      thresholds: {
        statements: 84,
        branches: 77,
        functions: 88,
        lines: 85,
      },
    },
  },
});

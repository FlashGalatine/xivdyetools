import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      clean: true,
      // Anything listed here is invisible to the gate, so the list is kept
      // deliberately short and every entry states why it cannot be measured.
      // (It previously carried 11 paths that no longer exist and 25 files
      // that had since grown tests — both kinds silently shrank the
      // denominator, which reads as coverage the suite never had.)
      exclude: [
        'node_modules/',
        'dist/',
        'src/__tests__/**',
        'src/locales/**/*.json',
        // Barrel + type-only modules: no executable statements to cover
        'src/services/index.ts',
        'src/shared/browser-api-types.ts',
        'src/shared/types.ts',
        // Large Lit shells still awaiting tests — tracked, not forgotten
        'src/components/v4/dye-palette-drawer.ts',
        'src/components/v4/preset-tool.ts',
        'src/components/v4/preset-detail.ts',
        'src/components/v4/v4-layout-shell.ts',
        'src/components/v4/display-options-v4.ts',
        'src/components/preset-edit-form.ts',
        'src/components/collection-manager-modal.ts',
        'src/components/add-to-collection-menu.ts',
        'src/components/welcome-modal.ts',
        'src/components/recent-colors-panel.ts',
        'src/services/share-service.ts',
        'src/services/community-preset-service.ts',
        'src/services/hybrid-preset-service.ts',
      ],
      // Vitest 2 moved these under `coverage.thresholds`. Left at the top
      // level (the 0.x/1.x shape) they were silently ignored, so this suite
      // had no coverage gate at all — which is how the numbers below came as
      // a surprise.
      //
      // RATCHET, not a target. These are set just under what the suite
      // actually achieves so the figure cannot regress; the goal remains
      // 80/80/80/75, which is also what `scripts/coverage-report.ts` holds
      // every app to.
      //
      // 2026-09-03: raised from 71/55/65/72 after the coverage sweep. Five
      // components had no test file at all (advanced-options-panel,
      // v4/language-modal, export-sheet, v4/share-button, v4/dye-filters-v4 —
      // 438 uncovered statements) and three more had suites that asserted
      // shape rather than behaviour (v4/v4-color-wheel, camera-preview-modal,
      // v4/result-card). Measured after that work: 78.45/64.08/74.63/79.82.
      //
      // What is left is the nine tool components (accessibility, budget,
      // comparison, extractor, gradient, harmony, mixer, swatch +
      // chara-import) plus v4/config-sidebar and result-card's context-menu
      // action handlers; between them they hold most of the remaining
      // uncovered statements and almost all of the branch gap. Raise these
      // numbers as those tests deepen; do not lower them.
      thresholds: {
        statements: 78,
        branches: 63,
        functions: 74,
        lines: 79,
      },
    },
    // scripts/ holds the CI gates (check-bundle-size, check-beta-build,
    // smoke-test-pages) and the i18n guardrails; eslint-rules/ holds the custom
    // lint rules. All are plain .js ESM, not .ts, so they need their own
    // patterns rather than an extension widened on the src glob.
    include: [
      'src/**/*.{test,spec}.ts',
      'scripts/**/*.{test,spec}.js',
      'eslint-rules/**/*.{test,spec}.js',
    ],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    server: {
      deps: {
        inline: ['@xivdyetools/core'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@services': resolve(__dirname, './src/services'),
      '@shared': resolve(__dirname, './src/shared'),
      '@apps': resolve(__dirname, './src/apps'),
      '@data': resolve(__dirname, './src/data'),
      'virtual:changelog': resolve(__dirname, './src/__tests__/mocks/virtual-changelog.ts'),
    },
  },
})

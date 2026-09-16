import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import pluginPrettier from 'eslint-plugin-prettier/recommended'
import i18nPlugin from './eslint-rules/no-i18n-fallback.js'

export default [
  {
    ignores: [
      'node_modules',
      'dist',
      '*.html',
      '*.md',
      'coverage',
      '.git',
      '.vscode',
      '.eslintignore',
      '.eslintrc.json',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
      },
    },
    plugins: {
      'xivdyetools-i18n': i18nPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      // console.warn/error are legitimate escalation paths; everything else must
      // go through @shared/logger, whose info/debug are dev-gated. `info` was
      // allowed here once, which is how ~24 emoji-tagged console.info traces
      // (one of them logging the OAuth callback URL) shipped to production
      // (2026-08-16 audit, DEAD-018).
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      // Custom i18n rule: warn against fallback patterns
      'xivdyetools-i18n/no-i18n-fallback': 'warn',
      // Custom i18n rule: user-visible English that never reaches
      // LanguageService. `warn` while the tail from the 2026-08-20 audit is
      // worked down - promote to `error` once the count reaches zero.
      'xivdyetools-i18n/no-hardcoded-ui-strings': 'warn',
    },
  },
  {
    // BUG-040 (2026-09-16 deep-dive audit): RouterService must be imported
    // through the @services/index barrel in every component — a component
    // test mocks the barrel, not @services/router-service directly, so a
    // value import that reaches past it makes the mock inert (the PR #161
    // trap, repeated three times). Type-only `ToolId` imports are unaffected
    // — nothing mocks a type.
    //
    // welcome-modal.ts is deliberately exempted: it is the ONE component in
    // the "modals" manual chunk (vite.config.ts) that had never touched
    // `@services/index` before. Routing its RouterService import through the
    // barrel makes the whole barrel graph reachable from that chunk for the
    // first time, and Rolldown's manualChunks handling (see the "core
    // runtime" comment in scripts/check-bundle-size.js) merges much of it in
    // — measured: modals-*.js grew from 274.71 KB to 367.80 KB against a
    // 280 KB budget, failing `build:check`. scripts/check-bundle-size.js is
    // outside this task's allowed paths (apps/web-app/src/** + this config),
    // so the budget can't move either. welcome-modal.ts keeps its direct
    // `@services/router-service` import until that's addressed separately.
    files: ['src/components/**/*.ts'],
    ignores: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/components/welcome-modal.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@services/router-service',
              message:
                'Import RouterService from the @services/index barrel instead (component tests mock the barrel). Type-only `ToolId`/`RouteState` imports are still fine from @services/router-service directly.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  pluginPrettier,
  prettier,
]

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
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      // Custom i18n rule: warn against fallback patterns
      'xivdyetools-i18n/no-i18n-fallback': 'warn',
    },
  },
  pluginPrettier,
  prettier,
]

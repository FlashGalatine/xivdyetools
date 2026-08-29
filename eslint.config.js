import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.wrangler/**',
      '**/scripts/**',
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules with type checking
  ...tseslint.configs.recommendedTypeChecked,

  // TypeScript-specific configuration
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused variables (allow underscore-prefixed)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],

      // Function signatures
      '@typescript-eslint/explicit-function-return-type': 'warn',

      // Async safety
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Type safety
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/only-throw-error': 'warn',

      // Security
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // Workers runtime: fetch() accepts only redirect: 'follow' | 'manual'.
      // 'error' type-checks (lib.dom) but workerd throws
      // `TypeError: Invalid redirect value` at run time — which unit tests
      // never see because they mock fetch. It took the Universalis proxy,
      // the .chara resolver and /swatch down in production on 2026-08-28/29.
      // Use 'manual' and refuse 3xx responses explicitly.
      'no-restricted-syntax': [
        'error',
        {
          selector: "Property[key.name='redirect'] > Literal[value='error']",
          message:
            "redirect: 'error' is not implemented by the Workers runtime (only 'follow' | 'manual'); use 'manual' and treat a 3xx response as a failure.",
        },
      ],
    },
  },

  // Relaxed rules for test files and test infrastructure
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/__tests__/**', '**/test-setup.ts', '**/test-helpers.ts', '**/test-utils/src/**', '**/test-utils.ts', '**/test-utils.*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);

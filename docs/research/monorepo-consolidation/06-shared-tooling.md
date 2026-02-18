# 06 — Shared Tooling: Linting, Formatting & Testing

## ESLint: Root Flat Config

Currently only `@xivdyetools/core` and `web-app` have ESLint configs. The monorepo will standardize linting across all packages with a root flat config that each project extends.

### Root eslint.config.js

Based on the existing `core/eslint.config.js` pattern:

```javascript
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
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

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
    },
  }
);
```

### Per-Project Extensions

Projects with special needs create their own `eslint.config.js` that extends the root:

**Web App** (has custom i18n rules, Prettier integration, Lit-specific rules):
```javascript
import rootConfig from '../../eslint.config.js';
import prettier from 'eslint-config-prettier';

export default [
  ...rootConfig,
  prettier,
  {
    // web-app-specific rules
    rules: {
      // Lit decorators produce patterns that trigger these
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
];
```

**Workers** that don't need special rules simply inherit the root config by not having their own `eslint.config.js`. ESLint flat config automatically walks up the directory tree.

### Adding lint Scripts

Projects that currently lack linting will get a `lint` script in their `package.json`:

```json
"scripts": {
  "lint": "eslint src"
}
```

## Prettier: Root Config

### prettier.config.js

Based on `core`'s `.prettierrc.json`, converted to JS for consistency:

```javascript
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
};
```

### .prettierignore

```
dist
node_modules
coverage
.wrangler
pnpm-lock.yaml
*.md
```

### Pre-commit Hooks

Migrate `core`'s existing husky + lint-staged setup to root level:

**Root package.json additions:**
```json
{
  "devDependencies": {
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7"
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yaml,yml}": [
      "prettier --write"
    ]
  }
}
```

Initialize husky:
```bash
pnpm exec husky init
echo "pnpm exec lint-staged" > .husky/pre-commit
```

## Vitest: Per-Project Configs

### Why Per-Project (Not Shared)

Test configurations differ significantly across projects:

| Project | Environment | Special Config |
|---------|------------|----------------|
| `core` | `node` | 90% coverage thresholds, 10s timeout |
| `discord-worker` | `node` | Path aliases (`@/`), dep inlining (`@xivdyetools/core`) |
| `presets-api` | `miniflare` | `@cloudflare/vitest-pool-workers`, `.js` extension aliases |
| `oauth` | `miniflare` | `@cloudflare/vitest-pool-workers` |
| `web-app` | `jsdom` | MSW request mocking, path aliases |
| `types` | `node` | 80% coverage thresholds |

A single shared vitest config would need so many overrides it wouldn't be useful.

### Vitest Workspace File (Optional)

For running all tests from the root in a unified manner:

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
]);
```

This enables `vitest --workspace` for development, while `pnpm turbo run test` remains the primary way to run tests (with caching and affected-only filtering).

### Turborepo Test Pipeline

```json
"test": {
  "dependsOn": ["^build"],
  "cache": true,
  "inputs": ["src/**", "tests/**", "vitest.config.*"],
  "outputs": ["coverage/**"]
}
```

`dependsOn: ["^build"]` ensures library `dist/` directories are populated before consumer tests run (since tests import from the libraries).

## Wrangler: Stays Per-Worker

Each Cloudflare Worker keeps its own `wrangler.toml`. These configs are inherently per-deployment-unit and contain:

- Worker name and routes
- D1 database bindings (IDs are environment-specific)
- KV namespace bindings
- Service bindings (Worker-to-Worker references)
- Secrets documentation
- Binary file rules
- Environment-specific overrides

There is no value in sharing wrangler configuration.

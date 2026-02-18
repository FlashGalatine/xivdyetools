# 05 — TypeScript Configuration

## Strategy: Shared Base Config, No Project References

### Why NOT Project References / Composite

TypeScript project references (`composite: true`) require inter-package imports to resolve through `dist/` (compiled output). This means you must build a package before its consumers can type-check.

While technically correct, this adds friction without benefit in this setup because:

1. **Turborepo already handles build ordering** — `dependsOn: ["^build"]` ensures upstream packages are built before downstream consumers
2. **Bundlers resolve TypeScript source directly** — Vite, Wrangler, and other bundlers used by the apps don't need pre-compiled output during development
3. **Composite requires `declarationDir` coordination** — adds config complexity across 15 packages for no practical gain

### Normalizing Current Differences

| Setting | Current State | Target |
|---------|--------------|--------|
| `target` | ES2020 (core, web-app), ES2022 (workers) | **ES2022** — all runtimes (modern browsers, Node 18+, CF Workers) support it |
| `moduleResolution` | `"node"` (logger), `"bundler"` (everything else) | **`"bundler"`** — all consumers use bundlers |
| `module` | `"ESNext"` everywhere | **`"ESNext"`** — no change needed |
| `strict` | `true` everywhere | **`true`** — no change needed |
| `verbatimModuleSyntax` | Only in auth | **`true`** — enforce explicit type imports everywhere |

## Shared Base: tsconfig.base.json

Located at the monorepo root, extended by all packages and apps:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Per-Package Extension Patterns

### Pattern A: Library (packages/types, packages/crypto, packages/logger, etc.)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

Each library also keeps a `tsconfig.build.json` for build-only settings (same as current pattern):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/__tests__/**"]
}
```

### Pattern B: Cloudflare Worker (apps/discord-worker, apps/presets-api, etc.)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"]
}
```

Workers use `noEmit: true` because Wrangler handles bundling. They don't generate declarations since they're not consumed as libraries.

### Pattern C: Web App (apps/web-app)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "jsx": "react-jsx",
    "jsxImportSource": "lit",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@services/*": ["./src/services/*"],
      "@shared/*": ["./src/shared/*"]
    }
  },
  "include": ["src/**/*"]
}
```

The web app has Lit-specific settings (`experimentalDecorators`, `jsxImportSource`) and multiple path aliases. It also needs `DOM` and `DOM.Iterable` libs.

### Pattern D: Maintainer (apps/maintainer)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "jsx": "preserve"
  },
  "include": ["src/**/*"]
}
```

Vue 3 uses `jsx: "preserve"` (handled by vue-tsc and Vite's Vue plugin).

## How Type Resolution Works Across Packages

With `workspace:*` dependencies, pnpm creates symlinks in `node_modules/@xivdyetools/` pointing to the local package directories. TypeScript resolves types through each package's `"types"` field in `package.json`, which points to `dist/index.d.ts`.

**Development flow:**
1. Run `pnpm turbo run build` once to populate all `dist/` directories
2. IDE intellisense works across package boundaries via the compiled `.d.ts` files
3. When you change a library's source, rebuild it: `pnpm turbo run build --filter=@xivdyetools/types`
4. Consumer apps immediately see updated types (symlinked `dist/`)

**Alternative (if faster feedback is desired):** Add `paths` entries in consumer tsconfigs to point at source files:
```json
"paths": {
  "@xivdyetools/types": ["../../packages/types/src"],
  "@xivdyetools/types/*": ["../../packages/types/src/*"]
}
```
However, this can cause discrepancies between what the IDE sees and what the build produces. The recommended approach is: build once, then develop.

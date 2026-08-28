# Beta Web App Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every non-`main` branch of `web-app` to `https://beta.xivdyetools.app`, visibly marked as beta and excluded from search engines, without any risk to the production deployment.

**Architecture:** A second Cloudflare Pages project (`xivdyetools-beta`, already created with `--production-branch=beta`) receives builds from a new GitHub Actions workflow. A single Vite plugin, active only when `VITE_APP_ENV=beta`, applies every beta-specific difference: the `[BETA]` title prefix, the blue favicon set, and an `X-Robots-Tag` header. Production builds are byte-identical to today's.

**Tech Stack:** Vite 8, TypeScript 5.9 (strict), Vitest 4, `sharp` (already a devDependency), Cloudflare Pages + Wrangler, GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-08-09-beta-web-app-deployment-design.md](../specs/2026-08-09-beta-web-app-deployment-design.md)

## Global Constraints

- Branch: `monorepo-2.0-prep`. Do **not** merge to `main`; do **not** push unless asked.
- **A production build must be behaviourally unchanged.** Every beta difference is gated on
  `VITE_APP_ENV === 'beta'`. Concretely, with the flag unset: `dist/index.html`'s `<title>` has no
  `[BETA]` prefix, no icon link points into `/assets/icons/beta/`, and `dist/_headers` has no
  `X-Robots-Tag`. This does **not** mean the emitted JS is byte-identical — Task 2 legitimately
  changes `router-service.ts` source, so the bundle hash will move. Byte-identical *rendered
  output*, not byte-identical bundles.
- Pages project name is exactly `xivdyetools-beta`; deploy branch is exactly `beta`. Both already exist — do not create or rename them.
- Beta domain is exactly `https://beta.xivdyetools.app` (no trailing slash in allowlist entries).
- `apps/web-app` type-check covers `src` only (`tsconfig.json` → `"include": ["src"]`). Root-level `*.ts` files such as `vite.config.ts` and the Vite plugins are **not** type-checked. Put logic that deserves type-checking and tests in `src/`.
- Vitest `include` is `src/**/*.{test,spec}.ts`. A test outside `src/` will never run.
- Vitest has **no** `define` block, so `__APP_VERSION__`, `__BUILD_DATE__` and the new `__APP_ENV__` are all `undefined` under test. Every consumer must use the `typeof x !== 'undefined'` guard already established in `src/shared/constants.ts`.
- The repo uses Prettier via ESLint (`prettier/prettier` is an **error**). Run `pnpm --filter xivdyetools-web-app run lint` before every commit; fix formatting with `run lint:fix` and review the diff.
- Two pre-existing lint warnings in `src/components/v4/share-button.ts` are expected and unrelated. Lint must report `0 errors`; 2 warnings is the clean baseline.
- Do not fix the `robots.txt` / `manifest.json` / `service-worker.js` packaging gap, and do not add the missing production `favicon-48x48.png`. Both are out of scope per the spec.
- Commit messages: conventional-commit prefix, and end with
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- **Shell:** every command block in this plan is POSIX shell — run them in **Bash** (Git Bash),
  not PowerShell. Three constructs in particular are bash-only:
  - `VITE_APP_ENV=beta pnpm run build` — PowerShell has no inline env-var prefix. The PowerShell
    equivalent is `$env:VITE_APP_ENV = 'beta'; pnpm run build`, and you must then clear it with
    `$env:VITE_APP_ENV = $null` before doing a production build in the same session, or you will
    "verify" a beta build and believe it is production.
  - `git commit -F- <<'EOF' … EOF` heredocs.
  - `mkdir -p`, `cp`, `ls -l`.
- `apps/web-app/package.json` sets `"type": "module"`, so `scripts/*.js` are ESM. Use `import`,
  not `require`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `apps/web-app/src/shared/beta-branding.ts` | create | Pure string transforms + constants for beta branding. No I/O, no Vite imports — so it is type-checked and unit-testable. |
| `apps/web-app/src/shared/__tests__/beta-branding.test.ts` | create | Tests for the above. |
| `apps/web-app/src/shared/constants.ts` | modify | `APP_ENV`, `resolveAppName()`, `APP_NAME` becomes beta-aware. |
| `apps/web-app/src/shared/__tests__/constants.test.ts` | create | Tests `resolveAppName` both branches. |
| `apps/web-app/src/services/router-service.ts` | modify | Replace 3 hardcoded `'XIV Dye Tools'` literals with `APP_NAME`. |
| `apps/web-app/src/services/__tests__/router-service.test.ts` | modify | One assertion pinning titles to `APP_NAME`. |
| `apps/web-app/scripts/assets/bot-avatar-beta-1024.png` | create | Source artwork, kept next to the script that consumes it and outside `public/` so it never ships. |
| `apps/web-app/scripts/generate-beta-icons.mjs` | create | One-shot `sharp` generator. Output is committed; this is not run in CI. |
| `apps/web-app/public/assets/icons/beta/*` | create | 7 generated icon files. |
| `apps/web-app/vite-plugin-beta-branding.ts` | create | Thin Vite wrapper around `beta-branding.ts`. |
| `apps/web-app/vite.config.ts` | modify | `__APP_ENV__` define + register the plugin. |
| `apps/web-app/scripts/check-beta-build.js` | create | Post-build assertion, run only in the beta workflow. |
| `apps/oauth/src/constants/oauth.ts` | modify | Add the beta origin to `ALLOWED_REDIRECT_ORIGINS`. |
| `apps/oauth/src/__tests__/oauth-constants.test.ts` | create | Pins the allowlist behaviour. |
| `apps/presets-api/wrangler.toml` | modify | Add the beta origin to `ADDITIONAL_CORS_ORIGINS`. |
| `.github/workflows/deploy-web-app-beta.yml` | create | The beta deploy. |
| `docs/operations/DEPLOY_ENVIRONMENTS.md` | modify | Document the beta web app. |
| `apps/web-app/CLAUDE.md` | modify | Document `VITE_APP_ENV` and the beta deploy. |

---

## Task 1: Beta branding transforms (pure module)

**Files:**
- Create: `apps/web-app/src/shared/beta-branding.ts`
- Test: `apps/web-app/src/shared/__tests__/beta-branding.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BETA_TITLE_PREFIX: string` — `'[BETA] '`
  - `BASE_APP_NAME: string` — `'XIV Dye Tools'`
  - `BETA_HEADERS_BLOCK: string` — text appended to `dist/_headers`
  - `brandHtmlForBeta(html: string): string`

- [ ] **Step 1: Write the failing test**

Create `apps/web-app/src/shared/__tests__/beta-branding.test.ts`:

```ts
/**
 * XIV Dye Tools - Beta branding transform tests
 *
 * These run against the same pure functions the Vite plugin calls, so the
 * branding logic is covered without executing a build.
 */

import { describe, it, expect } from 'vitest';
import {
  BASE_APP_NAME,
  BETA_HEADERS_BLOCK,
  BETA_TITLE_PREFIX,
  brandHtmlForBeta,
} from '../beta-branding';

/** The seven icon links as they appear in src/index.html, plus two links that must NOT change. */
const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>XIV Dye Tools - FFXIV Dye Color Matcher</title>
    <link rel="canonical" href="https://xivdyetools.app/" />
    <link rel="icon" type="image/x-icon" href="/assets/icons/favicon.ico" />
    <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16x16.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/assets/icons/favicon-48x48.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/icon-192x192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/assets/icons/icon-512x512.png" />
    <link rel="manifest" href="/manifest.json" />
  </head>
  <body></body>
</html>`;

describe('brandHtmlForBeta', () => {
  it('prefixes the document title', () => {
    expect(brandHtmlForBeta(SAMPLE_HTML)).toContain(
      `<title>${BETA_TITLE_PREFIX}XIV Dye Tools - FFXIV Dye Color Matcher</title>`
    );
  });

  it('is idempotent — a second pass does not double-prefix', () => {
    const once = brandHtmlForBeta(SAMPLE_HTML);
    expect(brandHtmlForBeta(once)).toBe(once);
  });

  it('repoints every icon link at the beta set', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    for (const file of [
      'favicon.ico',
      'favicon-16x16.png',
      'favicon-32x32.png',
      'favicon-48x48.png',
      'apple-touch-icon.png',
      'icon-192x192.png',
      'icon-512x512.png',
    ]) {
      expect(out).toContain(`href="/assets/icons/beta/${file}"`);
    }
    // No icon link may still point at the production set.
    expect(out).not.toMatch(/rel="(icon|apple-touch-icon)"[^>]*href="\/assets\/icons\/(?!beta\/)/);
  });

  it('leaves non-icon links alone', () => {
    const out = brandHtmlForBeta(SAMPLE_HTML);
    expect(out).toContain('<link rel="canonical" href="https://xivdyetools.app/" />');
    expect(out).toContain('<link rel="manifest" href="/manifest.json" />');
  });

  it('does not depend on attribute order', () => {
    const reordered = '<link href="/assets/icons/favicon.ico" rel="icon" />';
    expect(brandHtmlForBeta(reordered)).toBe(
      '<link href="/assets/icons/beta/favicon.ico" rel="icon" />'
    );
  });

  it('exposes a headers block that suppresses indexing', () => {
    expect(BETA_HEADERS_BLOCK).toContain('X-Robots-Tag: noindex, nofollow');
    expect(BETA_HEADERS_BLOCK).toContain('/*');
  });

  it('exposes the unprefixed product name', () => {
    expect(BASE_APP_NAME).toBe('XIV Dye Tools');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/shared/__tests__/beta-branding.test.ts`
Expected: FAIL — `Failed to resolve import "../beta-branding"`.

- [ ] **Step 3: Write the implementation**

Create `apps/web-app/src/shared/beta-branding.ts`:

```ts
/**
 * XIV Dye Tools - Beta build branding
 *
 * Pure string transforms applied at build time when `VITE_APP_ENV=beta`, so
 * that `beta.xivdyetools.app` is distinguishable from production at a glance
 * and stays out of search results.
 *
 * They live in `src/` rather than beside the Vite plugin deliberately: the
 * package root is outside `tsconfig`'s `include` and outside Vitest's `include`,
 * so logic placed there is neither type-checked nor testable.
 * `vite-plugin-beta-branding.ts` is a thin wrapper over this module.
 *
 * @module shared/beta-branding
 */

/** Marks a build as beta wherever the product name is shown. */
export const BETA_TITLE_PREFIX = '[BETA] ';

/** Product name without any environment marker. */
export const BASE_APP_NAME = 'XIV Dye Tools';

/** Where the beta icon set lives, relative to the site root. */
const BETA_ICON_PATH = '/assets/icons/beta/';

/**
 * Appended to `dist/_headers` for a beta build.
 *
 * Cloudflare Pages merges the rules of repeated path patterns, so a second
 * `/*` section adds this header rather than replacing the security headers
 * already declared in `public/_headers`.
 */
export const BETA_HEADERS_BLOCK = `
# ============================================================================
# Beta deployment - keep it out of search results.
# Appended at build time by vite-plugin-beta-branding. Never present in a
# production build; do not add this to public/_headers.
# ============================================================================
/*
  X-Robots-Tag: noindex, nofollow
`;

/**
 * Rewrite `index.html` for a beta build.
 *
 * Icon links are matched by their href *prefix* rather than against a list of
 * filenames, so adding an icon to `index.html` later cannot silently leave
 * beta pointing at the production artwork. The `(?!beta\/)` guard makes the
 * transform idempotent.
 */
export function brandHtmlForBeta(html: string): string {
  const titled = html.replace(/<title>([\s\S]*?)<\/title>/, (match, title: string) =>
    title.startsWith(BETA_TITLE_PREFIX) ? match : `<title>${BETA_TITLE_PREFIX}${title}</title>`
  );

  return titled.replace(/<link\b[^>]*>/g, (tag) => {
    if (!/\brel="(?:icon|apple-touch-icon)"/.test(tag)) return tag;
    return tag.replace(/\bhref="\/assets\/icons\/(?!beta\/)/, `href="${BETA_ICON_PATH}`);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/shared/__tests__/beta-branding.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Lint and type-check**

Run: `pnpm --filter xivdyetools-web-app run lint && pnpm --filter xivdyetools-web-app run type-check`
Expected: `0 errors` (2 pre-existing `share-button.ts` warnings are fine); type-check silent.

- [ ] **Step 6: Commit**

```bash
git add apps/web-app/src/shared/beta-branding.ts apps/web-app/src/shared/__tests__/beta-branding.test.ts
git commit -F- <<'EOF'
feat(web-app): add pure beta-branding transforms

Title prefix, beta icon-path rewrite and the noindex `_headers` block, as pure
string functions. They live in src/ rather than beside the Vite plugin because
the package root is outside both tsconfig's and Vitest's `include`, so logic
placed there would be neither type-checked nor tested.

Icon hrefs are rewritten by path prefix rather than against a filename list, so
adding an icon to index.html later cannot silently leave beta on the production
artwork. The transform is idempotent.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 2: Make `APP_NAME` environment-aware and use it in the router

**Files:**
- Modify: `apps/web-app/src/shared/constants.ts:17` (the `APP_NAME` line)
- Modify: `apps/web-app/src/services/router-service.ts:190,227,347`
- Create: `apps/web-app/src/shared/__tests__/constants.test.ts`
- Modify: `apps/web-app/src/services/__tests__/router-service.test.ts`

**Interfaces:**
- Consumes: `BASE_APP_NAME`, `BETA_TITLE_PREFIX` from Task 1.
- Produces:
  - `APP_ENV: string` — `'beta'` or `'production'`
  - `resolveAppName(env: string): string`
  - `APP_NAME: string` — unchanged name, now beta-aware

**Why this task exists:** `RouterService` assigns `document.title = \`${route.title} | XIV Dye Tools\`` at three separate sites. An `index.html`-only title change would be overwritten by the first navigation. `APP_NAME` already existed and was simply never used here.

- [ ] **Step 1: Write the failing tests**

Create `apps/web-app/src/shared/__tests__/constants.test.ts`:

```ts
/**
 * XIV Dye Tools - Application constants tests
 */

import { describe, it, expect } from 'vitest';
import { APP_ENV, APP_NAME, resolveAppName } from '../constants';

describe('resolveAppName', () => {
  it('returns the plain product name for production', () => {
    expect(resolveAppName('production')).toBe('XIV Dye Tools');
  });

  it('marks beta builds', () => {
    expect(resolveAppName('beta')).toBe('[BETA] XIV Dye Tools');
  });

  it('treats an unknown environment as production rather than guessing', () => {
    expect(resolveAppName('staging')).toBe('XIV Dye Tools');
  });
});

describe('APP_ENV', () => {
  it('falls back to production when __APP_ENV__ is not defined', () => {
    // Vitest has no `define` block, so the guard in constants.ts is what runs
    // here. This asserts the fallback, which is also what a plain `vite build`
    // without VITE_APP_ENV produces.
    expect(APP_ENV).toBe('production');
    expect(APP_NAME).toBe('XIV Dye Tools');
  });
});
```

Add to `apps/web-app/src/services/__tests__/router-service.test.ts`, inside the existing top-level `describe('RouterService', …)` block, immediately before its closing `});`:

```ts
  // ==========================================================================
  // Title composition
  // ==========================================================================

  describe('Document title', () => {
    it('composes titles from APP_NAME so a beta build is marked everywhere', async () => {
      const { APP_NAME } = await import('@shared/constants');
      const router = new RouterService();
      router.navigate('comparison');
      expect(document.title.endsWith(` | ${APP_NAME}`)).toBe(true);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/shared/__tests__/constants.test.ts`
Expected: FAIL — `resolveAppName` is not exported.

- [ ] **Step 3: Update `constants.ts`**

In `apps/web-app/src/shared/constants.ts`, add the import beneath the two existing type imports:

```ts
import { BASE_APP_NAME, BETA_TITLE_PREFIX } from './beta-branding';
```

Then replace the single line `export const APP_NAME = 'XIV Dye Tools';` with:

```ts
/**
 * Build environment, injected by Vite's `define`. `'beta'` for builds published
 * to beta.xivdyetools.app; absent everywhere else — including under Vitest,
 * which has no `define` block — hence the `typeof` guard.
 */
declare const __APP_ENV__: string;
export const APP_ENV = typeof __APP_ENV__ !== 'undefined' ? __APP_ENV__ : 'production';

/**
 * Product name for a given build environment. Anything that is not explicitly
 * `'beta'` is treated as production: an unrecognised value must not invent a
 * new marker.
 */
export function resolveAppName(env: string): string {
  return env === 'beta' ? `${BETA_TITLE_PREFIX}${BASE_APP_NAME}` : BASE_APP_NAME;
}

export const APP_NAME = resolveAppName(APP_ENV);
```

- [ ] **Step 4: Update `router-service.ts`**

Add to the imports at the top of `apps/web-app/src/services/router-service.ts`, directly below `import { logger } from '@shared/logger';`:

```ts
import { APP_NAME } from '@shared/constants';
```

Then replace all three occurrences of

```ts
document.title = `${route.title} | XIV Dye Tools`;
```

with

```ts
document.title = `${route.title} | ${APP_NAME}`;
```

They are at lines 190, 227 and 347. Verify none remain:

```bash
git grep -n "XIV Dye Tools" -- apps/web-app/src/services/router-service.ts
```
Expected: no output.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter xivdyetools-web-app exec vitest run src/shared/__tests__/constants.test.ts src/services/__tests__/router-service.test.ts
```
Expected: PASS. The pre-existing router title tests use `toContain('Comparison')` etc., so they are unaffected.

- [ ] **Step 6: Full unit suite, lint, type-check**

```bash
pnpm --filter xivdyetools-web-app run test
pnpm --filter xivdyetools-web-app run lint
pnpm --filter xivdyetools-web-app run type-check
```
Expected: all tests pass (2096 + the new ones); lint `0 errors`; type-check silent.

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/src/shared/constants.ts apps/web-app/src/shared/__tests__/constants.test.ts apps/web-app/src/services/router-service.ts apps/web-app/src/services/__tests__/router-service.test.ts
git commit -F- <<'EOF'
feat(web-app): make APP_NAME environment-aware and route titles through it

RouterService assigned `${route.title} | XIV Dye Tools` at three separate sites,
so a title change made only in index.html would be overwritten by the first
navigation. APP_NAME already existed in shared/constants and was simply never
used here; it now carries a `[BETA] ` prefix when __APP_ENV__ is 'beta', and the
three literals become one constant.

An unrecognised APP_ENV resolves to the production name rather than inventing a
marker. Vitest has no `define` block, so the typeof guard keeps tests on the
production branch by default and resolveAppName() is tested directly.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 3: Generate and commit the beta icon set

**Files:**
- Create: `apps/web-app/scripts/assets/bot-avatar-beta-1024.png` (copied from `C:\dev\XIVProjects\bot-avatar-beta-1024.png`)
- Create: `apps/web-app/scripts/generate-beta-icons.mjs`
- Create: `apps/web-app/public/assets/icons/beta/` — 7 files

**Interfaces:**
- Consumes: nothing.
- Produces: `public/assets/icons/beta/{favicon.ico,favicon-16x16.png,favicon-32x32.png,favicon-48x48.png,apple-touch-icon.png,icon-192x192.png,icon-512x512.png}` — the exact filenames Task 1's transform rewrites hrefs to.

**Note:** the source artwork is the blue paint-bucket beta bot avatar. Production's identity is red, so the two are distinguishable at 16 px. The source lives under `scripts/assets/` — beside the script that consumes it and outside `public/`, so it is reproducible without shipping a 266 KB PNG to browsers.

- [ ] **Step 1: Copy the source artwork into the repo**

```bash
mkdir -p apps/web-app/scripts/assets
cp /c/dev/XIVProjects/bot-avatar-beta-1024.png apps/web-app/scripts/assets/bot-avatar-beta-1024.png
```

- [ ] **Step 2: Write the generator**

Create `apps/web-app/scripts/generate-beta-icons.mjs`:

```js
/**
 * Generate the beta favicon set from the beta bot avatar.
 *
 * One-shot: the output is committed to public/assets/icons/beta/ and is NOT
 * regenerated in CI. Re-run only if the source artwork changes.
 *
 * Usage: node scripts/generate-beta-icons.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOURCE = path.join(__dirname, 'assets/bot-avatar-beta-1024.png');
const OUTPUT_DIR = path.join(__dirname, '../public/assets/icons/beta');

// Must match the seven icon links in src/index.html exactly — the beta build
// rewrites those hrefs into this directory, so a missing name is a 404.
const SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Source artwork not found: ${SOURCE}`);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const { name, size } of SIZES) {
    await sharp(SOURCE).resize(size, size, { fit: 'cover' }).png().toFile(path.join(OUTPUT_DIR, name));
    console.log(`+ ${name} (${size}x${size})`);
  }

  // favicon.ico is a copy of the 32px PNG. Every browser this app targets
  // accepts a PNG served as .ico, and scripts/generate-icons.mjs already takes
  // the same approach for the production set.
  fs.copyFileSync(path.join(OUTPUT_DIR, 'favicon-32x32.png'), path.join(OUTPUT_DIR, 'favicon.ico'));
  console.log('+ favicon.ico (copy of 32x32)');

  console.log(`\nDone: ${SIZES.length + 1} files in public/assets/icons/beta/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run it**

```bash
pnpm --filter xivdyetools-web-app exec node scripts/generate-beta-icons.mjs
```
Expected: 7 lines of `+ …`, then `Done: 7 files`.

- [ ] **Step 4: Verify all seven exist and are non-empty**

```bash
ls -l apps/web-app/public/assets/icons/beta/
```
Expected: exactly 7 files — `apple-touch-icon.png`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`, `favicon.ico`, `icon-192x192.png`, `icon-512x512.png` — each > 0 bytes.

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/scripts/assets/bot-avatar-beta-1024.png apps/web-app/scripts/generate-beta-icons.mjs apps/web-app/public/assets/icons/beta/
git commit -F- <<'EOF'
feat(web-app): add the beta favicon set

Seven icons generated from the beta bot avatar (the blue paint bucket) with
sharp, which already drives scripts/generate-icons.mjs. Filenames match the
seven icon links in src/index.html exactly, since the beta build rewrites those
hrefs into this directory and a missing name would be a 404.

Blue against production's red is legible at 16px, which is the whole point: two
tabs open on the same tool must be tellable apart.

Output is committed rather than generated in CI. The source artwork sits in
scripts/assets/ - beside its consumer and outside public/ - so the set is
reproducible without shipping a 266 KB PNG to browsers.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 4: Wire the Vite plugin and add the build assertion

**Files:**
- Create: `apps/web-app/vite-plugin-beta-branding.ts`
- Modify: `apps/web-app/vite.config.ts:8-12` (define) and `:66-69` (plugins)
- Create: `apps/web-app/scripts/check-beta-build.js`

**Interfaces:**
- Consumes: `brandHtmlForBeta`, `BETA_HEADERS_BLOCK` (Task 1); the icon files (Task 3).
- Produces: `betaBranding(enabled: boolean): Plugin`; a `dist/` that satisfies `check-beta-build.js`.

**Why `closeBundle` and not `writeBundle`:** Vite copies `publicDir` into `dist/` as part of the build's write phase, so `dist/_headers` is not reliably present during `writeBundle`. `closeBundle` runs after everything. The existing `asyncCss` plugin uses `writeBundle` because it edits `index.html`, which the bundle itself emits.

- [ ] **Step 1: Write the plugin**

Create `apps/web-app/vite-plugin-beta-branding.ts`:

```ts
/**
 * Applies every beta-specific difference to a build, and nothing else.
 *
 * Inert unless `enabled`, so a production build's output is byte-identical to
 * one produced without this plugin. All logic lives in
 * src/shared/beta-branding.ts, which is type-checked and unit-tested; this file
 * is only the Vite wiring.
 */
import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { brandHtmlForBeta, BETA_HEADERS_BLOCK } from './src/shared/beta-branding';

export function betaBranding(enabled: boolean): Plugin {
  let outDir = 'dist';

  return {
    name: 'beta-branding',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        return enabled ? brandHtmlForBeta(html) : html;
      },
    },

    // closeBundle, not writeBundle: publicDir is copied into dist during the
    // write phase, so _headers is not reliably on disk any earlier.
    closeBundle() {
      if (!enabled) return;

      const headersPath = resolve(outDir, '_headers');
      if (!existsSync(headersPath)) {
        // Hard failure by design. A beta deployment that silently ships
        // without X-Robots-Tag would get indexed and compete with production,
        // and nothing downstream would notice.
        throw new Error(
          `[beta-branding] ${headersPath} not found; refusing to publish a beta build without X-Robots-Tag`
        );
      }

      const current = readFileSync(headersPath, 'utf-8');
      if (current.includes('X-Robots-Tag')) return; // idempotent
      writeFileSync(headersPath, current + BETA_HEADERS_BLOCK, 'utf-8');
    },
  };
}
```

- [ ] **Step 2: Wire it into `vite.config.ts`**

In `apps/web-app/vite.config.ts`, add the import beside the other plugin imports:

```ts
import { betaBranding } from './vite-plugin-beta-branding'
```

Add this line above `export default defineConfig({`:

```ts
// Set by .github/workflows/deploy-web-app-beta.yml. Absent everywhere else.
const isBeta = process.env.VITE_APP_ENV === 'beta';
```

Add one entry to the existing `define` block, after `__BUILD_DATE__`:

```ts
    // Build environment, read by shared/constants.ts to mark beta builds.
    __APP_ENV__: JSON.stringify(isBeta ? 'beta' : 'production'),
```

And extend `plugins`:

```ts
  plugins: [
    asyncCss(),
    changelogParser(),
    betaBranding(isBeta),
  ],
```

- [ ] **Step 3: Write the build assertion script**

Create `apps/web-app/scripts/check-beta-build.js`:

```js
/**
 * Assert that dist/ really is a beta build.
 *
 * Runs in the beta workflow between `build` and `pages deploy`. Every check
 * here corresponds to something that fails silently in production: a missing
 * VITE_APP_ENV produces a build indistinguishable from production on the beta
 * domain, and a missing icon is a 404 nobody sees in CI.
 *
 * Usage: node scripts/check-beta-build.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../dist');

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');
const headers = fs.readFileSync(path.join(DIST, '_headers'), 'utf-8');

// 1. The title marker survived into the emitted HTML.
check(/<title>\[BETA\] /.test(html), 'dist/index.html <title> is missing the [BETA] prefix');

// 2. No icon link still points at the production set.
check(
  !/rel="(?:icon|apple-touch-icon)"[^>]*href="\/assets\/icons\/(?!beta\/)/.test(html) &&
    !/href="\/assets\/icons\/(?!beta\/)[^"]*"[^>]*rel="(?:icon|apple-touch-icon)"/.test(html),
  'dist/index.html still has an icon link pointing outside /assets/icons/beta/'
);

// 3. Every beta icon the HTML references actually exists in dist.
const referenced = [...html.matchAll(/href="(\/assets\/icons\/beta\/[^"]+)"/g)].map((m) => m[1]);
check(referenced.length === 7, `expected 7 beta icon references, found ${referenced.length}`);
for (const href of referenced) {
  check(fs.existsSync(path.join(DIST, href.slice(1))), `referenced icon missing from dist: ${href}`);
}

// 4. Search engines are told to stay away.
check(/X-Robots-Tag:\s*noindex/.test(headers), 'dist/_headers is missing X-Robots-Tag: noindex');

// 5. The production security headers survived the append.
check(/Content-Security-Policy:/.test(headers), 'dist/_headers lost its Content-Security-Policy');

if (failures.length > 0) {
  console.error('Beta build verification FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Beta build verified: [BETA] title, ${referenced.length} beta icons, X-Robots-Tag present.`);
```

- [ ] **Step 4: Verify a beta build passes the assertion**

```bash
cd apps/web-app
VITE_APP_ENV=beta pnpm run build
node scripts/check-beta-build.js
```
Expected: `Beta build verified: [BETA] title, 7 beta icons, X-Robots-Tag present.`

- [ ] **Step 5: Verify a production build is unchanged**

```bash
cd apps/web-app
pnpm run build
grep -c "X-Robots-Tag" dist/_headers || echo "absent (correct)"
grep -o "<title>[^<]*</title>" dist/index.html
grep -c "assets/icons/beta/" dist/index.html || echo "no beta icon refs (correct)"
```
Expected: `absent (correct)`; a title with **no** `[BETA]`; `no beta icon refs (correct)`.

- [ ] **Step 6: Confirm the assertion script fails on a production build**

```bash
cd apps/web-app && node scripts/check-beta-build.js; echo "exit=$?"
```
Expected: `exit=1` and a list of failures. This proves the guard is real rather than vacuous.

- [ ] **Step 7: Lint and type-check**

```bash
pnpm --filter xivdyetools-web-app run lint && pnpm --filter xivdyetools-web-app run type-check
```
Expected: `0 errors`; type-check silent. (`vite-plugin-beta-branding.ts` and `scripts/*.js` are outside `tsconfig`'s `include` and outside `eslint src`, matching the existing plugins.)

- [ ] **Step 8: Commit**

```bash
git add apps/web-app/vite-plugin-beta-branding.ts apps/web-app/vite.config.ts apps/web-app/scripts/check-beta-build.js
git commit -F- <<'EOF'
feat(web-app): apply beta branding at build time behind VITE_APP_ENV

One plugin carries every beta-specific difference - title prefix, beta icon
paths, and an X-Robots-Tag noindex rule appended to dist/_headers - and is inert
without VITE_APP_ENV=beta, so production output is unchanged.

The headers append runs in closeBundle rather than writeBundle because Vite
copies publicDir during the write phase, so dist/_headers is not reliably on
disk earlier. A missing _headers throws: a beta build that silently shipped
without noindex would get indexed and compete with production, and nothing
downstream would catch it.

scripts/check-beta-build.js asserts the result between build and deploy. It
verifies the icons the HTML references actually exist in dist - the check that
would have caught production's missing favicon-48x48.png - and that appending
did not clobber the CSP. Verified to exit 1 against a production build, so the
guard is not vacuous.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 5: Allow the beta origin through OAuth and CORS

**Files:**
- Modify: `apps/oauth/src/constants/oauth.ts:10-17`
- Create: `apps/oauth/src/__tests__/oauth-constants.test.ts`
- Modify: `apps/presets-api/wrangler.toml:42`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: production OAuth accepts `https://beta.xivdyetools.app` as a redirect origin; production presets-api reflects it for CORS.

**Why this must ship before the first beta push:** without it, beta deploys successfully and then fails at login with an opaque redirect-URI error. Both workers deploy from `main` only on push, but both expose `workflow_dispatch`, and `actions/checkout` takes the dispatched ref — so they can be released from this branch without a merge.

- [ ] **Step 1: Write the failing test**

Create `apps/oauth/src/__tests__/oauth-constants.test.ts`:

```ts
/**
 * XIV Dye Tools OAuth - redirect origin allowlist
 *
 * The allowlist is the only thing standing between the OAuth flow and an open
 * redirect, so its contents are asserted rather than assumed.
 */

import { describe, it, expect } from 'vitest';
import { getAllowedRedirectOrigins } from '../constants/oauth';

const PROD = { FRONTEND_URL: 'https://xivdyetools.app', ENVIRONMENT: 'production' };
const DEV = { FRONTEND_URL: 'http://localhost:5173', ENVIRONMENT: 'development' };

describe('getAllowedRedirectOrigins', () => {
  it('allows the beta web app in production', () => {
    expect(getAllowedRedirectOrigins(PROD)).toContain('https://beta.xivdyetools.app');
  });

  it('still allows production itself', () => {
    expect(getAllowedRedirectOrigins(PROD)).toContain('https://xivdyetools.app');
  });

  it('drops loopback origins outside development', () => {
    const origins = getAllowedRedirectOrigins(PROD);
    expect(origins.some((o) => o.includes('localhost'))).toBe(false);
    expect(origins.some((o) => o.includes('127.0.0.1'))).toBe(false);
  });

  it('keeps loopback origins in development', () => {
    expect(getAllowedRedirectOrigins(DEV)).toContain('http://localhost:5173');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm --filter xivdyetools-oauth exec vitest run src/__tests__/oauth-constants.test.ts
```
Expected: FAIL on the first test — beta is not in the allowlist.

- [ ] **Step 3: Add the origin**

In `apps/oauth/src/constants/oauth.ts`, change the array to:

```ts
export const ALLOWED_REDIRECT_ORIGINS = [
  'https://xivdyetools.app',
  // Beta web app — a separate Cloudflare Pages project (xivdyetools-beta)
  // serving non-main branches. It uses this production OAuth worker on
  // purpose, so testers log in with their real accounts.
  // See docs/superpowers/specs/2026-08-09-beta-web-app-deployment-design.md
  'https://beta.xivdyetools.app',
  'https://xivdyetools.projectgalatine.com', // Transition period - remove after migration complete
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];
```

- [ ] **Step 4: Run it to verify it passes**

```bash
pnpm --filter xivdyetools-oauth exec vitest run src/__tests__/oauth-constants.test.ts
```
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the CORS origin**

In `apps/presets-api/wrangler.toml`, on line 42, append `,https://beta.xivdyetools.app` to `ADDITIONAL_CORS_ORIGINS` so the line reads:

```toml
vars ={ ENVIRONMENT = "production", API_VERSION = "v1", CORS_ORIGIN = "https://xivdyetools.app", ADDITIONAL_CORS_ORIGINS = "https://xiv-colorexplorer.pages.dev,https://xivdyetools.projectgalatine.com,https://beta.xivdyetools.app" }
```

Do **not** remove the two existing entries — they are out of scope per the spec.

- [ ] **Step 6: Verify both workers still pass**

```bash
pnpm turbo run type-check test lint --filter=xivdyetools-oauth --filter=xivdyetools-presets-api --force
```
Expected: all tasks successful.

- [ ] **Step 7: Commit**

```bash
git add apps/oauth/src/constants/oauth.ts apps/oauth/src/__tests__/oauth-constants.test.ts apps/presets-api/wrangler.toml
git commit -F- <<'EOF'
feat(oauth,presets-api): allow the beta web app origin

beta.xivdyetools.app is a new origin, and both the OAuth redirect allowlist and
the presets-api CORS allowlist are origin-scoped. Without these, the beta site
deploys fine and then fails at login with an opaque redirect-URI error.

Adds the first test for getAllowedRedirectOrigins while here. The allowlist is
the only thing between this flow and an open redirect, and it had no coverage -
including for the development-only loopback filtering.

The stale xiv-colorexplorer entry in ADDITIONAL_CORS_ORIGINS is left alone; it
predates this work and may still serve something.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Task 6: The beta deploy workflow and documentation

**Files:**
- Create: `.github/workflows/deploy-web-app-beta.yml`
- Modify: `docs/operations/DEPLOY_ENVIRONMENTS.md`
- Modify: `apps/web-app/CLAUDE.md`

**Interfaces:**
- Consumes: `VITE_APP_ENV=beta` (Task 4), `scripts/check-beta-build.js` (Task 4).
- Produces: a deployment at `https://beta.xivdyetools.app` on every non-`main` push.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy-web-app-beta.yml`:

```yaml
# Deploys the BETA web app (Pages project xivdyetools-beta, served at
# beta.xivdyetools.app) on any push to a non-main branch.
#
# Safe by construction: this is a SEPARATE Pages project from production's
# `xivdyetools`. There is no flag on this workflow that could reach production,
# which is the reason a second project was chosen over a preview branch of the
# existing one. See docs/superpowers/specs/2026-08-09-beta-web-app-deployment-design.md
#
# `--branch=beta` matters: the project was created with
# `--production-branch=beta`, so this is a *production* deployment of the beta
# project and is therefore what the custom domain serves. Deploying under any
# other branch name lands as a preview and the custom domain keeps serving the
# previous build - a silent no-op.
#
# There is ONE beta site. Concurrent branches share it, so the most recent push
# wins; cancel-in-progress makes that explicit rather than a race.
name: Deploy Beta Web App

on:
  push:
    branches-ignore:
      - main
      - master
      # Dependency bumps should not seize beta from whoever is testing on it.
      - 'dependabot/**'
    paths:
      - 'apps/web-app/**'
      - 'packages/core/**'
      - 'packages/types/**'
      - 'packages/logger/**'
  workflow_dispatch:

concurrency:
  group: deploy-web-app-beta
  # Unlike production, a superseded beta deploy is worth cancelling: the newer
  # commit is the one being tested.
  cancel-in-progress: true

jobs:
  deploy:
    name: Build & Deploy Beta Web App
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v5

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build dependencies
        run: pnpm turbo run build --filter=xivdyetools-web-app...

      - name: Type-check
        run: pnpm turbo run type-check --filter=xivdyetools-web-app

      - name: Test
        run: pnpm turbo run test --filter=xivdyetools-web-app --continue

      - name: Build beta web app
        run: pnpm --filter xivdyetools-web-app run build
        env:
          VITE_APP_ENV: beta

      - name: Check bundle sizes
        run: pnpm --filter xivdyetools-web-app exec node scripts/check-bundle-size.js

      # Fails the job before deploy if VITE_APP_ENV did not take effect. Without
      # this, a mis-set variable publishes a build indistinguishable from
      # production onto the beta domain, indexable and unmarked.
      - name: Verify this is a beta build
        run: pnpm --filter xivdyetools-web-app exec node scripts/check-beta-build.js

      - name: Deploy to Cloudflare Pages (beta project)
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/web-app
          command: pages deploy dist --project-name=xivdyetools-beta --branch=beta
          packageManager: pnpm

      - name: Smoke test
        run: |
          sleep 5
          curl --fail --retry 3 --retry-delay 5 --retry-all-errors \
            -o /dev/null -w "%{http_code}" \
            -H "User-Agent: xivdyetools-ci" \
            https://beta.xivdyetools.app/
```

- [ ] **Step 2: Validate the YAML parses**

```bash
python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy-web-app-beta.yml')); print('valid')"
```
Expected: `valid`.

- [ ] **Step 3: Document it in `DEPLOY_ENVIRONMENTS.md`**

Append this section to `docs/operations/DEPLOY_ENVIRONMENTS.md`:

```markdown
---

## The Beta Web App (added 2026-08-09)

`web-app` follows the same beta pattern as the Discord bot, using a **second
Cloudflare Pages project** rather than a preview branch of the production one.

| | Production | Beta |
|---|---|---|
| Pages project | `xivdyetools` | `xivdyetools-beta` |
| Domain | `xivdyetools.app` | `beta.xivdyetools.app` |
| Workflow | `deploy-web-app.yml` (push to `main`) | `deploy-web-app-beta.yml` (push to any other branch) |
| Deploy command | `pages deploy dist --project-name=xivdyetools` | `pages deploy dist --project-name=xivdyetools-beta --branch=beta` |
| Backends | production `auth.` / `api.xivdyetools.app` | **the same production backends** |

**Why a second project rather than a preview branch.** A preview-branch setup
separates beta from production by a CLI flag and a hand-edited CNAME target —
the same "one flag away from production" shape that produced this document. Two
projects make the mistake unavailable. It also avoids two caveats of the
branch-alias route: it requires a *proxied* Cloudflare DNS record, and
Cloudflare Access over previews is documented as covering `*.pages.dev` URLs but
**not** custom domains.

**`--branch=beta` is load-bearing.** The project was created with
`wrangler pages project create xivdyetools-beta --production-branch=beta`, so a
deploy on branch `beta` is a *production* deployment of the beta project, which
is what the custom domain serves. Under any other branch name the deploy
succeeds as a **preview** and the custom domain keeps serving the previous
build — a silent no-op. Direct Upload projects cannot change the production
branch from the dashboard; the documented route is a PATCH to the Update Project
API.

**Beta writes to production data.** It uses the production presets API and the
production OAuth worker, exactly as the beta bot shares production D1. Presets
submitted or votes cast on beta are real. This was a deliberate choice: no
isolated preset database exists anywhere today — even
`xivdyetools-presets-api-dev` binds the production D1.

**Telling them apart.** A beta build carries a `[BETA] ` title prefix and the
blue paint-bucket favicon (production is red). Both come from
`VITE_APP_ENV=beta` via `vite-plugin-beta-branding`, and
`scripts/check-beta-build.js` fails the job before deploy if the variable did
not take effect. Beta also serves `X-Robots-Tag: noindex, nofollow`.

**Two origin allowlists must include beta**, or login fails with an opaque
redirect-URI error:

- `apps/oauth/src/constants/oauth.ts` → `ALLOWED_REDIRECT_ORIGINS`
- `apps/presets-api/wrangler.toml` → `env.production.ADDITIONAL_CORS_ORIGINS`

Both workers deploy from `main` on push, but both expose `workflow_dispatch` and
`actions/checkout` takes the dispatched ref — so allowlist changes can be
released from a feature branch without merging.
```

- [ ] **Step 4: Document it in `apps/web-app/CLAUDE.md`**

In `apps/web-app/CLAUDE.md`, under `## Build & Bundle Notes`, add:

```markdown
- **`VITE_APP_ENV=beta` produces a beta build**: `[BETA] ` title prefix, the blue favicon set from `public/assets/icons/beta/`, and `X-Robots-Tag: noindex` appended to `dist/_headers`. All of it lives in `vite-plugin-beta-branding.ts`, which is inert without the flag, so a production build is unaffected. `node scripts/check-beta-build.js` asserts the result and is run by the beta workflow before deploy. See `docs/operations/DEPLOY_ENVIRONMENTS.md`.
```

And add to the `## Commands` block, after `npm run build:check`:

```markdown
VITE_APP_ENV=beta npm run build     # Beta build (beta.xivdyetools.app)
node scripts/check-beta-build.js    # Assert dist/ really is a beta build
node scripts/generate-beta-icons.mjs # Regenerate the beta favicon set (rarely needed)
```

- [ ] **Step 5: Full monorepo gate**

```bash
pnpm turbo run type-check test lint build --force
```
Expected: all tasks successful (60/60 at time of writing).

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy-web-app-beta.yml docs/operations/DEPLOY_ENVIRONMENTS.md apps/web-app/CLAUDE.md
git commit -F- <<'EOF'
ci(web-app): deploy non-main branches to beta.xivdyetools.app

Mirrors deploy-discord-worker-beta.yml: branches-ignore [main, master,
dependabot/**], cancel-in-progress so the newest push wins, and the same
build/type-check/test/bundle-size gate as production.

Two details are load-bearing and documented in the workflow header. The target
is a SEPARATE Pages project, so no flag on this workflow can reach production -
the reason Option B was chosen over a preview branch. And `--branch=beta`
matches the project's production branch, so this is a production deployment of
the beta project; any other branch name lands as a preview and the custom domain
silently keeps serving the previous build.

A `check-beta-build` step runs between build and deploy, so a mis-set
VITE_APP_ENV fails the job rather than publishing an unmarked, indexable copy of
production onto the beta domain.

Also documents the beta web app in DEPLOY_ENVIRONMENTS.md alongside the beta
bot, including that beta writes to production preset data.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Rollout (after all tasks land — maintainer-run)

These are **not** implementation steps. They require repository and Cloudflare permissions.

1. **Actions → Deploy OAuth Worker → Run workflow**, ref `monorepo-2.0-prep`. Ships the redirect allowlist.
2. **Actions → Deploy Presets API → Run workflow**, ref `monorepo-2.0-prep`. Ships the CORS origin.
3. `git push` the branch. `deploy-web-app-beta.yml` fires.
4. Verify on `https://beta.xivdyetools.app`:
   - tab shows `[BETA] …` and the blue icon
   - `curl -sI https://beta.xivdyetools.app/ | grep -i x-robots-tag` returns `noindex, nofollow`
   - Discord login completes
   - the preset browser loads community presets

Steps 1–2 must precede 3. Out of order, beta deploys successfully and then fails at login for a reason nothing on screen explains.

## Self-Review Notes

- **Spec coverage:** plugin §2 → Task 4; title marker §2 → Task 2; icons §3 → Task 3; workflow §4 → Task 6; allowlists §5 → Task 5; docs §6 → Task 6; testing §Testing → Tasks 1, 2, 4, 5; rollout §Rollout order → Rollout section. The spec's "out of scope" items are restated in Global Constraints so no task drifts into them.
- **Type consistency:** `brandHtmlForBeta` / `BETA_HEADERS_BLOCK` / `BASE_APP_NAME` / `BETA_TITLE_PREFIX` are defined in Task 1 and consumed under those exact names in Tasks 2 and 4. `resolveAppName` / `APP_ENV` / `APP_NAME` are defined in Task 2 and consumed in Task 2's own router edit. The seven icon filenames in Task 3 match the seven in Task 1's test and Task 4's assertion.

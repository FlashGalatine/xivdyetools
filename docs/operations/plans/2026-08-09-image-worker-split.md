# Image Worker Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `@cf-wasm/photon` image processing out of `discord-worker` into a new
`image-worker` reached by service binding, bringing `discord-worker` under Cloudflare's 3 MiB
Worker size limit so it can deploy again.

**Architecture:** `discord-worker`'s `src/services/image/` moves wholesale into a new
`apps/image-worker`. The new Worker exposes one internal endpoint, `POST /extract`, which
validates and fetches an image URL, decodes and resizes it with photon, and returns raw RGBA
pixels as a binary body. `discord-worker` gains a thin client module that calls the binding and
rethrows server-side errors with their original message text preserved. Nothing else moves —
palette extraction and dye matching stay in `discord-worker` because they need
`@xivdyetools/core`'s dye database.

**Tech Stack:** Cloudflare Workers, Hono 4, TypeScript 5.9 (`verbatimModuleSyntax`), Vitest 4,
pnpm workspaces, Turborepo, `@cf-wasm/photon`, `@xivdyetools/worker-kit`.

## Global Constraints

- `@cf-wasm/photon` version: `^0.3.7` — same version `discord-worker` uses today.
- `hono`: `^4.12.34` (Sprint 1 security floor — never lower it).
- `@cloudflare/workers-types`: `^5.20260727.1`; `vitest`: `^4.1.10`; `wrangler`: `^4.114.0`.
- `compatibility_date = "2024-12-01"`, and **no `nodejs_compat`** flag (ARCH-001).
- `verbatimModuleSyntax` is on: type-only imports MUST use `import type { … }`.
- All internal imports use explicit `.js` extensions (ESM).
- New Worker adopts the `DEPLOY_ENVIRONMENTS.md` pattern from birth: top-level name is
  `xivdyetools-image-worker-dev` with **no routes**; production lives only under
  `[env.production]`.
- **Error messages crossing the wire must be preserved verbatim.** `extractor.ts` substring-matches
  `error.message` for `'SSRF'`, `'Discord CDN'`, `'too large'`, `'format'`, `'timeout'`.
- Success criterion: `wrangler deploy --dry-run` on `discord-worker` reports gzip **< 3,072 KiB**
  (currently 3,209.3 KiB).

---

### Task 1: Scaffold `apps/image-worker`

**Files:**
- Create: `apps/image-worker/package.json`
- Create: `apps/image-worker/tsconfig.json`
- Create: `apps/image-worker/vitest.config.ts`
- Create: `apps/image-worker/wrangler.toml`
- Create: `apps/image-worker/src/types.ts`
- Create: `apps/image-worker/src/index.ts`
- Test: `apps/image-worker/src/index.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Env` interface (empty bindings for now); a Hono app default-exported from
  `src/index.ts`; `GET /health` returning `{ status: 'ok' }`.

- [ ] **Step 1: Create the package manifest**

`apps/image-worker/package.json`:

```json
{
  "name": "xivdyetools-image-worker",
  "version": "1.0.0",
  "private": true,
  "description": "XIV Dye Tools Image Worker - photon-backed image decode and pixel extraction",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "deploy:production": "wrangler deploy --env production",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "type-check": "tsc --noEmit",
    "lint": "eslint src"
  },
  "license": "MIT",
  "dependencies": {
    "@cloudflare/workers-types": "^5.20260727.1",
    "@xivdyetools/logger": "workspace:*",
    "@xivdyetools/worker-kit": "workspace:*",
    "hono": "^4.12.34"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^4.1.10",
    "@types/node": "^26.1.2",
    "vitest": "^4.1.10",
    "wrangler": "^4.114.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

`@cf-wasm/photon` is deliberately absent — it arrives in Task 3, so this task's bundle stays tiny.

- [ ] **Step 2: Create tsconfig**

`apps/image-worker/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "declaration": false,
    "declarationMap": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": false,
    "types": ["@cloudflare/workers-types", "node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest config**

`apps/image-worker/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types.ts'],
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 85,
        lines: 85,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Create wrangler config**

`apps/image-worker/wrangler.toml`:

```toml
# Adopts the BUG-008 pattern from birth (see docs/operations/DEPLOY_ENVIRONMENTS.md):
# the default (top-level) env is a separate dev worker with its own name and NO
# routes, so a plain `wrangler deploy` can never overwrite production. Production
# config lives exclusively under [env.production].
name = "xivdyetools-image-worker-dev"
main = "src/index.ts"
compatibility_date = "2024-12-01"
# ARCH-001: no nodejs_compat — no Node.js APIs used
workers_dev = true

[env.production]
name = "xivdyetools-image-worker"
# No routes and no workers_dev: reachable ONLY via service binding from
# discord-worker. There is deliberately no public surface.
workers_dev = false
```

- [ ] **Step 5: Create the Env type**

`apps/image-worker/src/types.ts`:

```ts
/**
 * Environment bindings for image-worker.
 *
 * Deliberately empty of storage bindings: this Worker is stateless. It holds no
 * secrets, no KV, no D1 — it decodes images and returns pixels.
 *
 * @module types
 */

export interface Env {
  /** Set to "production" by [env.production]; absent in dev. */
  ENVIRONMENT?: string;
}
```

- [ ] **Step 6: Write the failing health test**

`apps/image-worker/src/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import app from './index.js';
import type { Env } from './types.js';

const env: Env = { ENVIRONMENT: 'test' };

describe('image-worker', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('http://localhost/health', {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns 404 for unknown paths', async () => {
    const res = await app.request('http://localhost/nope', {}, env);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `pnpm --filter xivdyetools-image-worker exec vitest run src/index.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 8: Implement the app**

`apps/image-worker/src/index.ts`:

```ts
/**
 * XIV Dye Tools Image Worker
 *
 * Decodes, resizes and extracts raw RGBA pixels from images using
 * @cf-wasm/photon. Split out of discord-worker so the bot does not carry a
 * 1.5 MiB image library that only /extractor uses — see
 * docs/operations/IMAGE_WORKER_SPLIT.md.
 *
 * Reachable only via service binding; it has no public routes.
 *
 * @module index
 */

import { Hono } from 'hono';
import { requestIdMiddleware, loggerMiddleware } from '@xivdyetools/worker-kit';
import type { Env } from './types.js';

const app = new Hono<{ Bindings: Env }>();

app.use('*', requestIdMiddleware());
app.use(
  '*',
  loggerMiddleware({
    serviceName: 'xivdyetools-image-worker',
    readEnvironmentFromEnv: false,
  })
);

app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
```

- [ ] **Step 9: Install and run the test to verify it passes**

Run: `pnpm install` (from the monorepo root, to link the new workspace), then
`pnpm --filter xivdyetools-image-worker exec vitest run src/index.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 10: Verify type-check and build**

Run: `pnpm turbo run type-check --filter=xivdyetools-image-worker`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/image-worker pnpm-lock.yaml
git commit -m "feat(image-worker): scaffold the worker with a health endpoint"
```

---

### Task 2: Move image validators

**Files:**
- Create: `apps/image-worker/src/validators.ts` (moved from `apps/discord-worker/src/services/image/validators.ts`)
- Create: `apps/image-worker/src/validators.test.ts` (moved from `apps/discord-worker/src/services/image/validators.test.ts`)

**Interfaces:**
- Consumes: nothing from Task 1 beyond the workspace existing.
- Produces:
  - `MAX_FILE_SIZE_BYTES: number`, `MAX_IMAGE_DIMENSION: number`, `MAX_PIXEL_COUNT: number`, `FETCH_TIMEOUT_MS: number`
  - `validateImageUrl(url: string): UrlValidationResult`
  - `validateFileSize(sizeBytes: number): string | null`
  - `validateDimensions(width: number, height: number): string | null`
  - `detectImageFormat(buffer: Uint8Array): string | null`
  - `validateImageFormat(buffer: Uint8Array): { valid: boolean; error?: string }`
  - `fetchImageWithTimeout(url: string): Promise<Response>`
  - `validateAndFetchImage(url: string): Promise<{ buffer: Uint8Array; contentType: string }>`

**Note on error messages:** `validators.ts` throws `Error` with specific message text
(`'Only HTTPS URLs are allowed'`, `'Failed to fetch image: HTTP …'`, `'Image fetch timed out'`,
and size/format messages). **Do not reword any of them.** `discord-worker`'s `extractor.ts`
substring-matches these to choose a localized user-facing message.

- [ ] **Step 1: COPY the files verbatim — do not move them**

```bash
cp apps/discord-worker/src/services/image/validators.ts apps/image-worker/src/validators.ts
cp apps/discord-worker/src/services/image/validators.test.ts apps/image-worker/src/validators.test.ts
```

**Copy, not `git mv`.** `discord-worker`'s `services/image/index.ts` re-exports these files and
`extractor.ts` still imports them. Moving now would break `discord-worker`'s type-check at the
end of this task. The originals are deleted in Task 5, once nothing imports them. The temporary
duplication is deliberate and lasts three tasks.

- [ ] **Step 2: Fix the test's import path**

In `apps/image-worker/src/validators.test.ts`, the import will read
`from './validators.js'` already (it was co-located before and remains co-located). Verify with:

Run: `grep -n "from '" apps/image-worker/src/validators.test.ts | head`
Expected: only `vitest` and `./validators.js`. If any path points at `../` or
`@xivdyetools/*`, adjust it to resolve from the new location.

- [ ] **Step 3: Run the tests to verify they pass in the new home**

Run: `pnpm --filter xivdyetools-image-worker exec vitest run src/validators.test.ts`
Expected: PASS with the same test count as before the move.

- [ ] **Step 4: Verify discord-worker is still green**

Run: `pnpm turbo run type-check test --force --filter=xivdyetools-discord-worker`
Expected: PASS, unchanged. This task must not touch `discord-worker` at all — if anything here
broke it, the copy became a move.

- [ ] **Step 5: Commit**

```bash
git add apps/image-worker
git commit -m "refactor(image-worker): copy image validators in from discord-worker"
```

---

### Task 3: Move photon processing

**Files:**
- Create: `apps/image-worker/src/photon.ts` (moved from `apps/discord-worker/src/services/image/photon.ts`)
- Create: `apps/image-worker/src/photon.test.ts` (moved from `apps/discord-worker/src/services/image/photon.test.ts`)
- Modify: `apps/image-worker/package.json` (add `@cf-wasm/photon`)

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces:
  - `interface ProcessedImage { pixels: Uint8Array; width: number; height: number }`
  - `interface ProcessImageOptions { maxDimension?: number; samplingFilter?: SamplingFilter }`
  - `loadImage(buffer: Uint8Array): PhotonImage`
  - `resizeImage(image: PhotonImage, maxDimension?: number, samplingFilter?: SamplingFilter): PhotonImage`
  - `extractPixels(image: PhotonImage): Uint8Array`
  - `processImageForExtraction(buffer: Uint8Array, options?: ProcessImageOptions): Promise<ProcessedImage>`
  - `getImageDimensions(buffer: Uint8Array): { width: number; height: number }`
  - `DEFAULT_MAX_DIMENSION` is `256` — do not change it; the wire payload bound depends on it.

- [ ] **Step 1: Add the photon dependency**

In `apps/image-worker/package.json`, add to `dependencies` (keep keys alphabetical):

```json
    "@cf-wasm/photon": "^0.3.7",
```

Then run: `pnpm install`

- [ ] **Step 2: COPY the files — do not move them**

```bash
cp apps/discord-worker/src/services/image/photon.ts apps/image-worker/src/photon.ts
cp apps/discord-worker/src/services/image/photon.test.ts apps/image-worker/src/photon.test.ts
```

Same reason as Task 2: `discord-worker` still imports these until Task 5 rewires it. The
originals are deleted there.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pnpm --filter xivdyetools-image-worker exec vitest run src/photon.test.ts`
Expected: PASS with the same test count as before the move. The test mocks `@cf-wasm/photon`, so
no WASM loads during tests.

- [ ] **Step 4: Verify type-check, and that discord-worker is untouched**

Run: `pnpm turbo run type-check --filter=xivdyetools-image-worker`
Expected: PASS.

Run: `pnpm turbo run type-check test --force --filter=xivdyetools-discord-worker`
Expected: PASS, unchanged. `discord-worker` still has its own copy and its own photon dependency
at this point; both are removed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add apps/image-worker pnpm-lock.yaml
git commit -m "refactor(image-worker): copy photon processing in from discord-worker"
```

---

### Task 4: Implement `POST /extract`

**Files:**
- Modify: `apps/image-worker/src/index.ts`
- Modify: `apps/image-worker/src/index.test.ts`

**Interfaces:**
- Consumes: `validateAndFetchImage` (Task 2), `processImageForExtraction` and `ProcessedImage`
  (Task 3).
- Produces the wire contract that Task 5 consumes:
  - Request: `POST /extract`, JSON body `{ url: string; maxDimension?: number }`
  - Success: `200`, body = raw RGBA bytes, headers `X-Image-Width`, `X-Image-Height`,
    `Content-Type: application/octet-stream`
  - Failure: `400`, JSON `{ error: string }` where `error` is the **original thrown message**

- [ ] **Step 1: Write the failing tests**

Append to `apps/image-worker/src/index.test.ts` (and add the `vi` import to the existing
`vitest` import at the top so it reads
`import { describe, it, expect, vi, beforeEach } from 'vitest';`):

```ts
vi.mock('./validators.js', () => ({
  validateAndFetchImage: vi.fn(),
}));
vi.mock('./photon.js', () => ({
  processImageForExtraction: vi.fn(),
}));

import { validateAndFetchImage } from './validators.js';
import { processImageForExtraction } from './photon.js';

describe('POST /extract', () => {
  beforeEach(() => {
    vi.mocked(validateAndFetchImage).mockReset();
    vi.mocked(processImageForExtraction).mockReset();
  });

  it('returns RGBA pixels with dimension headers', async () => {
    vi.mocked(validateAndFetchImage).mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3]),
      contentType: 'image/png',
    });
    vi.mocked(processImageForExtraction).mockResolvedValue({
      pixels: new Uint8Array([10, 20, 30, 255]),
      width: 1,
      height: 1,
    });

    const res = await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png' }),
      },
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Image-Width')).toBe('1');
    expect(res.headers.get('X-Image-Height')).toBe('1');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([10, 20, 30, 255]));
  });

  it('passes maxDimension through to the processor', async () => {
    vi.mocked(validateAndFetchImage).mockResolvedValue({
      buffer: new Uint8Array([1]),
      contentType: 'image/png',
    });
    vi.mocked(processImageForExtraction).mockResolvedValue({
      pixels: new Uint8Array([0, 0, 0, 255]),
      width: 1,
      height: 1,
    });

    await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png', maxDimension: 64 }),
      },
      env
    );

    expect(vi.mocked(processImageForExtraction)).toHaveBeenCalledWith(expect.any(Uint8Array), {
      maxDimension: 64,
    });
  });

  it('preserves the original error message verbatim', async () => {
    // extractor.ts substring-matches this text to pick a localized message.
    vi.mocked(validateAndFetchImage).mockRejectedValue(
      new Error('Image too large: 12MB exceeds 10MB limit')
    );

    const res = await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png' }),
      },
      env
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Image too large: 12MB exceeds 10MB limit' });
  });

  it('rejects a request with no url', async () => {
    const res = await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      env
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No image URL provided' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter xivdyetools-image-worker exec vitest run src/index.test.ts`
Expected: FAIL — `POST /extract` returns 404.

- [ ] **Step 3: Implement the endpoint**

In `apps/image-worker/src/index.ts`, add these imports below the existing ones:

```ts
import { validateAndFetchImage } from './validators.js';
import { processImageForExtraction } from './photon.js';
```

and add this route above `export default app;`:

```ts
/**
 * Decode an image and return its raw RGBA pixels.
 *
 * Internal only — reached via service binding from discord-worker.
 *
 * The error envelope is a hard contract: discord-worker's extractor
 * substring-matches `error` for 'SSRF', 'Discord CDN', 'too large', 'format'
 * and 'timeout' to choose a localized message. Never reword or generalise it.
 */
app.post('/extract', async (c) => {
  let body: { url?: string; maxDimension?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.url) {
    return c.json({ error: 'No image URL provided' }, 400);
  }

  try {
    const { buffer } = await validateAndFetchImage(body.url);
    const processed = await processImageForExtraction(
      buffer,
      body.maxDimension === undefined ? {} : { maxDimension: body.maxDimension }
    );

    return new Response(processed.pixels as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Image-Width': String(processed.width),
        'X-Image-Height': String(processed.height),
      },
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Image processing failed' },
      400
    );
  }
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter xivdyetools-image-worker exec vitest run`
Expected: PASS — all `index`, `validators` and `photon` tests.

- [ ] **Step 5: Verify the bundle is small**

Run: `cd apps/image-worker && npx wrangler deploy --dry-run --outdir=/tmp/iw-dryrun`
Expected: `Total Upload` well under 3 MiB gzipped (~650 KiB expected). Record the figure.

- [ ] **Step 6: Commit**

```bash
git add apps/image-worker
git commit -m "feat(image-worker): add POST /extract returning raw RGBA pixels"
```

---

### Task 5: Rewire `discord-worker` through the service binding

**Files:**
- Create: `apps/discord-worker/src/services/image-client.ts`
- Create: `apps/discord-worker/src/services/image-client.test.ts`
- Delete: `apps/discord-worker/src/services/image/index.ts`, `index.test.ts` (directory becomes empty)
- Modify: `apps/discord-worker/src/handlers/commands/extractor.ts:45,443-446`
- Modify: `apps/discord-worker/src/types/env.ts` (add `IMAGE_WORKER` binding)
- Modify: `apps/discord-worker/package.json` (remove `@cf-wasm/photon`)
- Modify: `apps/discord-worker/wrangler.toml` (add the service binding)
- Modify: `apps/discord-worker/vitest.config.ts` (drop the `src/services/image/**` coverage exclude)

**Interfaces:**
- Consumes: the `POST /extract` contract from Task 4.
- Produces: `extractImagePixels(env: Env, url: string, options?: { maxDimension?: number }):
  Promise<{ pixels: Uint8Array; width: number; height: number }>` — throws `Error` whose
  `message` is the server's `error` string verbatim.

- [ ] **Step 1: Write the failing client test**

`apps/discord-worker/src/services/image-client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { extractImagePixels } from './image-client.js';
import type { Env } from '../types/env.js';

function envWith(fetchImpl: (req: Request) => Promise<Response>): Env {
  return { IMAGE_WORKER: { fetch: vi.fn(fetchImpl) } } as unknown as Env;
}

describe('extractImagePixels', () => {
  it('returns pixels and dimensions from the binding', async () => {
    const env = envWith(async () =>
      new Response(new Uint8Array([1, 2, 3, 255]), {
        status: 200,
        headers: { 'X-Image-Width': '2', 'X-Image-Height': '3' },
      })
    );

    const result = await extractImagePixels(env, 'https://cdn.discordapp.com/x.png');

    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(result.pixels).toEqual(new Uint8Array([1, 2, 3, 255]));
  });

  it('rethrows the server error message verbatim', async () => {
    const env = envWith(async () =>
      new Response(JSON.stringify({ error: 'Image too large: 12MB exceeds 10MB limit' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      extractImagePixels(env, 'https://cdn.discordapp.com/x.png')
    ).rejects.toThrow('Image too large: 12MB exceeds 10MB limit');
  });

  it('throws when the binding is missing', async () => {
    await expect(
      extractImagePixels({} as Env, 'https://cdn.discordapp.com/x.png')
    ).rejects.toThrow('IMAGE_WORKER binding is not configured');
  });

  it('sends the url and maxDimension in the request body', async () => {
    let seen: unknown;
    const env = envWith(async (req) => {
      seen = await req.json();
      return new Response(new Uint8Array([0, 0, 0, 255]), {
        status: 200,
        headers: { 'X-Image-Width': '1', 'X-Image-Height': '1' },
      });
    });

    await extractImagePixels(env, 'https://cdn.discordapp.com/x.png', { maxDimension: 64 });

    expect(seen).toEqual({ url: 'https://cdn.discordapp.com/x.png', maxDimension: 64 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/services/image-client.test.ts`
Expected: FAIL — cannot resolve `./image-client.js`.

- [ ] **Step 3: Add the binding to the Env type**

In `apps/discord-worker/src/types/env.ts`, add to the `Env` interface, next to the other
service bindings (`PRESETS_API`, `UNIVERSALIS_PROXY`):

```ts
  /** Service binding → xivdyetools-image-worker (photon pixel extraction). */
  IMAGE_WORKER?: Fetcher;
```

- [ ] **Step 4: Implement the client**

`apps/discord-worker/src/services/image-client.ts`:

```ts
/**
 * Image Worker client.
 *
 * Calls xivdyetools-image-worker over a service binding to decode an image and
 * return its raw RGBA pixels. photon lives there rather than here so this
 * Worker stays under Cloudflare's size limit — see
 * docs/operations/IMAGE_WORKER_SPLIT.md.
 *
 * @module services/image-client
 */

import type { Env } from '../types/env.js';

/** Pixel data returned by the image worker. */
export interface ExtractedImage {
  pixels: Uint8Array;
  width: number;
  height: number;
}

/**
 * Validate, fetch and decode an image, returning raw RGBA pixels.
 *
 * Server-side failures are rethrown with their message preserved verbatim,
 * because the caller substring-matches it ('SSRF', 'Discord CDN', 'too large',
 * 'format', 'timeout') to choose a localized user-facing message.
 *
 * @throws Error if the binding is absent or the image worker rejects the image
 */
export async function extractImagePixels(
  env: Env,
  url: string,
  options: { maxDimension?: number } = {}
): Promise<ExtractedImage> {
  if (!env.IMAGE_WORKER) {
    throw new Error('IMAGE_WORKER binding is not configured');
  }

  const payload: { url: string; maxDimension?: number } = { url };
  if (options.maxDimension !== undefined) {
    payload.maxDimension = options.maxDimension;
  }

  const response = await env.IMAGE_WORKER.fetch(
    new Request('https://image-worker/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );

  if (!response.ok) {
    let message = `Image processing failed: HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }

  return {
    pixels: new Uint8Array(await response.arrayBuffer()),
    width: Number(response.headers.get('X-Image-Width') ?? 0),
    height: Number(response.headers.get('X-Image-Height') ?? 0),
  };
}
```

- [ ] **Step 5: Run the client tests to verify they pass**

Run: `pnpm --filter xivdyetools-discord-worker exec vitest run src/services/image-client.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Rewire the extractor**

In `apps/discord-worker/src/handlers/commands/extractor.ts`, replace line 45:

```ts
import { validateAndFetchImage, processImageForExtraction } from '../../services/image/index.js';
```

with:

```ts
import { extractImagePixels } from '../../services/image-client.js';
```

Then replace lines 442–446 (the two-step fetch-then-process):

```ts
    // Step 1: Validate and fetch image
    const { buffer } = await validateAndFetchImage(imageUrl);

    // Step 2: Process image to extract pixels
    const processed = await processImageForExtraction(buffer);
```

with:

```ts
    // Steps 1-2: validate, fetch and decode remotely (image-worker owns photon)
    const processed = await extractImagePixels(env, imageUrl);
```

The `catch` block below is unchanged — it still substring-matches `error.message`, and the client
preserves the text.

- [ ] **Step 6b: Remove the now-dead validator types from discord-worker**

Task 2 copied `UrlValidationResult`, `FormatValidationResult` and `ImageFormat` into
`apps/image-worker/src/types.ts`. In `discord-worker` their only consumers are inside
`services/image/`, which Step 7 deletes — so they become dead once it does.

Delete exactly these three declarations from `apps/discord-worker/src/types/image.ts`:
`UrlValidationResult` (interface), `FormatValidationResult` (interface), and `ImageFormat`
(type alias).

**Keep the rest of the file.** `MatchQuality`, `MATCH_QUALITIES` and `getMatchQuality` live there
too, are unrelated to image processing, and stay in `discord-worker`. Do not delete the file.

Run: `grep -rn "UrlValidationResult\|FormatValidationResult\|ImageFormat" apps/discord-worker/src || echo "no references"`
Expected: `no references` (run this after Step 7's deletion).

- [ ] **Step 7: Delete the old image service — the whole directory**

Tasks 2 and 3 *copied* these files; this is where the originals go. Nothing imports them now
that Step 6 rewired `extractor.ts`.

```bash
git rm -r apps/discord-worker/src/services/image
```

Run: `ls apps/discord-worker/src/services/image 2>/dev/null || echo "removed"`
Expected: `removed`.

Run: `grep -rn "services/image/" apps/discord-worker/src || echo "no references"`
Expected: `no references`.

- [ ] **Step 8: Drop the photon dependency and add the binding**

In `apps/discord-worker/package.json`, delete the line:

```json
    "@cf-wasm/photon": "^0.3.7",
```

In `apps/discord-worker/wrangler.toml`, add to the **top-level** bindings (after the
`UNIVERSALIS_PROXY` block):

```toml
[[services]]
binding = "IMAGE_WORKER"
service = "xivdyetools-image-worker"
```

and add the same block under production:

```toml
[[env.production.services]]
binding = "IMAGE_WORKER"
service = "xivdyetools-image-worker"
```

In `apps/discord-worker/vitest.config.ts`, remove `'src/services/image/**',` from the coverage
`exclude` array if present (the path no longer exists).

Then run: `pnpm install`

- [ ] **Step 9: Run the full discord-worker suite**

Run: `pnpm turbo run type-check test --force --filter=xivdyetools-discord-worker`
Expected: PASS. Any test importing `services/image/**` must have been deleted in Step 7; if one
remains, it will fail here — delete it, its coverage moved to `image-worker`.

- [ ] **Step 10: Verify the size gate — this is the point of the whole plan**

Run: `cd apps/discord-worker && npx wrangler deploy --dry-run --outdir=/tmp/dw-dryrun`
Expected: `Total Upload: … / gzip: < 3072 KiB`. Baseline was 3,209.3 KiB; expect ≈ 2,605 KiB.
**If it is still over 3,072 KiB, stop and report — do not proceed.**

- [ ] **Step 11: Commit**

```bash
git add apps/discord-worker pnpm-lock.yaml
git commit -m "refactor(discord-worker): call image-worker for pixel extraction"
```

---

### Task 6: CI workflow and documentation

**Files:**
- Create: `.github/workflows/deploy-image-worker.yml`
- Create: `apps/image-worker/CLAUDE.md`
- Modify: `docs/operations/IMAGE_WORKER_SPLIT.md` (record the measured result)
- Modify: `xivdyetools/CLAUDE.md` and `docs/CLAUDE.md` (add image-worker to the project tables)

**Interfaces:**
- Consumes: the deployable Workers from Tasks 4–5.
- Produces: no code interfaces.

- [ ] **Step 1: Create the deploy workflow**

Copy `.github/workflows/deploy-og-worker.yml` to `.github/workflows/deploy-image-worker.yml`,
then change: the workflow `name` to `Deploy Image Worker`; every `paths:` filter to
`apps/image-worker/**`; the `workingDirectory` to `apps/image-worker`. Keep
`command: deploy --env production` exactly as-is.

Run: `grep -n "og-worker" .github/workflows/deploy-image-worker.yml || echo "clean"`
Expected: `clean` — no stale references survived the copy.

- [ ] **Step 2: Write the app CLAUDE.md**

`apps/image-worker/CLAUDE.md` — cover: purpose (photon pixel extraction split out of
discord-worker for the 3 MiB limit); the `POST /extract` contract from Task 4 including the
**verbatim error message** rule; that it is service-binding-only with no public surface and no
secrets; commands (`dev`, `deploy`, `deploy:production`, `test`, `type-check`); and that
`DEFAULT_MAX_DIMENSION = 256` bounds the response at 256 KiB.

- [ ] **Step 3: Record the measured result in the spec**

In `docs/operations/IMAGE_WORKER_SPLIT.md`, under "Verification", replace the expected figures
with the actual gzip sizes measured in Task 5 Step 10 and Task 4 Step 5.

- [ ] **Step 4: Add image-worker to the monorepo docs**

Add a row for `image-worker` to the application tables in `xivdyetools/CLAUDE.md` and
`docs/CLAUDE.md`, and add it to the service-bindings diagram as
`discord-worker ──► image-worker`.

- [ ] **Step 5: Run the full repo gate**

Run: `pnpm turbo run build type-check test --force` then `pnpm turbo run lint`
Expected: 17/17 type-check and 17/17 test (16 + the new worker), 0 lint errors.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy-image-worker.yml apps/image-worker/CLAUDE.md docs xivdyetools/CLAUDE.md
git commit -m "docs(image-worker): add deploy workflow and document the new worker"
```

---

## Deployment (user-run, after merge)

**Order is load-bearing** — the binding target must exist first:

1. `pnpm --filter xivdyetools-image-worker run deploy:production`
2. `pnpm --filter xivdyetools-discord-worker run deploy:production`
3. Smoke-test `/extractor` with a real image.

Deploying in the reverse order fails: `discord-worker` cannot resolve a binding to a Worker that
does not exist.

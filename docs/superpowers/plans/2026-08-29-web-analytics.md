# Web-app analytics (Enable Analytics made real) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web-app's *Enable Analytics* toggle actually send opt-in, identifier-free usage events (tool views + dwell, explicit dye picks, `.chara` parses, theme switches) to Cloudflare Analytics Engine through a new `POST /v1/telemetry` on api-worker.

**Architecture:** A static `TelemetryService` in the web-app queues events in memory and beacons ≤ 25 of them at a time (as `text/plain` JSON) to api-worker; api-worker validates every event against an allowlist schema and writes one Analytics Engine datapoint per event in a fixed column layout. Nothing is stored in the browser, no id of any kind is sent, and the toggle stays default-off.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`), Vitest 4 (jsdom for web-app, node for api-worker), Hono 4, Cloudflare Analytics Engine (`AnalyticsEngineDataset.writeDataPoint`), Playwright 1.62.

**Spec:** `docs/superpowers/plans/../specs/2026-08-29-web-analytics-design.md` (i.e. `docs/superpowers/specs/2026-08-29-web-analytics-design.md`)

## Global Constraints

- Work happens in the worktree `C:/dev/XIVProjects/.worktrees/xivdyetools-analytics` on branch `web-analytics`. Never touch `C:/dev/XIVProjects/xivdyetools` (another session edits that checkout). Stage only the paths each task names.
- Batch limits (spec §2): **≤ 25 events per batch** (AE allows 25 `writeDataPoint` per invocation), **≤ 16 KB body**; client flushes at **20** queued events / **15 s** / `visibilitychange→hidden` / `pagehide`; dwell capped at **1800 s**.
- Body is sent as **`text/plain`** (string body to `sendBeacon`) so no CORS preflight; the server parses the raw text regardless of declared type.
- Toggle default stays **`analyticsEnabled: false`**; `navigator.globalPrivacyControl === true` disables sending even when the toggle is on.
- Never send or store: IP, UA, Discord ids/JWT presence, image/`.chara` contents, preset text, search text, world/character names, any persistent or per-session id. The worker must never copy `cf-connecting-ip` into a blob.
- Datasets: `xivdyetools_web_analytics` under `[env.production]`, `xivdyetools_web_analytics_dev` in the top-level (routeless dev) block. Beta vs production traffic is separated by the `env` blob (both reach the production worker).
- AE column layout (spec §4) is fixed: `index1=event`, `blob1=event`, `blob2=tool`, `blob3=dimA (entry|via|ok|to)`, `blob4=dimB (stainID|producer|'')`, `blob5=locale`, `blob6=theme`, `blob7=vp`, `blob8=ver`, `blob9=env`, `double1=active_s or 0`.
- Type-only imports must be `import type` (`verbatimModuleSyntax`).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- All commands below run from the worktree root unless a `cd` is shown; `pnpm --filter <pkg> exec vitest run <file>` runs a single file.

---

## File structure

**api-worker (`apps/api-worker/`)**
- `src/telemetry/schema.ts` — pure validation: batch → `TelemetryDataPoint[]` + dropped count. No Hono, no bindings.
- `src/telemetry/schema.test.ts` — unit tests for the schema.
- `src/telemetry/router.ts` — Hono router: bounded body read, JSON parse, schema, `waitUntil` writes, 204.
- `src/telemetry/router.test.ts` — through the real app (`app.request`) with a mock `ANALYTICS`.
- `src/types.ts` — `ANALYTICS?: AnalyticsEngineDataset`.
- `src/index.ts` — mount `/v1/telemetry`.
- `wrangler.toml` — two `analytics_engine_datasets` blocks.
- `tests/wrangler-config.test.ts` — dataset invariant.
- `CLAUDE.md` — one route-table row marked internal.

**web-app (`apps/web-app/`)**
- `src/services/api-worker-origin.ts` — `getApiWorkerBase()` (moved out of chara-resolve-service).
- `src/services/telemetry-service.ts` — `TelemetryService` (gating, queue, transport, dwell, helpers).
- `src/services/__tests__/telemetry-service.test.ts`
- `src/shared/browser-api-types.ts` — `Navigator.globalPrivacyControl`.
- Hooks: `src/components/v4-layout.ts`, `src/components/dye-grid.ts`, `src/components/v4/dye-palette-drawer.ts`, `src/components/chara-import.ts`, `src/components/v4/theme-modal.ts` (+ their tests; a new `src/components/__tests__/v4/theme-modal.test.ts`).
- `src/main.ts` — `TelemetryService.initialize()`; ShareService analytics init removed.
- `src/services/share-service.ts` — dead analytics block deleted.
- `src/locales/{en,ja,de,fr,ko,zh}.json` — `config.analyticsDesc`.
- `src/shared/tool-config-types.ts` — comment.
- `e2e/telemetry.spec.ts`
- `CLAUDE.md`

**docs**
- `docs/operations/ANALYTICS_QUERIES.md`

---

### Task 1: api-worker telemetry schema (pure validation)

**Files:**
- Create: `apps/api-worker/src/telemetry/schema.ts`
- Test: `apps/api-worker/src/telemetry/schema.test.ts`

**Interfaces:**
- Consumes: `dyeService` from `apps/api-worker/src/lib/services.ts` (`dyeService.getByStainId(id: number): Dye | null`), `SUPPORTED_LOCALES` from `@xivdyetools/core` (`readonly LocaleCode[]`).
- Produces (used by Task 2):
  ```ts
  export const MAX_EVENTS = 25;
  export const MAX_BODY_BYTES = 16 * 1024;
  export interface TelemetryDataPoint { indexes: [string]; blobs: string[]; doubles: [number] }
  export interface ParsedBatch { points: TelemetryDataPoint[]; dropped: number }
  /** null when the body is not a v1 batch object (→ 400); otherwise every valid event as a datapoint. */
  export function parseTelemetryBatch(body: unknown): ParsedBatch | null;
  ```

- [ ] **Step 1: Write the failing tests**

`apps/api-worker/src/telemetry/schema.test.ts`:

```ts
/**
 * Telemetry batch validation — the allowlist between the browser and
 * Analytics Engine. Anything not in the schema is dropped, never written.
 */
import { describe, it, expect } from 'vitest';
import { parseTelemetryBatch, MAX_EVENTS } from './schema';

const envelope = {
  v: 1,
  ver: '5.0.3',
  env: 'production',
  locale: 'en',
  theme: 'standard-dark',
  vp: 'd',
};

function batch(events: unknown[], overrides: Record<string, unknown> = {}) {
  return { ...envelope, ...overrides, events };
}

describe('parseTelemetryBatch', () => {
  it('returns null for anything that is not a v1 batch object', () => {
    expect(parseTelemetryBatch(null)).toBeNull();
    expect(parseTelemetryBatch('x')).toBeNull();
    expect(parseTelemetryBatch([])).toBeNull();
    expect(parseTelemetryBatch({ ...envelope, v: 2, events: [] })).toBeNull();
    expect(parseTelemetryBatch({ ...envelope, events: 'nope' })).toBeNull();
  });

  it('maps tool_view onto the fixed column layout', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_view', p: { tool: 'harmony', entry: 'initial' } }]),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.dropped).toBe(0);
    expect(parsed!.points).toEqual([
      {
        indexes: ['tool_view'],
        blobs: ['tool_view', 'harmony', 'initial', '', 'en', 'standard-dark', 'd', '5.0.3', 'production'],
        doubles: [0],
      },
    ]);
  });

  it('carries tool_leave dwell seconds in double1', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: 42 }]),
    );
    expect(parsed!.points[0].doubles).toEqual([42]);
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['tool_leave', 'mixer', 'nav', '']);
  });

  it('drops tool_leave when active_s is missing, negative, fractional or over the cap', () => {
    const bad = [
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' } },
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: -1 },
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: 1.5 },
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: 1801 },
    ];
    const parsed = parseTelemetryBatch(batch(bad));
    expect(parsed!.points).toEqual([]);
    expect(parsed!.dropped).toBe(4);
  });

  it('maps dye_pick with the stainID as blob4 and via as blob3', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'dye_pick', p: { tool: 'comparison', stainID: 102, via: 'grid' } }]),
    );
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['dye_pick', 'comparison', 'grid', '102']);
  });

  it('drops dye_pick for a stainID that is not a dye', () => {
    const parsed = parseTelemetryBatch(
      batch([
        { n: 'dye_pick', p: { tool: 'comparison', stainID: 9999, via: 'grid' } },
        { n: 'dye_pick', p: { tool: 'comparison', stainID: '102', via: 'grid' } },
        { n: 'dye_pick', p: { tool: 'comparison', stainID: 102, via: 'random' } },
      ]),
    );
    expect(parsed!.points).toEqual([]);
    expect(parsed!.dropped).toBe(3);
  });

  it('maps chara_parse with ok as blob3 and producer as blob4, no tool', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'chara_parse', p: { ok: true, producer: 'anamnesis' } }]),
    );
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['chara_parse', '', 'true', 'anamnesis']);
  });

  it('drops chara_parse with an unknown producer or a non-boolean ok', () => {
    const parsed = parseTelemetryBatch(
      batch([
        { n: 'chara_parse', p: { ok: true, producer: 'Anamnesis 2024' } },
        { n: 'chara_parse', p: { ok: 'yes', producer: 'other' } },
      ]),
    );
    expect(parsed!.points).toEqual([]);
    expect(parsed!.dropped).toBe(2);
  });

  it('maps theme_change with the target theme as blob3', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'theme_change', p: { to: 'standard-light' } }]),
    );
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['theme_change', '', 'standard-light', '']);
  });

  it('drops unknown events, unknown tools and malformed entries without failing the batch', () => {
    const parsed = parseTelemetryBatch(
      batch([
        { n: 'page_view', p: {} },
        { n: 'tool_view', p: { tool: 'matcher', entry: 'nav' } },
        { n: 'tool_view', p: { tool: 'harmony', entry: 'bookmark' } },
        { n: 'tool_view' },
        'garbage',
        { n: 'tool_view', p: { tool: 'harmony', entry: 'nav' } },
      ]),
    );
    expect(parsed!.points).toHaveLength(1);
    expect(parsed!.dropped).toBe(5);
  });

  it('keeps only the first MAX_EVENTS events', () => {
    const events = Array.from({ length: MAX_EVENTS + 5 }, () => ({
      n: 'tool_view',
      p: { tool: 'harmony', entry: 'nav' },
    }));
    const parsed = parseTelemetryBatch(batch(events));
    expect(parsed!.points).toHaveLength(MAX_EVENTS);
    expect(parsed!.dropped).toBe(5);
  });

  it("replaces invalid envelope fields with 'invalid' instead of rejecting", () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_view', p: { tool: 'harmony', entry: 'nav' } }], {
        ver: 'abc',
        env: 'staging',
        locale: 'pt',
        theme: 'premium-dark',
        vp: 'xl',
      }),
    );
    expect(parsed!.points[0].blobs.slice(4)).toEqual([
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
    ]);
  });

  it('accepts beta as an env and clamps ver to 16 characters', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_view', p: { tool: 'harmony', entry: 'nav' } }], {
        env: 'beta',
        ver: '5.0.3-beta.20260829.1234',
      }),
    );
    expect(parsed!.points[0].blobs[8]).toBe('beta');
    expect(parsed!.points[0].blobs[7]).toBe('5.0.3-beta.20260');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run src/telemetry/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Implement the schema**

`apps/api-worker/src/telemetry/schema.ts`:

```ts
/**
 * Telemetry batch validation — the allowlist between the browser and
 * Analytics Engine (spec: docs/superpowers/specs/2026-08-29-web-analytics-design.md).
 *
 * Every event is checked against EVENT_SCHEMAS; anything unknown or malformed
 * is dropped, never written. Invalid ENVELOPE fields become 'invalid' rather
 * than rejecting the batch, so a client/server version skew degrades a
 * dimension instead of losing the data. Nothing here touches Hono or a
 * binding — it is a pure function so the router test can stay small.
 *
 * Fixed column layout (queries depend on it — see docs/operations/ANALYTICS_QUERIES.md):
 *   index1 = event
 *   blob1  = event
 *   blob2  = tool ('' when the event has none)
 *   blob3  = dim A: entry | via | ok | to
 *   blob4  = dim B: stainID | producer | ''
 *   blob5  = locale, blob6 = theme, blob7 = vp, blob8 = ver, blob9 = env
 *   double1 = active_s for tool_leave, 0 otherwise
 */

import { SUPPORTED_LOCALES } from '@xivdyetools/core';
import { dyeService } from '../lib/services.js';

/** Analytics Engine allows 25 writeDataPoint calls per invocation. */
export const MAX_EVENTS = 25;
/** 25 small events plus the envelope is ~3 KB; 16 KB is a generous ceiling. */
export const MAX_BODY_BYTES = 16 * 1024;

export interface TelemetryDataPoint {
  indexes: [string];
  blobs: string[];
  doubles: [number];
}

export interface ParsedBatch {
  points: TelemetryDataPoint[];
  dropped: number;
}

const TOOL_IDS = [
  'harmony',
  'extractor',
  'accessibility',
  'comparison',
  'gradient',
  'mixer',
  'presets',
  'budget',
  'swatch',
] as const;
const ENTRIES = ['initial', 'share', 'nav'] as const;
const VIAS = ['drawer', 'grid'] as const;
const PRODUCERS = ['anamnesis', 'ktisis', 'brio', 'other', 'none'] as const;
const THEMES = ['standard-light', 'standard-dark'] as const;
const ENVS = ['production', 'beta'] as const;
const VIEWPORTS = ['m', 't', 'd'] as const;
const DWELL_CAP_S = 1800;
const VER_MAX_LENGTH = 16;
const VER_PATTERN = /^\d+\.\d+\.\d+/;
const INVALID = 'invalid';

type Props = Record<string, unknown>;

/**
 * Each schema maps a validated event onto [tool, dimA, dimB, double1] or
 * returns null to drop it.
 */
type EventMapper = (p: Props, d: unknown) => [string, string, string, number] | null;

function oneOf(value: unknown, allowed: readonly string[]): string | null {
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

function toolOf(p: Props): string | null {
  return oneOf(p['tool'], TOOL_IDS);
}

function dwell(d: unknown): number | null {
  return typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= DWELL_CAP_S ? d : null;
}

function stainId(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return dyeService.getByStainId(value) ? String(value) : null;
}

const EVENT_SCHEMAS: Record<string, EventMapper> = {
  tool_view: (p) => {
    const tool = toolOf(p);
    const entry = oneOf(p['entry'], ENTRIES);
    return tool && entry ? [tool, entry, '', 0] : null;
  },
  tool_leave: (p, d) => {
    const tool = toolOf(p);
    const entry = oneOf(p['entry'], ENTRIES);
    const seconds = dwell(d);
    return tool && entry && seconds !== null ? [tool, entry, '', seconds] : null;
  },
  dye_pick: (p) => {
    const tool = toolOf(p);
    const via = oneOf(p['via'], VIAS);
    const id = stainId(p['stainID']);
    return tool && via && id ? [tool, via, id, 0] : null;
  },
  chara_parse: (p) => {
    const ok = p['ok'];
    const producer = oneOf(p['producer'], PRODUCERS);
    return typeof ok === 'boolean' && producer ? ['', String(ok), producer, 0] : null;
  },
  theme_change: (p) => {
    const to = oneOf(p['to'], THEMES);
    return to ? ['', to, '', 0] : null;
  },
};

function envelopeField(value: unknown, allowed: readonly string[]): string {
  return oneOf(value, allowed) ?? INVALID;
}

function version(value: unknown): string {
  return typeof value === 'string' && VER_PATTERN.test(value)
    ? value.slice(0, VER_MAX_LENGTH)
    : INVALID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a batch. `null` means "not a v1 batch at all" (the router answers
 * 400); otherwise every event that passed its schema, in order, plus how
 * many were dropped.
 */
export function parseTelemetryBatch(body: unknown): ParsedBatch | null {
  if (!isRecord(body) || body['v'] !== 1 || !Array.isArray(body['events'])) return null;

  const envelope = [
    envelopeField(body['locale'], SUPPORTED_LOCALES as readonly string[]),
    envelopeField(body['theme'], THEMES),
    envelopeField(body['vp'], VIEWPORTS),
    version(body['ver']),
    envelopeField(body['env'], ENVS),
  ];

  const events = body['events'] as unknown[];
  const points: TelemetryDataPoint[] = [];
  let dropped = Math.max(0, events.length - MAX_EVENTS);

  for (const raw of events.slice(0, MAX_EVENTS)) {
    const mapped = mapEvent(raw);
    if (!mapped) {
      dropped += 1;
      continue;
    }
    const [name, tool, dimA, dimB, value] = mapped;
    points.push({
      indexes: [name],
      blobs: [name, tool, dimA, dimB, ...envelope],
      doubles: [value],
    });
  }

  return { points, dropped };
}

function mapEvent(raw: unknown): [string, string, string, string, number] | null {
  if (!isRecord(raw) || typeof raw['n'] !== 'string') return null;
  const mapper = EVENT_SCHEMAS[raw['n']];
  if (!mapper) return null;
  const props = isRecord(raw['p']) ? raw['p'] : null;
  if (!props) return null;
  const mapped = mapper(props, raw['d']);
  return mapped ? [raw['n'], ...mapped] : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run src/telemetry/schema.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api-worker/src/telemetry/schema.ts apps/api-worker/src/telemetry/schema.test.ts
git commit -m "feat(api-worker): telemetry batch schema for web-app analytics

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: api-worker `POST /v1/telemetry` route, binding, wrangler config

**Files:**
- Create: `apps/api-worker/src/telemetry/router.ts`
- Test: `apps/api-worker/src/telemetry/router.test.ts`
- Modify: `apps/api-worker/src/types.ts` (Env interface), `apps/api-worker/src/index.ts` (route mount, after `app.route('/v1/chara', charaRouter);`), `apps/api-worker/wrangler.toml`, `apps/api-worker/tests/wrangler-config.test.ts`, `apps/api-worker/CLAUDE.md` (route table, after the `/v1/chara/icon/:iconId` row)

**Interfaces:**
- Consumes: `parseTelemetryBatch`, `MAX_BODY_BYTES` (Task 1); `readBoundedText`, `BodyTooLargeError` from `../lib/bounded-body.js`; `ApiError`, `ErrorCode` from `../lib/api-error.js`; `getLogger` from `@xivdyetools/worker-kit`.
- Produces: `POST /v1/telemetry` → `204` (batch parsed), `400 INVALID_BODY` (not JSON / not a v1 batch), `413 INVALID_BODY` (> 16 KB). Env gains `ANALYTICS?: AnalyticsEngineDataset`.

- [ ] **Step 1: Write the failing router tests**

`apps/api-worker/src/telemetry/router.test.ts`:

```ts
/**
 * `POST /v1/telemetry` through the real app (middleware chain, error
 * handler). Analytics Engine is a mock binding; the schema itself is covered
 * in schema.test.ts — this file checks the HTTP contract and the write path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../index';
import { createMockEnv } from '../../tests/test-utils';
import { createMockExecutionContext } from '../universalis/test-setup';

const writeDataPoint = vi.fn();
const analytics = { writeDataPoint } as unknown as AnalyticsEngineDataset;

const VALID = {
  v: 1,
  ver: '5.0.3',
  env: 'production',
  locale: 'en',
  theme: 'standard-dark',
  vp: 'd',
  events: [
    { n: 'tool_view', p: { tool: 'harmony', entry: 'initial' } },
    { n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 12 },
  ],
};

function post(body: string, env = createMockEnv({ ANALYTICS: analytics }), contentType = 'text/plain') {
  const ctx = createMockExecutionContext();
  const res = app.request(
    '/v1/telemetry',
    { method: 'POST', headers: { 'Content-Type': contentType }, body },
    env,
    ctx,
  );
  return { res, ctx };
}

describe('POST /v1/telemetry', () => {
  beforeEach(() => {
    writeDataPoint.mockReset();
  });

  it('answers 204 with no body and writes one datapoint per valid event', async () => {
    const { res, ctx } = post(JSON.stringify(VALID));
    const response = await res;
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    expect(writeDataPoint).toHaveBeenCalledTimes(2);
    expect(writeDataPoint).toHaveBeenNthCalledWith(1, {
      indexes: ['tool_view'],
      blobs: ['tool_view', 'harmony', 'initial', '', 'en', 'standard-dark', 'd', '5.0.3', 'production'],
      doubles: [0],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ['tool_leave'],
      blobs: ['tool_leave', 'harmony', 'initial', '', 'en', 'standard-dark', 'd', '5.0.3', 'production'],
      doubles: [12],
    });
  });

  it('accepts a text/plain body (what sendBeacon sends) and application/json alike', async () => {
    const plain = await post(JSON.stringify(VALID), undefined, 'text/plain;charset=UTF-8').res;
    const json = await post(JSON.stringify(VALID), undefined, 'application/json').res;
    expect(plain.status).toBe(204);
    expect(json.status).toBe(204);
  });

  it('still answers 204 when every event is dropped', async () => {
    const { res, ctx } = post(JSON.stringify({ ...VALID, events: [{ n: 'nope', p: {} }] }));
    expect((await res).status).toBe(204);
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('answers 400 INVALID_BODY for non-JSON and for JSON that is not a v1 batch', async () => {
    const notJson = await post('{not json').res;
    expect(notJson.status).toBe(400);
    expect((await notJson.json()).error).toBe('INVALID_BODY');

    const notBatch = await post(JSON.stringify({ v: 2, events: [] })).res;
    expect(notBatch.status).toBe(400);
    expect((await notBatch.json()).error).toBe('INVALID_BODY');
  });

  it('answers 413 for a body over 16 KB without reading it all', async () => {
    const huge = JSON.stringify({ ...VALID, pad: 'x'.repeat(17 * 1024) });
    const res = await post(huge).res;
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe('INVALID_BODY');
  });

  it('answers 204 and writes nothing when the ANALYTICS binding is absent', async () => {
    const { res, ctx } = post(JSON.stringify(VALID), createMockEnv());
    expect((await res).status).toBe(204);
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('survives a throwing writeDataPoint (telemetry never fails the request)', async () => {
    writeDataPoint.mockImplementation(() => {
      throw new Error('AE down');
    });
    const { res, ctx } = post(JSON.stringify(VALID));
    expect((await res).status).toBe(204);
    await expect(
      (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll(),
    ).resolves.toBeDefined();
  });

  it('is not reachable with GET', async () => {
    const res = await app.request('/v1/telemetry', { method: 'GET' }, createMockEnv());
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run src/telemetry/router.test.ts`
Expected: FAIL — every request 404s (route not mounted) and `ANALYTICS` is not a known Env key (type error surfaces in type-check, not vitest).

- [ ] **Step 3: Add the binding type**

In `apps/api-worker/src/types.ts`, inside `export interface Env {`, after the `RATE_LIMIT_WINDOW_SECONDS: string;` line, add:

```ts
  /**
   * Analytics Engine dataset for web-app telemetry (`POST /v1/telemetry`).
   * `xivdyetools_web_analytics` in production, `_dev` on the routeless dev
   * worker; absent → the route accepts and discards. Spec:
   * docs/superpowers/specs/2026-08-29-web-analytics-design.md
   */
  ANALYTICS?: AnalyticsEngineDataset;
```

- [ ] **Step 4: Write the router**

`apps/api-worker/src/telemetry/router.ts`:

```ts
/**
 * `POST /v1/telemetry` — opt-in web-app usage telemetry into Analytics Engine.
 *
 * The browser beacons a small JSON batch as `text/plain` (a CORS-safelisted
 * type, so `sendBeacon` needs no preflight); the body is read with the byte
 * budget and parsed regardless of the declared Content-Type. Every event is
 * validated by `schema.ts` — unknown or malformed events are dropped, the
 * batch is never rejected for them — and each survivor becomes one
 * `writeDataPoint` in `waitUntil`, so the response never waits on AE.
 *
 * Deliberately NOT part of the public API: undocumented on
 * developers.xivdyetools.app, no envelope, no body on success. Mounted under
 * `/v1` so the per-IP rate limiter applies (65 / 60 s is far above one
 * beacon every 15 s).
 *
 * Privacy: nothing from the request other than the validated batch reaches a
 * datapoint — no IP, no User-Agent, no request id.
 */

import { Hono } from 'hono';
import { getLogger } from '@xivdyetools/worker-kit';
import type { Env, Variables } from '../types.js';
import { ApiError, ErrorCode } from '../lib/api-error.js';
import { BodyTooLargeError, readBoundedText } from '../lib/bounded-body.js';
import { MAX_BODY_BYTES, parseTelemetryBatch, type TelemetryDataPoint } from './schema.js';

const telemetryRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

async function writePoints(
  analytics: AnalyticsEngineDataset,
  points: TelemetryDataPoint[],
  log: ReturnType<typeof getLogger> | undefined,
): Promise<void> {
  for (const point of points) {
    try {
      analytics.writeDataPoint(point);
    } catch (error) {
      // Telemetry must never surface as an error to the client or the logs' error stream.
      log?.debug('telemetry write failed', { operation: 'telemetry', error: String(error) });
    }
  }
}

telemetryRouter.post('/', async (c) => {
  let text: string;
  try {
    text = await readBoundedText(c.req.raw.body, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw new ApiError(ErrorCode.INVALID_BODY, `Body exceeds ${MAX_BODY_BYTES} bytes`, 413);
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(ErrorCode.INVALID_BODY, 'Body must be JSON', 400);
  }

  const parsed = parseTelemetryBatch(json);
  if (!parsed) {
    throw new ApiError(ErrorCode.INVALID_BODY, 'Body must be a v1 telemetry batch', 400);
  }

  const log = getLogger(c);
  if (parsed.dropped > 0) {
    log?.debug('telemetry events dropped', { operation: 'telemetry', dropped: parsed.dropped });
  }

  const analytics = c.env.ANALYTICS;
  if (analytics && parsed.points.length > 0) {
    c.executionCtx.waitUntil(writePoints(analytics, parsed.points, log));
  }

  return c.body(null, 204);
});

export { telemetryRouter };
```

If `getLogger(c)` is typed as non-optional in worker-kit, drop the `?.` and the `| undefined` — check `apps/api-worker/src/chara/router.ts` for how it calls `getLogger` and mirror it exactly.

- [ ] **Step 5: Mount the route**

In `apps/api-worker/src/index.ts`:

Add to the `// Routes` imports, after `import { charaRouter } from './chara/router.js';`:

```ts
import { telemetryRouter } from './telemetry/router.js';
```

After `app.route('/v1/chara', charaRouter);` add:

```ts
// Opt-in web-app usage telemetry → Analytics Engine. Internal, undocumented,
// 204-only; see telemetry/router.ts and docs/operations/ANALYTICS_QUERIES.md.
app.route('/v1/telemetry', telemetryRouter);
```

- [ ] **Step 6: Run the router tests**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run src/telemetry/router.test.ts`
Expected: PASS (8 tests). If the 413 test fails because the mock `Request` exposes no streaming body, check how `src/chara/router.test.ts` tests its 413 (search for `413`) and mirror that body construction.

- [ ] **Step 7: Write the failing wrangler-config test**

In `apps/api-worker/tests/wrangler-config.test.ts`, inside `describe('wrangler.toml', …)` after the last `it(...)`, add:

```ts
  /**
   * Web-app telemetry (POST /v1/telemetry) writes to Analytics Engine. The
   * dev worker must have its own dataset so ad-hoc `pnpm dev` traffic never
   * pollutes the production series, and production must never point at it.
   */
  it('binds a separate Analytics Engine dataset per environment', () => {
    expect(topLevel).toMatch(
      /^\[\[analytics_engine_datasets\]\]\nbinding = "ANALYTICS"\ndataset = "xivdyetools_web_analytics_dev"$/m,
    );
    expect(production).toMatch(
      /^\[\[env\.production\.analytics_engine_datasets\]\]\nbinding = "ANALYTICS"\ndataset = "xivdyetools_web_analytics"$/m,
    );
    expect(production).not.toContain('xivdyetools_web_analytics_dev');
  });
```

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/wrangler-config.test.ts`
Expected: FAIL on the new case.

- [ ] **Step 8: Add the wrangler blocks**

In `apps/api-worker/wrangler.toml`, after the top-level `[[ratelimits]] … simple = { limit = 65, period = 60 }` block and before `[env.production]`, add:

```toml
# Web-app opt-in telemetry (POST /v1/telemetry → Analytics Engine). Separate
# dev dataset so `pnpm dev` traffic never lands in the production series.
[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_web_analytics_dev"
```

At the end of the file, after the `[[env.production.ratelimits]]` block, add:

```toml
# Web-app telemetry — production dataset. Beta (beta.xivdyetools.app) also
# reaches this worker; beta vs production is the `env` blob, not the dataset.
[[env.production.analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_web_analytics"
```

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/wrangler-config.test.ts`
Expected: PASS.

- [ ] **Step 9: Document the route as internal**

In `apps/api-worker/CLAUDE.md`, after the `| GET | \`/v1/chara/icon/:iconId\` | …` table row, add:

```markdown
| POST | `/v1/telemetry` | **Internal, undocumented, may change** — web-app opt-in usage telemetry → Analytics Engine (`ANALYTICS` binding, `xivdyetools_web_analytics` / `_dev`). `text/plain` JSON batch ≤ 25 events / 16 KB; allowlist schema in `src/telemetry/schema.ts` drops anything unknown; `204` always once parsed, `400`/`413` only for non-JSON / oversized. Fixed blob layout documented in `docs/operations/ANALYTICS_QUERIES.md`. Spec: `docs/superpowers/specs/2026-08-29-web-analytics-design.md` |
```

- [ ] **Step 10: Full api-worker gate**

Run: `pnpm turbo run lint type-check test --filter=xivdyetools-api-worker`
Expected: all green. (If eslint flags the `?.` on a non-nullable logger, fix per Step 4's note.)

- [ ] **Step 11: Commit**

```bash
git add apps/api-worker/src/telemetry/router.ts apps/api-worker/src/telemetry/router.test.ts apps/api-worker/src/types.ts apps/api-worker/src/index.ts apps/api-worker/wrangler.toml apps/api-worker/tests/wrangler-config.test.ts apps/api-worker/CLAUDE.md
git commit -m "feat(api-worker): POST /v1/telemetry → Analytics Engine (web-app opt-in analytics)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: web-app — extract `getApiWorkerBase()` + GPC type

**Files:**
- Create: `apps/web-app/src/services/api-worker-origin.ts`
- Modify: `apps/web-app/src/services/chara-resolve-service.ts` (lines ~68–83: the `PROD_API_BASE` / `DEV_API_BASE` constants and `getApiWorkerBase` function), `apps/web-app/src/shared/browser-api-types.ts`
- Test: `apps/web-app/src/services/__tests__/api-worker-origin.test.ts`

**Interfaces:**
- Produces: `export function getApiWorkerBase(): string` from `@services/api-worker-origin`, re-exported unchanged from `@services/chara-resolve-service`; `navigator.globalPrivacyControl?: boolean` typed globally.

- [ ] **Step 1: Write the failing test**

`apps/web-app/src/services/__tests__/api-worker-origin.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('getApiWorkerBase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('prefers VITE_API_WORKER_URL and strips a trailing slash', async () => {
    vi.stubEnv('VITE_API_WORKER_URL', 'https://tunnel.example/');
    const { getApiWorkerBase } = await import('../api-worker-origin');
    expect(getApiWorkerBase()).toBe('https://tunnel.example');
  });

  it('falls back to the wrangler dev port outside production builds', async () => {
    vi.stubEnv('VITE_API_WORKER_URL', '');
    const { getApiWorkerBase } = await import('../api-worker-origin');
    expect(getApiWorkerBase()).toBe('http://localhost:8790');
  });

  it('is re-exported from chara-resolve-service for existing callers', async () => {
    const origin = await import('../api-worker-origin');
    const chara = await import('../chara-resolve-service');
    expect(chara.getApiWorkerBase).toBe(origin.getApiWorkerBase);
  });
});
```

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/api-worker-origin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Create the module and re-export**

`apps/web-app/src/services/api-worker-origin.ts`:

```ts
/**
 * api-worker origin shared by every browser → data.xivdyetools.app call
 * (.chara resolution, telemetry). `VITE_API_WORKER_URL` wins (local dev
 * against a tunnel or the `-dev` worker); production builds use
 * data.xivdyetools.app, which answers every origin (`cors({ origin: '*' })`)
 * — production, beta and *.pages.dev alike.
 *
 * @module services/api-worker-origin
 */

const PROD_API_BASE = 'https://data.xivdyetools.app';
/** `wrangler dev` port from apps/api-worker/wrangler.toml */
const DEV_API_BASE = 'http://localhost:8790';

export function getApiWorkerBase(): string {
  const env = import.meta.env.VITE_API_WORKER_URL;
  if (env) return env.replace(/\/$/, '');
  return import.meta.env.PROD ? PROD_API_BASE : DEV_API_BASE;
}
```

In `apps/web-app/src/services/chara-resolve-service.ts`: delete the `PROD_API_BASE` and `DEV_API_BASE` constants and the whole `getApiWorkerBase` function (keep `REQUEST_TIMEOUT_MS`), and add near the other imports at the top:

```ts
import { getApiWorkerBase } from './api-worker-origin';

// Re-exported so existing callers/tests keep their import path.
export { getApiWorkerBase };
```

In `apps/web-app/src/shared/browser-api-types.ts`, inside the existing `declare global { … }` block, add alongside `interface Window`:

```ts
  interface Navigator {
    /** Global Privacy Control (https://globalprivacycontrol.org/) — honoured by TelemetryService. */
    globalPrivacyControl?: boolean;
  }
```

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/api-worker-origin.test.ts src/services/__tests__/chara-resolve-service.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web-app/src/services/api-worker-origin.ts apps/web-app/src/services/chara-resolve-service.ts apps/web-app/src/shared/browser-api-types.ts apps/web-app/src/services/__tests__/api-worker-origin.test.ts
git commit -m "refactor(web-app): share the api-worker origin resolver; type navigator.globalPrivacyControl

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: web-app `TelemetryService` — gating, queue, transport

**Files:**
- Create: `apps/web-app/src/services/telemetry-service.ts`
- Test: `apps/web-app/src/services/__tests__/telemetry-service.test.ts`

**Interfaces:**
- Consumes: `ConfigController.getInstance().getConfig('advanced')` / `.subscribe('advanced', listener)`; `LanguageService.getCurrentLocale()`; `ThemeService.getCurrentTheme()`; `APP_VERSION`, `APP_ENV` from `@shared/constants`; `getApiWorkerBase()` (Task 3); `RouterService.getCurrentToolId()`.
- Produces (used by Tasks 5–9):
  ```ts
  export type TelemetryEventName = 'tool_view' | 'tool_leave' | 'dye_pick' | 'chara_parse' | 'theme_change';
  export type ToolEntry = 'initial' | 'share' | 'nav';
  export type DyePickVia = 'drawer' | 'grid';
  export type TelemetryProps = Record<string, string | number | boolean>;
  export interface TelemetryEvent { n: TelemetryEventName; p: TelemetryProps; d?: number }
  export class TelemetryService {
    static initialize(): void;                    // idempotent; reads config, subscribes, attaches listeners
    static isEnabled(): boolean;                  // toggle && !GPC
    static track(name: TelemetryEventName, props: TelemetryProps, value?: number): void;
    static trackDyePick(stainID: number, via: DyePickVia): void; // adds tool from RouterService
    static normalizeProducer(typeName: string | null): 'anamnesis' | 'ktisis' | 'brio' | 'other' | 'none';
    static flush(): void;                         // sends the queue now (no-op when empty)
    static reset(): void;                         // tests only: detach listeners, clear all state
    static readonly MAX_BATCH = 20; static readonly FLUSH_DELAY_MS = 15_000;
  }
  ```
  (Dwell methods `startTool`/`endTool` are added in Task 5.)

- [ ] **Step 1: Write the failing tests**

`apps/web-app/src/services/__tests__/telemetry-service.test.ts`:

```ts
/**
 * TelemetryService — opt-in, identifier-free usage telemetry.
 * Spec: docs/superpowers/specs/2026-08-29-web-analytics-design.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetConfig, mockSubscribe, mockGetCurrentToolId } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockSubscribe: vi.fn(),
  mockGetCurrentToolId: vi.fn().mockReturnValue('harmony'),
}));

vi.mock('@services/config-controller', () => ({
  ConfigController: {
    getInstance: () => ({ getConfig: mockGetConfig, subscribe: mockSubscribe }),
  },
}));
vi.mock('@services/router-service', () => ({
  RouterService: { getCurrentToolId: mockGetCurrentToolId },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: { getCurrentLocale: () => 'de' },
}));
vi.mock('@services/theme-service', () => ({
  ThemeService: { getCurrentTheme: () => 'standard-light' },
}));
vi.mock('@services/api-worker-origin', () => ({
  getApiWorkerBase: () => 'https://data.test',
}));
vi.mock('@shared/constants', () => ({ APP_VERSION: '5.0.3', APP_ENV: 'production' }));
vi.mock('@shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { TelemetryService } from '../telemetry-service';

type ConfigListener = (config: { analyticsEnabled: boolean; performanceMode: boolean }) => void;

let sendBeacon: ReturnType<typeof vi.fn>;
let configListener: ConfigListener | null;

function lastBatch(): { events: Array<{ n: string; p: Record<string, unknown>; d?: number }> } & Record<string, unknown> {
  const call = sendBeacon.mock.calls.at(-1);
  if (!call) throw new Error('sendBeacon not called');
  return JSON.parse(call[1] as string);
}

function enable(enabled = true): void {
  mockGetConfig.mockReturnValue({ analyticsEnabled: enabled, performanceMode: false });
  TelemetryService.initialize();
}

beforeEach(() => {
  vi.useFakeTimers();
  sendBeacon = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true, writable: true });
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: undefined, configurable: true, writable: true });
  configListener = null;
  mockSubscribe.mockImplementation((_key: string, listener: ConfigListener) => {
    configListener = listener;
    return () => {
      configListener = null;
    };
  });
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true });
});

afterEach(() => {
  TelemetryService.reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('gating', () => {
  it('is disabled by default and sends nothing', () => {
    enable(false);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'initial' });
    TelemetryService.flush();
    expect(TelemetryService.isEnabled()).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('sends once the toggle is on', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'initial' });
    TelemetryService.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe('https://data.test/v1/telemetry');
  });

  it('honours Global Privacy Control even when the toggle is on', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    enable(true);
    expect(TelemetryService.isEnabled()).toBe(false);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'initial' });
    TelemetryService.flush();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('starts tracking when the toggle turns on and drops the queue when it turns off', () => {
    enable(false);
    configListener!({ analyticsEnabled: true, performanceMode: false });
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    configListener!({ analyticsEnabled: false, performanceMode: false });
    TelemetryService.flush();
    expect(sendBeacon).not.toHaveBeenCalled();

    configListener!({ analyticsEnabled: true, performanceMode: false });
    TelemetryService.track('tool_view', { tool: 'mixer', entry: 'nav' });
    TelemetryService.flush();
    expect(lastBatch().events).toEqual([{ n: 'tool_view', p: { tool: 'mixer', entry: 'nav' } }]);
  });

  it('initialize is idempotent', () => {
    enable(true);
    TelemetryService.initialize();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('envelope', () => {
  it('carries version, env, locale, theme and a viewport bucket — and nothing else', () => {
    enable(true);
    TelemetryService.track('theme_change', { to: 'standard-light' });
    TelemetryService.flush();
    const batch = lastBatch();
    expect(Object.keys(batch).sort()).toEqual(['env', 'events', 'locale', 'theme', 'v', 'ver', 'vp']);
    expect(batch).toMatchObject({ v: 1, ver: '5.0.3', env: 'production', locale: 'de', theme: 'standard-light', vp: 'd' });
  });

  it.each([
    [500, 'm'],
    [767, 'm'],
    [768, 't'],
    [1023, 't'],
    [1024, 'd'],
  ])('buckets innerWidth %i as %s', (width, bucket) => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
    enable(true);
    TelemetryService.track('theme_change', { to: 'standard-dark' });
    TelemetryService.flush();
    expect(lastBatch().vp).toBe(bucket);
  });
});

describe('batching and transport', () => {
  it('flushes automatically when MAX_BATCH events are queued', () => {
    enable(true);
    for (let i = 0; i < TelemetryService.MAX_BATCH - 1; i++) {
      TelemetryService.track('dye_pick', { tool: 'harmony', stainID: 1 + i, via: 'grid' });
    }
    expect(sendBeacon).not.toHaveBeenCalled();
    TelemetryService.track('dye_pick', { tool: 'harmony', stainID: 99, via: 'grid' });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(lastBatch().events).toHaveLength(TelemetryService.MAX_BATCH);
  });

  it('flushes FLUSH_DELAY_MS after the first queued event', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    vi.advanceTimersByTime(TelemetryService.FLUSH_DELAY_MS - 1);
    expect(sendBeacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('flushes when the tab is hidden and on pagehide', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    TelemetryService.track('tool_view', { tool: 'mixer', entry: 'nav' });
    window.dispatchEvent(new Event('pagehide'));
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });

  it('sends a string body (text/plain — no preflight) and clears the queue', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    TelemetryService.flush();
    expect(typeof sendBeacon.mock.calls[0][1]).toBe('string');
    TelemetryService.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('falls back to fetch keepalive when sendBeacon refuses', () => {
    sendBeacon.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    TelemetryService.flush();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://data.test/v1/telemetry',
      expect.objectContaining({ method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' } }),
    );
  });

  it('never throws out of track/flush when the transport throws', () => {
    sendBeacon.mockImplementation(() => {
      throw new Error('boom');
    });
    enable(true);
    expect(() => {
      TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
      TelemetryService.flush();
    }).not.toThrow();
  });
});

describe('helpers', () => {
  it('trackDyePick adds the current tool', () => {
    mockGetCurrentToolId.mockReturnValue('comparison');
    enable(true);
    TelemetryService.trackDyePick(102, 'drawer');
    TelemetryService.flush();
    expect(lastBatch().events).toEqual([{ n: 'dye_pick', p: { tool: 'comparison', stainID: 102, via: 'drawer' } }]);
  });

  it.each([
    ['Anamnesis', 'anamnesis'],
    ['anamnesis character file', 'anamnesis'],
    ['Ktisis', 'ktisis'],
    ['Brio', 'brio'],
    ['Something Else', 'other'],
    [null, 'none'],
  ])('normalizeProducer(%j) → %s', (input, expected) => {
    expect(TelemetryService.normalizeProducer(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/telemetry-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

`apps/web-app/src/services/telemetry-service.ts`:

```ts
/**
 * TelemetryService — opt-in, identifier-free usage telemetry.
 *
 * Spec: docs/superpowers/specs/2026-08-29-web-analytics-design.md
 *
 * Events queue in memory and are beaconed to api-worker's POST /v1/telemetry
 * as a `text/plain` JSON batch (CORS-safelisted, so no preflight). Nothing is
 * written to storage, no session or client id exists, and the envelope is
 * five coarse dimensions (version, env, locale, theme, viewport bucket).
 *
 * Gating: `advanced.analyticsEnabled` (default OFF) AND not
 * `navigator.globalPrivacyControl`. Turning the toggle off drops the queue.
 *
 * @module services/telemetry-service
 */

import { ConfigController } from './config-controller';
import { LanguageService } from './language-service';
import { ThemeService } from './theme-service';
import { RouterService, type ToolId } from './router-service';
import { getApiWorkerBase } from './api-worker-origin';
import { APP_ENV, APP_VERSION } from '@shared/constants';
import { logger } from '@shared/logger';
import type { AdvancedConfig } from '@shared/tool-config-types';

export type TelemetryEventName =
  | 'tool_view'
  | 'tool_leave'
  | 'dye_pick'
  | 'chara_parse'
  | 'theme_change';
export type ToolEntry = 'initial' | 'share' | 'nav';
export type DyePickVia = 'drawer' | 'grid';
export type TelemetryProps = Record<string, string | number | boolean>;
export interface TelemetryEvent {
  n: TelemetryEventName;
  p: TelemetryProps;
  d?: number;
}

type Producer = 'anamnesis' | 'ktisis' | 'brio' | 'other' | 'none';
type ViewportBucket = 'm' | 't' | 'd';

export class TelemetryService {
  /** Flush threshold — api-worker accepts 25 per batch; leave headroom for a trailing tool_leave. */
  static readonly MAX_BATCH = 20;
  static readonly FLUSH_DELAY_MS = 15_000;

  private static initialized = false;
  private static toggleOn = false;
  private static queue: TelemetryEvent[] = [];
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static unsubscribeConfig: (() => void) | null = null;

  private static readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') TelemetryService.flush();
  };
  private static readonly onPageHide = (): void => {
    TelemetryService.flush();
  };

  static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const controller = ConfigController.getInstance();
    this.toggleOn = controller.getConfig('advanced').analyticsEnabled;
    this.unsubscribeConfig = controller.subscribe('advanced', (config: AdvancedConfig) => {
      const next = config.analyticsEnabled;
      if (next === this.toggleOn) return;
      this.toggleOn = next;
      if (!next) this.dropQueue();
      logger.debug(`[Telemetry] ${next ? 'enabled' : 'disabled'}`);
    });

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
  }

  static isEnabled(): boolean {
    return this.toggleOn && navigator.globalPrivacyControl !== true;
  }

  static track(name: TelemetryEventName, props: TelemetryProps, value?: number): void {
    try {
      if (!this.isEnabled()) return;
      const event: TelemetryEvent = { n: name, p: props };
      if (value !== undefined) event.d = value;
      this.queue.push(event);
      if (this.queue.length >= this.MAX_BATCH) {
        this.flush();
      } else if (this.flushTimer === null) {
        this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_DELAY_MS);
      }
    } catch (error) {
      logger.debug('[Telemetry] track failed', error);
    }
  }

  /** A deliberate dye pick — the tool is the current route. */
  static trackDyePick(stainID: number, via: DyePickVia): void {
    this.track('dye_pick', { tool: RouterService.getCurrentToolId(), stainID, via });
  }

  /** `.chara` `TypeName` → allowlisted producer bucket (never the raw string). */
  static normalizeProducer(typeName: string | null): Producer {
    if (typeName === null) return 'none';
    const lower = typeName.toLowerCase();
    if (lower.includes('anamnesis')) return 'anamnesis';
    if (lower.includes('ktisis')) return 'ktisis';
    if (lower.includes('brio')) return 'brio';
    return 'other';
  }

  static flush(): void {
    try {
      this.clearTimer();
      if (this.queue.length === 0 || !this.isEnabled()) {
        this.queue = [];
        return;
      }
      const body = JSON.stringify({
        v: 1,
        ver: APP_VERSION,
        env: APP_ENV,
        locale: LanguageService.getCurrentLocale(),
        theme: ThemeService.getCurrentTheme(),
        vp: this.viewportBucket(),
        events: this.queue,
      });
      this.queue = [];
      this.send(body);
    } catch (error) {
      this.queue = [];
      logger.debug('[Telemetry] flush failed', error);
    }
  }

  /** Tests only — detach listeners and forget everything. */
  static reset(): void {
    this.clearTimer();
    this.queue = [];
    this.toggleOn = false;
    this.unsubscribeConfig?.();
    this.unsubscribeConfig = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    this.initialized = false;
  }

  // --------------------------------------------------------------------------

  private static send(body: string): void {
    const url = `${getApiWorkerBase()}/v1/telemetry`;
    // A string body goes out as text/plain — CORS-safelisted, no preflight.
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, body)) return;
    void fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
    }).catch((error: unknown) => logger.debug('[Telemetry] fetch fallback failed', error));
  }

  private static viewportBucket(): ViewportBucket {
    const width = window.innerWidth;
    if (width < 768) return 'm';
    if (width < 1024) return 't';
    return 'd';
  }

  private static dropQueue(): void {
    this.clearTimer();
    this.queue = [];
  }

  private static clearTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Keep the ToolId type referenced for the dwell API added alongside (Task 5).
export type { ToolId as TelemetryToolId };
```

(The trailing `export type { ToolId as TelemetryToolId }` exists only so the `ToolId` import is used before Task 5 lands; Task 5 removes it.)

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/telemetry-service.test.ts`
Expected: PASS (≈ 20 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/src/services/telemetry-service.ts apps/web-app/src/services/__tests__/telemetry-service.test.ts
git commit -m "feat(web-app): TelemetryService — opt-in, identifier-free usage telemetry (queue + beacon)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `TelemetryService` dwell tracking (`startTool` / `endTool`)

**Files:**
- Modify: `apps/web-app/src/services/telemetry-service.ts`
- Test: `apps/web-app/src/services/__tests__/telemetry-service.test.ts` (append a `describe`)

**Interfaces:**
- Produces:
  ```ts
  static startTool(tool: ToolId, entry: ToolEntry): void; // begins the visible-time clock
  static endTool(): void;                                  // emits tool_leave with active_s (≤ 1800), clears
  static readonly DWELL_CAP_S = 1800;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `telemetry-service.test.ts`:

```ts
describe('dwell', () => {
  function setVisibility(state: 'visible' | 'hidden'): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('emits tool_leave with whole visible seconds on endTool', () => {
    enable(true);
    TelemetryService.startTool('harmony', 'initial');
    vi.advanceTimersByTime(12_400);
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events).toEqual([{ n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 12 }]);
  });

  it('pauses the clock while the tab is hidden', () => {
    enable(true);
    TelemetryService.startTool('mixer', 'nav');
    vi.advanceTimersByTime(5_000);
    setVisibility('hidden'); // also flushes — nothing queued yet
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    vi.advanceTimersByTime(3_000);
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events.at(-1)).toEqual({ n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: 8 });
  });

  it('caps at DWELL_CAP_S', () => {
    enable(true);
    TelemetryService.startTool('presets', 'nav');
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events[0].d).toBe(TelemetryService.DWELL_CAP_S);
  });

  it('endTool without a started tool is a no-op, and a second endTool does not double-emit', () => {
    enable(true);
    TelemetryService.endTool();
    TelemetryService.startTool('budget', 'nav');
    TelemetryService.endTool();
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events).toHaveLength(1);
  });

  it('pagehide ends the current tool before flushing', () => {
    enable(true);
    TelemetryService.startTool('swatch', 'share');
    vi.advanceTimersByTime(2_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(lastBatch().events).toEqual([{ n: 'tool_leave', p: { tool: 'swatch', entry: 'share' }, d: 2 }]);
  });

  it('keeps timing even while disabled so a late opt-in does not emit a stale tool_leave', () => {
    enable(false);
    TelemetryService.startTool('harmony', 'initial');
    vi.advanceTimersByTime(30_000);
    configListener!({ analyticsEnabled: true, performanceMode: false });
    vi.advanceTimersByTime(1_000);
    TelemetryService.endTool();
    TelemetryService.flush();
    // The clock was reset at opt-in: only the second after enabling counts.
    expect(lastBatch().events).toEqual([{ n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 1 }]);
  });
});
```

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/telemetry-service.test.ts`
Expected: FAIL — `startTool is not a function`.

- [ ] **Step 2: Implement dwell**

In `telemetry-service.ts`:

Remove the trailing `export type { ToolId as TelemetryToolId };` line.

Add after `static readonly FLUSH_DELAY_MS = 15_000;`:

```ts
  static readonly DWELL_CAP_S = 1800;

  private static currentTool: { tool: ToolId; entry: ToolEntry } | null = null;
  /** `Date.now()` when the current visible stretch began; null while hidden or idle. */
  private static visibleSince: number | null = null;
  private static accumulatedMs = 0;
```

Replace the two listener fields with:

```ts
  private static readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      TelemetryService.pauseClock();
      TelemetryService.flush();
    } else {
      TelemetryService.resumeClock();
    }
  };
  private static readonly onPageHide = (): void => {
    TelemetryService.endTool();
    TelemetryService.flush();
  };
```

In the config listener inside `initialize()`, replace `if (!next) this.dropQueue();` with:

```ts
      if (next) {
        // Opt-in mid-visit: dwell starts now, not at page load.
        this.accumulatedMs = 0;
        this.visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
      } else {
        this.dropQueue();
      }
```

Add the public dwell API after `trackDyePick`:

```ts
  /** Begin timing a tool view. Any tool already being timed is ended first. */
  static startTool(tool: ToolId, entry: ToolEntry): void {
    this.endTool();
    this.currentTool = { tool, entry };
    this.accumulatedMs = 0;
    this.visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  }

  /** Emit tool_leave for the tool being timed (no-op when none). */
  static endTool(): void {
    const current = this.currentTool;
    if (!current) return;
    this.pauseClock();
    const seconds = Math.min(Math.round(this.accumulatedMs / 1000), this.DWELL_CAP_S);
    this.currentTool = null;
    this.accumulatedMs = 0;
    this.track('tool_leave', { tool: current.tool, entry: current.entry }, seconds);
  }
```

Add private helpers next to `dropQueue`:

```ts
  private static pauseClock(): void {
    if (this.visibleSince !== null) {
      this.accumulatedMs += Date.now() - this.visibleSince;
      this.visibleSince = null;
    }
  }

  private static resumeClock(): void {
    if (this.currentTool && this.visibleSince === null) {
      this.visibleSince = Date.now();
    }
  }
```

In `reset()`, also add `this.currentTool = null; this.accumulatedMs = 0; this.visibleSince = null;`.

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/services/__tests__/telemetry-service.test.ts`
Expected: PASS. (Fake timers advance `Date.now()` under `vi.useFakeTimers()` — that is what the dwell math relies on.)

- [ ] **Step 4: Commit**

```bash
git add apps/web-app/src/services/telemetry-service.ts apps/web-app/src/services/__tests__/telemetry-service.test.ts
git commit -m "feat(web-app): TelemetryService dwell tracking (visible seconds per tool, capped)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Hooks — tool views/dwell in `v4-layout`, dye picks (drawer + grid)

**Files:**
- Modify: `apps/web-app/src/components/v4-layout.ts` (imports; `dye-selected` listener ~L185; top of `loadToolContent` ~L463; presets case + post-switch block ~L595–640), `apps/web-app/src/components/v4/dye-palette-drawer.ts` (`handleRandomDye` ~L869), `apps/web-app/src/components/dye-grid.ts` (three `emit('dye-selected', …)` sites ~L129, L249, L424)
- Test: `apps/web-app/src/components/__tests__/v4-layout.test.ts`, `apps/web-app/src/components/__tests__/dye-grid.test.ts`, `apps/web-app/src/components/__tests__/v4/dye-palette-drawer.test.ts`

**Interfaces:**
- Consumes: `TelemetryService.startTool/endTool/track/trackDyePick`, `ToolEntry` (Tasks 4–5); `RouterService.getCurrentRoute().params` (exists).
- Produces: drawer `dye-selected` detail becomes `{ dye: Dye; random?: true }`.

- [ ] **Step 1: Write the failing v4-layout tests**

In `v4-layout.test.ts`, add next to the other hoisted mocks:

```ts
const { mockTelemetry, mockGetCurrentRoute } = vi.hoisted(() => ({
  mockTelemetry: {
    startTool: vi.fn(),
    endTool: vi.fn(),
    track: vi.fn(),
    trackDyePick: vi.fn(),
  },
  mockGetCurrentRoute: vi.fn().mockReturnValue({ toolId: 'harmony', params: new URLSearchParams() }),
}));

vi.mock('@services/telemetry-service', () => ({ TelemetryService: mockTelemetry }));
```

Add `getCurrentRoute: mockGetCurrentRoute,` to the existing `vi.mock('@services/router-service', …)` object.

Add a new `describe` (use the same container/init pattern the file's existing "tool loading" tests use — copy their `beforeEach` that calls `initializeV4Layout` and waits for the tool to load):

```ts
describe('telemetry hooks', () => {
  beforeEach(() => {
    Object.values(mockTelemetry).forEach((fn) => fn.mockClear());
    mockGetCurrentRoute.mockReturnValue({ toolId: 'harmony', params: new URLSearchParams() });
  });

  it('records the boot tool as an initial view and starts its dwell clock', async () => {
    await initializeV4Layout(container); // same helper/args the existing tests use
    await vi.waitFor(() => expect(mockTelemetry.track).toHaveBeenCalled());
    expect(mockTelemetry.endTool).toHaveBeenCalled();
    expect(mockTelemetry.startTool).toHaveBeenCalledWith('harmony', 'initial');
    expect(mockTelemetry.track).toHaveBeenCalledWith('tool_view', { tool: 'harmony', entry: 'initial' });
  });

  it('records a boot URL with params as a share entry', async () => {
    mockGetCurrentRoute.mockReturnValue({ toolId: 'harmony', params: new URLSearchParams('dye=102') });
    await initializeV4Layout(container);
    await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledWith('harmony', 'share'));
  });

  it('records later navigations as nav', async () => {
    await initializeV4Layout(container);
    await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledTimes(1));
    // The route subscription callback captured by mockSubscribe
    const routeListener = mockSubscribe.mock.calls[0][0] as (s: { toolId: string }) => void;
    routeListener({ toolId: 'mixer' });
    await vi.waitFor(() => expect(mockTelemetry.startTool).toHaveBeenCalledWith('mixer', 'nav'));
    expect(mockTelemetry.track).toHaveBeenLastCalledWith('tool_view', { tool: 'mixer', entry: 'nav' });
  });

  it('tracks a palette-drawer pick but not a random pick', async () => {
    await initializeV4Layout(container);
    const layout = container.querySelector('v4-layout-shell')!;
    layout.dispatchEvent(
      new CustomEvent('dye-selected', { detail: { dye: { id: 1, stainID: 102, name: 'Jet Black', hex: '#000' } } }),
    );
    expect(mockTelemetry.trackDyePick).toHaveBeenCalledWith(102, 'drawer');
    mockTelemetry.trackDyePick.mockClear();
    layout.dispatchEvent(
      new CustomEvent('dye-selected', {
        detail: { dye: { id: 1, stainID: 102, name: 'Jet Black', hex: '#000' }, random: true },
      }),
    );
    expect(mockTelemetry.trackDyePick).not.toHaveBeenCalled();
  });
});
```

Adapt `container` / `initializeV4Layout(...)` to exactly what the file's existing tests do (read the file's first `describe` before writing) — the assertions above are the contract.

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4-layout.test.ts`
Expected: the new `describe` FAILS (no telemetry calls).

- [ ] **Step 2: Implement the v4-layout hooks**

In `v4-layout.ts`:

Add imports after `import { TutorialService, type TutorialTool } from '@services/tutorial-service';`:

```ts
import { TelemetryService, type ToolEntry } from '@services/telemetry-service';
```

Add module state after `let toastContainer: ToastContainer | null = null;`:

```ts
// Telemetry: only the tool the app booted into can be an 'initial' or 'share'
// entry; every later navigation is 'nav' (spec §1).
let firstToolView = true;
```

Add a helper before `loadToolContent`:

```ts
/** Record a completed tool load for telemetry (tool_view + dwell clock). */
function recordToolView(toolId: ToolId): void {
  let entry: ToolEntry = 'nav';
  if (firstToolView) {
    firstToolView = false;
    entry = RouterService.getCurrentRoute().params.toString() !== '' ? 'share' : 'initial';
  }
  TelemetryService.startTool(toolId, entry);
  TelemetryService.track('tool_view', { tool: toolId, entry });
}
```

In `loadToolContent`, immediately before `// Cleanup previous tool`:

```ts
  // Telemetry: close the dwell window of whatever was showing (no-op if nothing was)
  TelemetryService.endTool();
```

In the `case 'presets':` block, before `return; // Early return since we handled the container directly`:

```ts
        recordToolView(toolId);
```

After `contentContainer.appendChild(toolContainer);` (the post-switch block), add:

```ts
    recordToolView(toolId);
```

In the `dye-selected` listener, change the event type and add the tracking call:

```ts
  layoutElement.addEventListener('dye-selected', ((
    e: CustomEvent<{
      dye: { id: number; name: string; hex: string; stainID?: number };
      random?: boolean;
    }>
  ) => {
    const { dye, random } = e.detail;
    logger.debug(`[V4 Layout] Dye selected from palette: ${dye.name}`);

    // Telemetry: a swatch click is a deliberate pick; the random button is not
    if (!random && typeof dye.stainID === 'number') {
      TelemetryService.trackDyePick(dye.stainID, 'drawer');
    }
    // … existing selectDye / addDye routing unchanged …
```

- [ ] **Step 3: Run v4-layout tests**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4-layout.test.ts`
Expected: PASS.

- [ ] **Step 4: Drawer random flag — failing test, then change**

In `dye-palette-drawer.test.ts`, add a test in the file's main `describe` (follow its existing element-creation pattern — the file mounts `<dye-palette-drawer>` and sets `allDyes`; copy that setup):

```ts
  it('marks the random-dye emit so the layout can skip telemetry for it', async () => {
    const detail: Array<{ dye: Dye; random?: boolean }> = [];
    drawer.addEventListener('dye-selected', ((e: CustomEvent) => detail.push(e.detail)) as EventListener);
    (drawer as unknown as { handleDyeClick(d: Dye): void }).handleDyeClick(drawer.allDyes[0]);
    (drawer as unknown as { handleRandomDye(): void }).handleRandomDye();
    expect(detail[0].random).toBeUndefined();
    expect(detail[1].random).toBe(true);
  });
```

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4/dye-palette-drawer.test.ts`
Expected: FAIL on `detail[1].random`.

In `dye-palette-drawer.ts` `handleRandomDye`, change `this.emit('dye-selected', { dye: randomDye });` to:

```ts
    // `random: true` lets the layout exclude this from dye-popularity telemetry
    this.emit('dye-selected', { dye: randomDye, random: true });
```

Update the `@fires dye-selected` JSDoc line near the top to mention `detail: { dye: Dye, random?: true }`.

Re-run: PASS.

- [ ] **Step 5: DyeGrid — failing test, then change**

In `dye-grid.test.ts`, add next to the other hoisted mocks:

```ts
const { mockTrackDyePick } = vi.hoisted(() => ({ mockTrackDyePick: vi.fn() }));
vi.mock('@services/telemetry-service', () => ({
  TelemetryService: { trackDyePick: mockTrackDyePick },
}));
```

Add a test (reuse the file's grid setup — it renders `mockDyes` into a `DyeGrid`):

```ts
  describe('telemetry', () => {
    beforeEach(() => mockTrackDyePick.mockClear());

    it('reports a click on a dye as a grid pick', () => {
      const btn = query(container, '.dye-select-btn') as HTMLButtonElement;
      click(btn);
      expect(mockTrackDyePick).toHaveBeenCalledWith(mockDyes[0].stainID, 'grid');
    });

    it('reports an Enter-key selection as a grid pick', () => {
      grid.setFocusedIndex?.(0); // if the file exposes it; otherwise dispatch ArrowRight first
      const el = query(container, '[role="grid"], .dye-grid') ?? container;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(mockTrackDyePick).toHaveBeenCalledWith(expect.any(Number), 'grid');
    });

    it('does not report a favorite toggle', () => {
      const fav = query(container, '.favorite-btn') as HTMLButtonElement;
      click(fav);
      expect(mockTrackDyePick).not.toHaveBeenCalled();
    });
  });
```

Adapt selectors/`grid` to the file's existing helpers (read its keyboard tests first). Run — expect the new tests to FAIL.

In `dye-grid.ts`: add `import { TelemetryService } from '@services/telemetry-service';` and add a private method on the class:

```ts
  /** Emit the selection and record it as a deliberate pick (telemetry). */
  private selectDye(dye: Dye): void {
    TelemetryService.trackDyePick(dye.stainID, 'grid');
    this.emit('dye-selected', dye);
  }
```

Replace all three `this.emit('dye-selected', dye)` / `this.emit('dye-selected', this.dyes[this.focusedIndex])` call sites with `this.selectDye(dye)` / `this.selectDye(this.dyes[this.focusedIndex])`. (If `Dye.stainID` is typed optional in `@xivdyetools/types`, use `dye.stainID ?? 0` and let the server drop 0.)

Re-run `dye-grid.test.ts`: PASS.

- [ ] **Step 6: Run the three suites + type-check**

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4-layout.test.ts src/components/__tests__/dye-grid.test.ts src/components/__tests__/v4/dye-palette-drawer.test.ts && pnpm --filter xivdyetools-web-app run type-check`
Expected: PASS / no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/src/components/v4-layout.ts apps/web-app/src/components/dye-grid.ts apps/web-app/src/components/v4/dye-palette-drawer.ts apps/web-app/src/components/__tests__/v4-layout.test.ts apps/web-app/src/components/__tests__/dye-grid.test.ts apps/web-app/src/components/__tests__/v4/dye-palette-drawer.test.ts
git commit -m "feat(web-app): telemetry hooks — tool views + dwell, explicit dye picks (drawer/grid, random excluded)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Hooks — `.chara` parses and theme switches

**Files:**
- Modify: `apps/web-app/src/components/chara-import.ts` (`loadFile`, ~L209–245), `apps/web-app/src/components/v4/theme-modal.ts` (click handler ~L180)
- Test: `apps/web-app/src/components/__tests__/chara-import-file-guard.test.ts` (append), Create: `apps/web-app/src/components/__tests__/v4/theme-modal.test.ts`

**Interfaces:**
- Consumes: `TelemetryService.track`, `TelemetryService.normalizeProducer` (Task 4); `ResolvedCharaCharacter.producer: string | null` (core).

- [ ] **Step 1: Failing chara tests**

Append to `chara-import-file-guard.test.ts` (it already mounts a real `CharaImport` with the resolve round-trip mocked):

```ts
import { TelemetryService } from '@services/telemetry-service';

describe('CharaImport — telemetry', () => {
  let container: HTMLElement;
  let importer: CharaImport;

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockReturnValue(new Promise(() => {}));
    container = createTestContainer('chara-host-telemetry');
    importer = new CharaImport(container, { onSlotPick: vi.fn() }, {});
    importer.init();
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  it('records a failed parse with producer none', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
    await (importer as unknown as LoadFile).loadFile(fileOfSize(10, '{"not":"a chara"}'));
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: false, producer: 'none' });
  });

  it('records a successful parse with the normalised producer', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    // Minimal Anamnesis-shaped file: whatever parseCharaFile needs to succeed —
    // reuse the fixture the glamour test uses (see chara-import-glamour.test.ts).
    const { ANAMNESIS_FIXTURE } = await import('./chara-fixtures');
    await (importer as unknown as LoadFile).loadFile(fileOfSize(10, ANAMNESIS_FIXTURE));
    expect(track).toHaveBeenCalledWith('chara_parse', { ok: true, producer: 'anamnesis' });
  });

  it('does not count a size-refused file as a parse', async () => {
    const track = vi.spyOn(TelemetryService, 'track').mockImplementation(() => {});
    vi.spyOn(ToastService, 'error').mockImplementation(() => 'toast');
    await (importer as unknown as LoadFile).loadFile(fileOfSize(MAX_USER_FILE_BYTES + 1));
    expect(track).not.toHaveBeenCalled();
  });
});
```

Locate the `.chara` JSON fixture that `chara-import-glamour.test.ts` feeds `loadFile` (search that file for `TypeName` or `loadFile`) and either import it from where it lives or inline the same string; replace the `./chara-fixtures` import accordingly.

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/chara-import-file-guard.test.ts`
Expected: the three new tests FAIL.

- [ ] **Step 2: Implement the chara hook**

In `chara-import.ts`, add the import after `import { ThemeService } from '@services/theme-service';`:

```ts
import { TelemetryService } from '@services/telemetry-service';
```

In `loadFile`, after `this.callbacks.onResolved?.(this.resolved);` add:

```ts
      TelemetryService.track('chara_parse', {
        ok: true,
        producer: TelemetryService.normalizeProducer(this.resolved.producer),
      });
```

In the `catch (error)` block, before `logger.error('[CharaImport] Parse failed:', error);` add:

```ts
      TelemetryService.track('chara_parse', { ok: false, producer: 'none' });
```

Re-run: PASS.

- [ ] **Step 3: Failing theme-modal test**

Create `apps/web-app/src/components/__tests__/v4/theme-modal.test.ts`:

```ts
/**
 * Theme modal — the theme_change telemetry hook. Only a deliberate pick of a
 * DIFFERENT theme counts; re-tapping the current one, and ThemeService's own
 * boot/migration, never do.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockShow, mockSetTheme, mockTrack } = vi.hoisted(() => ({
  mockShow: vi.fn().mockReturnValue('modal-1'),
  mockSetTheme: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock('@services/modal-service', () => ({
  ModalService: { show: mockShow, dismiss: vi.fn() },
}));
vi.mock('@services/theme-service', () => ({
  ThemeService: {
    getCurrentTheme: () => 'standard-dark',
    getAllThemes: () => [
      { name: 'standard-light', colors: { background: '#fff', cardBackground: '#eee', primary: '#00f' } },
      { name: 'standard-dark', colors: { background: '#000', cardBackground: '#111', primary: '#0ff' } },
    ],
    subscribe: vi.fn().mockReturnValue(() => {}),
    setTheme: mockSetTheme,
  },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: { t: (k: string) => k },
}));
vi.mock('@services/telemetry-service', () => ({
  TelemetryService: { track: mockTrack },
}));

import { showThemeModal } from '../../v4/theme-modal';

function contentOf(): HTMLElement {
  return mockShow.mock.calls[0][0].content as HTMLElement;
}

describe('theme modal telemetry', () => {
  beforeEach(() => {
    mockShow.mockClear();
    mockSetTheme.mockClear();
    mockTrack.mockClear();
  });

  afterEach(() => {
    // The module keeps a singleton; close it so the next test gets a fresh show()
    const onClose = mockShow.mock.calls[0]?.[0]?.onClose as (() => void) | undefined;
    onClose?.();
  });

  it('tracks a switch to the other theme', () => {
    showThemeModal();
    const light = contentOf().querySelector<HTMLButtonElement>('[data-theme="standard-light"]')!;
    light.click();
    expect(mockSetTheme).toHaveBeenCalledWith('standard-light');
    expect(mockTrack).toHaveBeenCalledWith('theme_change', { to: 'standard-light' });
  });

  it('does not track re-picking the current theme', () => {
    showThemeModal();
    const dark = contentOf().querySelector<HTMLButtonElement>('[data-theme="standard-dark"]')!;
    dark.click();
    expect(mockSetTheme).toHaveBeenCalledWith('standard-dark');
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
```

If `getAllThemes()` entries need more fields for `createContent` (check the loop in `theme-modal.ts` ~L130–160 for which `theme.colors.*` keys it reads), extend the mock objects with those keys.

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/components/__tests__/v4/theme-modal.test.ts`
Expected: first test FAILS on `mockTrack`.

- [ ] **Step 4: Implement the theme hook**

In `theme-modal.ts`, add after `import { LanguageService } from '@services/language-service';`:

```ts
import { TelemetryService } from '@services/telemetry-service';
```

Change the click handler to:

```ts
      // Apply on tap — live preview, no revert, footer says Done
      themeBtn.addEventListener('click', () => {
        // Telemetry: only a deliberate switch counts (spec: theme_change)
        if (theme.name !== this.currentTheme) {
          TelemetryService.track('theme_change', { to: theme.name });
        }
        ThemeService.setTheme(theme.name);
      });
```

Re-run: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/src/components/chara-import.ts apps/web-app/src/components/v4/theme-modal.ts apps/web-app/src/components/__tests__/chara-import-file-guard.test.ts apps/web-app/src/components/__tests__/v4/theme-modal.test.ts
git commit -m "feat(web-app): telemetry hooks — .chara parse outcome and deliberate theme switches

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Wire-up, ShareService cleanup, copy, docs

**Files:**
- Modify: `apps/web-app/src/main.ts` (imports ~L26–28, init ~L99–101, dev block ~L139–145), `apps/web-app/src/services/share-service.ts` (analytics block L160–168, L194, L480–484, L540–545, L551–556, L565–590, L695–797), `apps/web-app/src/locales/{en,ja,de,fr,ko,zh}.json` (`config.analyticsDesc`, line 223 in each), `apps/web-app/src/shared/tool-config-types.ts` (~L268), `apps/web-app/CLAUDE.md` (services table L127 area; Security Patterns L259)
- Test: `apps/web-app/src/services/__tests__/share-service.test.ts` (only if it references removed symbols — it does not as of this plan; verify with grep)

- [ ] **Step 1: main.ts**

Replace:

```ts
// Import ShareService for analytics initialization
import { ShareService } from '@services/share-service';
```

with:

```ts
import { ShareService } from '@services/share-service';
import { TelemetryService } from '@services/telemetry-service';
```

Replace:

```ts
    // Initialize share analytics (client-side tracking)
    logger.info('📊 Initializing share analytics...');
    ShareService.initializeAnalytics();
```

with:

```ts
    // Opt-in usage telemetry (default off; honours Global Privacy Control)
    TelemetryService.initialize();
```

In the dev block, replace the `ShareService.getAnalyticsStats()` hint:

```ts
      logger.info('[DEV] ShareService exposed on window for debugging');
```

- [ ] **Step 2: ShareService cleanup**

In `share-service.ts` delete, in order:
1. The `ShareAnalyticsEvent` interface and its doc comment (L160–168).
2. `private static analyticsListeners: Set<…> = new Set();` (L194).
3. The three `this.trackAnalytics({ … });` calls in `copyToClipboard` (L480–485), `shareAndCopy` success (L540–545) and failure (L551–556) — remove the whole statement each time.
4. The `// Analytics` section: `subscribeToAnalytics` and `trackAnalytics` (L563–591).
5. The `// Client-Side Analytics Storage` section to the end of the class (`ANALYTICS_STORAGE_KEY` … `clearAnalyticsData`, L695–797), keeping the class's closing brace.

Then: `grep -n "nalytics" apps/web-app/src/services/share-service.ts` must print nothing.

- [ ] **Step 3: Locale copy**

Set `config.analyticsDesc` (each file, line ~223):

- `en.json`: `"Share anonymous usage data — which tools and dyes are used, and .chara imports. No identifiers, no images."`
- `de.json`: `"Anonyme Nutzungsdaten teilen – welche Werkzeuge und Färbemittel verwendet werden sowie .chara-Importe. Keine Kennungen, keine Bilder."`
- `fr.json`: `"Partager des données d'utilisation anonymes – outils et teintures utilisés, et imports .chara. Aucun identifiant, aucune image."`
- `ja.json`: `"匿名の使用データを共有します — 使用したツールと染料、.chara の読み込み。識別子や画像は含まれません。"`
- `ko.json`: `"익명 사용 데이터를 공유합니다 — 사용한 도구와 염료, .chara 불러오기. 식별자나 이미지는 포함되지 않습니다."`
- `zh.json`: `"分享匿名使用数据 — 使用的工具与染剂，以及 .chara 导入。不含任何标识符或图片。"`

- [ ] **Step 4: Comment + CLAUDE.md**

`tool-config-types.ts` L268: replace `/** Enable anonymous analytics data collection (placeholder for future) */` with `/** Opt-in usage telemetry — read by TelemetryService (docs/superpowers/specs/2026-08-29-web-analytics-design.md) */`.

`apps/web-app/CLAUDE.md`:
- Services table: change `│   ├── share-service.ts             # Share URLs + analytics` to `│   ├── share-service.ts             # Share URLs (generate/parse/copy)` and add after it: `│   ├── telemetry-service.ts         # Opt-in usage telemetry → api-worker POST /v1/telemetry (default off, GPC-aware, no ids)`.
- Security Patterns: replace `- **No PII in analytics** — \`share-service.ts\` analytics uses opaque event names only.` with `- **No PII in telemetry** — \`telemetry-service.ts\` sends only allowlisted event names/dimensions (tool id, stainID, entry, producer bucket, theme) plus version/env/locale/theme/viewport bucket; no ids, nothing persisted. Default off; \`navigator.globalPrivacyControl\` honoured. Spec: \`docs/superpowers/specs/2026-08-29-web-analytics-design.md\`.`
- Sibling apps: in the `xivdyetools-api-worker` bullet, append `; opt-in telemetry via \`POST /v1/telemetry\``.

- [ ] **Step 5: Gates**

Run (from `apps/web-app`): `pnpm run lint && pnpm run test -- --run && pnpm run type-check && pnpm run validate:i18n && pnpm run build:check`
Expected: all green. knip must not report `telemetry-service.ts` or any share-service symbol; the i18n parity gate covers the six locales.

- [ ] **Step 6: Commit**

```bash
git add apps/web-app/src/main.ts apps/web-app/src/services/share-service.ts apps/web-app/src/locales apps/web-app/src/shared/tool-config-types.ts apps/web-app/CLAUDE.md
git commit -m "feat(web-app): wire TelemetryService at boot, drop ShareService's dead localStorage analytics, concrete opt-in copy

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Playwright — toggle off sends nothing, toggle on beacons

**Files:**
- Create: `apps/web-app/e2e/telemetry.spec.ts`

**Interfaces:**
- Consumes: `seedStartupStorage`, `dismissBlockingOverlays`, `waitForAppReady`, `switchToolViaMenu` from `e2e/fixtures/navigation.ts`; config storage key `xivdyetools_v4_config_advanced` (ConfigController's `CONFIG_STORAGE_PREFIX` + key); `VITE_API_WORKER_URL` default `http://localhost:8790` in dev.

- [ ] **Step 1: Write the spec**

```ts
/**
 * Telemetry — the Enable Analytics toggle is honoured end-to-end.
 * The api-worker route is intercepted; no worker runs.
 */
import { test, expect, type Page, type Request } from './fixtures/coverage';
import {
  seedStartupStorage,
  dismissBlockingOverlays,
  waitForAppReady,
  switchToolViaMenu,
} from './fixtures/navigation';

const TELEMETRY = /\/v1\/telemetry$/;

async function seedAnalytics(page: Page, enabled: boolean): Promise<void> {
  await page.addInitScript((on: boolean) => {
    localStorage.setItem(
      'xivdyetools_v4_config_advanced',
      JSON.stringify({ analyticsEnabled: on, performanceMode: false }),
    );
  }, enabled);
}

function captureBeacons(page: Page): Request[] {
  const seen: Request[] = [];
  page.on('request', (req) => {
    if (TELEMETRY.test(req.url())) seen.push(req);
  });
  return seen;
}

test.describe('telemetry', () => {
  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
    await page.route(TELEMETRY, (route) => route.fulfill({ status: 204, body: '' }));
  });

  test('sends nothing while analytics is off (the default)', async ({ page }) => {
    await seedAnalytics(page, false);
    const beacons = captureBeacons(page);
    await page.goto('/');
    await waitForAppReady(page);
    await dismissBlockingOverlays(page);
    await switchToolViaMenu(page, 'mixer');
    await switchToolViaMenu(page, 'comparison');
    // Force the pagehide flush path too
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForTimeout(500);
    expect(beacons).toHaveLength(0);
  });

  test('beacons tool_leave + tool_view on navigation when analytics is on', async ({ page }) => {
    await seedAnalytics(page, true);
    const beacons = captureBeacons(page);
    await page.goto('/');
    await waitForAppReady(page);
    await dismissBlockingOverlays(page);
    await switchToolViaMenu(page, 'mixer');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(() => beacons.length).toBeGreaterThan(0);

    const bodies = beacons.map((r) => JSON.parse(r.postData() ?? '{}'));
    const events = bodies.flatMap((b) => b.events as Array<{ n: string; p: Record<string, unknown> }>);
    expect(events).toContainEqual({ n: 'tool_view', p: { tool: 'harmony', entry: 'initial' } });
    expect(events.some((e) => e.n === 'tool_leave' && e.p.tool === 'harmony')).toBe(true);
    expect(events).toContainEqual({ n: 'tool_view', p: { tool: 'mixer', entry: 'nav' } });

    // Envelope carries only coarse dimensions and nothing that looks like an id
    for (const body of bodies) {
      expect(Object.keys(body).sort()).toEqual(['env', 'events', 'locale', 'theme', 'v', 'ver', 'vp']);
    }
    // sendBeacon → text/plain (no preflight)
    expect(beacons[0].headers()['content-type']).toMatch(/^text\/plain/);
  });
});
```

- [ ] **Step 2: Run it**

Run (from `apps/web-app`): `npx playwright test e2e/telemetry.spec.ts --project=chromium`
Expected: 2 passed. If `switchToolViaMenu` needs a different tool id form, mirror `harmony-generator.spec.ts`'s navigation.

- [ ] **Step 3: Commit**

```bash
git add apps/web-app/e2e/telemetry.spec.ts
git commit -m "test(web-app): e2e — analytics toggle gates telemetry beacons

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Query cookbook + full gates

**Files:**
- Create: `docs/operations/ANALYTICS_QUERIES.md`

- [ ] **Step 1: Write the doc**

```markdown
# Web-app analytics — reading the data

Dataset: `xivdyetools_web_analytics` (production worker; `env` blob separates
`production` from `beta`). `xivdyetools_web_analytics_dev` receives only local
`wrangler dev` traffic and can be ignored. Written by `POST /v1/telemetry` on
api-worker; schema in `apps/api-worker/src/telemetry/schema.ts`. Spec:
`docs/superpowers/specs/2026-08-29-web-analytics-design.md`.

**Retention is ~3 months.** No rollup exists yet — if history matters, add a
monthly cron that copies these aggregates into KV/D1.

## Column layout (fixed — every event uses the same slots)

| Column | Content |
|---|---|
| `index1` / `blob1` | event: `tool_view`, `tool_leave`, `dye_pick`, `chara_parse`, `theme_change` |
| `blob2` | tool id (`''` for chara_parse / theme_change) |
| `blob3` | `entry` (initial/share/nav) · `via` (drawer/grid) · `ok` (true/false) · `to` (theme) |
| `blob4` | `stainID` (dye_pick) · `producer` (chara_parse) · `''` |
| `blob5`–`blob9` | locale · theme · viewport (m/t/d) · app version · env |
| `double1` | `active_s` for tool_leave, else 0 |

## Running a query

```bash
curl -s https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/analytics_engine/sql \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  --data "<SQL>"
```

Always aggregate with `sum(_sample_interval)` — Analytics Engine samples under
load and `count()` under-reports.

## 1. Tool popularity — deliberate opens only (last 30 days)

```sql
SELECT blob2 AS tool, sum(_sample_interval) AS views
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_view' AND blob3 <> 'initial' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY tool ORDER BY views DESC
```

`blob3 <> 'initial'` removes the Harmony-by-default bias. Add `AND blob3 = 'share'`
to see which tools arrive via share links.

## 2. Median visible time per tool

```sql
SELECT blob2 AS tool, quantiles(0.5)(double1) AS median_s, sum(_sample_interval) AS leaves
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_leave' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY tool ORDER BY median_s DESC
```

## 3. Most-picked dyes (overall / per tool)

```sql
SELECT blob4 AS stainID, sum(_sample_interval) AS picks
FROM xivdyetools_web_analytics
WHERE index1 = 'dye_pick' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY stainID ORDER BY picks DESC LIMIT 20
```

Add `blob2 AS tool` to the SELECT/GROUP BY for per-tool lists. Map stainIDs to
names with `GET https://data.xivdyetools.app/v1/dyes/stain/<id>`.

## 4. .chara parses per ISO week

```sql
SELECT toStartOfWeek(timestamp) AS week, blob3 AS ok, blob4 AS producer, sum(_sample_interval) AS parses
FROM xivdyetools_web_analytics
WHERE index1 = 'chara_parse' AND blob9 = 'production'
GROUP BY week, ok, producer ORDER BY week
```

## 5. Theme preference

The default theme is a fixed `standard-dark` (no OS-preference check), so the
share of batches on Dark over-counts preference. Read both:

```sql
-- (a) theme in use — Light share is the floor for "chose Light"
SELECT blob6 AS theme, sum(_sample_interval) AS views
FROM xivdyetools_web_analytics
WHERE index1 = 'tool_view' AND blob9 = 'production'
  AND timestamp > now() - INTERVAL '30' DAY
GROUP BY theme

-- (b) deliberate switches per week
SELECT toStartOfWeek(timestamp) AS week, blob3 AS switched_to, sum(_sample_interval) AS switches
FROM xivdyetools_web_analytics
WHERE index1 = 'theme_change' AND blob9 = 'production'
GROUP BY week, switched_to ORDER BY week
```
```

- [ ] **Step 2: Full monorepo gates for the touched packages**

Run: `pnpm turbo run lint type-check test build --filter=xivdyetools-api-worker --filter=xivdyetools-web-app`
Expected: green. Then from `apps/web-app`: `npx playwright test --project=chromium e2e/telemetry.spec.ts e2e/ui-interactions.spec.ts` — green.

- [ ] **Step 3: Commit**

```bash
git add docs/operations/ANALYTICS_QUERIES.md
git commit -m "docs: Analytics Engine query cookbook for web-app telemetry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Deploy notes (after merge — user-run)

1. api-worker deploys via its path-filtered workflow on merge to `main` (`--env production`); the new `[[env.production.analytics_engine_datasets]]` block creates the dataset on first write — no dashboard step.
2. The web-app deploys with the Pages workflow; the toggle is off by default, so nothing is sent until a user opts in.
3. First data check: query 1 in `docs/operations/ANALYTICS_QUERIES.md` after a day.

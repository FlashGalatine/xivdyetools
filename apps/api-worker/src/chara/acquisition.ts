/**
 * GPOSERS "Acquisition" lines — a build-time table, English only.
 *
 * `scripts/build-acquisition.ts` regenerates `data/acquisition.en.json`
 * (equippable items that have a line) after each patch from Teamcraft's data
 * files and XIVAPI; the worker never computes or fetches acquisition data at
 * request time. Missing means "no line": the glamour export leaves the field
 * for the player (spec: docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md).
 */

/*
 * OPT-002: 1.4 MB of JSON, read only by POST /v1/chara/resolve — loaded on
 * first use instead of at isolate start for every route. The route awaits
 * `loadAcquisition()` before resolving; `acquisitionFor` stays synchronous so
 * the resolver stays pure.
 */
let lines: Record<string, string> | undefined;
let loading: Promise<void> | undefined;

export function loadAcquisition(): Promise<void> {
  loading ??= import('./data/acquisition.en.json').then(
    (m) => {
      lines = m.default;
    },
    (error: unknown) => {
      loading = undefined; // a failed import is retried, not remembered
      throw error;
    },
  );
  return loading;
}

export function acquisitionFor(itemId: number): string | undefined {
  if (!lines) throw new Error('acquisition table not loaded: await loadAcquisition() first');
  return lines[String(itemId)];
}

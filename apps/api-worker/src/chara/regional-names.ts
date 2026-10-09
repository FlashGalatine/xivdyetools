/**
 * Korean / Chinese equipment names — build-time tables, EN fallback per item.
 *
 * XIVAPI v2 serves the global client only (en/ja/de/fr). The regional clients'
 * names come from the community datamining exports, which share global's Item
 * row IDs, so a global `row_id` indexes them directly. `scripts/build-item-names.mjs`
 * regenerates `data/item-names.{ko,zh}.json` (equippable rows only) — run it
 * after a patch and commit; the worker never fetches GitHub at request time.
 * It also writes `data/item-names.ja.json`, which is NOT imported here: ja
 * names come from XIVAPI in the same call as en/de/fr, and that table exists
 * only for discord-worker's JP font subset and its coverage gate.
 *
 * The tables can lag: the regional clients have historically trailed global by
 * months, so a brand-new item may have no ko/zh name for a while. Missing
 * means "omit the key" — the caller falls back to EN, exactly as the dye-name
 * pipeline does.
 */

/*
 * OPT-002: 2.0 MB of JSON, read only by POST /v1/chara/resolve — loaded on
 * first use instead of at isolate start for every route. The route awaits
 * `loadRegionalNames()` before resolving; `regionalNames` stays synchronous so
 * the resolver stays pure.
 */
let ko: Record<string, string> | undefined;
let zh: Record<string, string> | undefined;
let loading: Promise<void> | undefined;

export function loadRegionalNames(): Promise<void> {
  loading ??= Promise.all([
    import('./data/item-names.ko.json'),
    import('./data/item-names.zh.json'),
  ]).then(
    ([k, z]) => {
      ko = k.default;
      zh = z.default;
    },
    (error: unknown) => {
      loading = undefined; // a failed import is retried, not remembered
      throw error;
    },
  );
  return loading;
}

export interface RegionalNames {
  ko?: string;
  zh?: string;
}

export function regionalNames(itemId: number): RegionalNames {
  if (!ko || !zh) throw new Error('regional name tables not loaded: await loadRegionalNames() first');
  const id = String(itemId);
  const out: RegionalNames = {};
  const k = ko[id];
  const z = zh[id];
  if (k) out.ko = k;
  if (z) out.zh = z;
  return out;
}

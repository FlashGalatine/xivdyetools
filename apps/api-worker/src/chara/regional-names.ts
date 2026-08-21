/**
 * Korean / Chinese equipment names — build-time tables, EN fallback per item.
 *
 * XIVAPI v2 serves the global client only (en/ja/de/fr). The regional clients'
 * names come from the community datamining exports, which share global's Item
 * row IDs, so a global `row_id` indexes them directly. `scripts/build-item-names.mjs`
 * regenerates `data/item-names.{ko,zh}.json` (equippable rows only) — run it
 * after a patch and commit; the worker never fetches GitHub at request time.
 *
 * The tables can lag: the regional clients have historically trailed global by
 * months, so a brand-new item may have no ko/zh name for a while. Missing
 * means "omit the key" — the caller falls back to EN, exactly as the dye-name
 * pipeline does.
 */

import koTable from './data/item-names.ko.json';
import zhTable from './data/item-names.zh.json';

const ko = koTable as Record<string, string>;
const zh = zhTable as Record<string, string>;

export interface RegionalNames {
  ko?: string;
  zh?: string;
}

export function regionalNames(itemId: number): RegionalNames {
  const id = String(itemId);
  const out: RegionalNames = {};
  const k = ko[id];
  const z = zh[id];
  if (k) out.ko = k;
  if (z) out.zh = z;
  return out;
}

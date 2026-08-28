# Local Presets (web-app 5.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreachable 4.x Collection Manager with *local presets* — presets stored in the browser, managed on the Presets → Saved tab, editable in the existing submission form, exportable as JSON, shareable by self-contained link, and publishable to the community.

**Architecture:** A new `LocalPresetService` (localStorage `v5_local_presets`, cap 200, tombstones) becomes the single store for user-authored palettes; `CollectionService` shrinks to favorites and its palette/swap/character records migrate 1:1 with origin tags. The Presets tool's Saved tab lists local presets through the existing `v4-preset-card` / `v4-preset-detail`, the 8S submission form gains a `local` mode, `ShareService` gains a `presets` grammar (`?dyes=&name=&cat=&sec=&desc=`), og-worker renders a 15E band card for it, and Advanced → Backup exports/imports a v2 file that includes favorites + local presets.

**Tech Stack:** TypeScript, Lit (`BaseLitComponent`), vanilla `BaseComponent` tools, vitest + jsdom (`src/__tests__/component-utils.ts`), Playwright E2E, `@xivdyetools/core` (`dyeService`, stainIDs), `@xivdyetools/types` (`DyeId`, `PresetCategory`), Cloudflare Worker (og-worker, Hono).

**Spec:** `docs/superpowers/specs/2026-08-16-local-presets-5-1-design.md`

## Global Constraints

- Ships as **web-app 5.1.0** — work on a branch off `monorepo-2.0-prep` (or `main` once the 5.0 merge lands); the version bump + changelog are the last task.
- Local rules: name 1–50 (trimmed), description `''` or ≤ 200, dyes 1–20 **stainIDs 1–254** (deduped, legacy itemIDs ≥ 5729 rejected loudly), `secondary_categories` ≤ 2 and distinct from `category_id`; caps: **200 presets, 200 tombstones**.
- Community rules (only at publish/share-to-community): 3–6 dyes, `category_id` required, example link allowlist (`@shared/example-link` `exampleLinkError`).
- Storage key `v5_local_presets`, record `{ version: 1, presets, tombstones, lastModified }`; `CollectionService` keeps **favorites only** after migration; `saved-presets-service.ts` (bookmarks) unchanged.
- Share grammar: `/presets/?dyes=<stainIDs csv>&name=<≤50>&cat=<slug>&sec=<slug,slug>&desc=<≤200>&v=1`; `dyes` required; picture never travels. **Deviation from spec §4:** do NOT add these to `RouterService.PRESERVED_PARAMS` (`dyes` is also comparison's/accessibility's param and would leak across tool switches); the presets tool reads `window.location.search` on load like every other tool.
- Files: single `{ type: 'xivdyetools-preset', version: 1, exportedAt, preset }`, multi `{ type: 'xivdyetools-presets', version: 1, exportedAt, presets }`; Backup `{ version: 2, exportedAt, type: 'xivdyetools-settings', configs, favorites, localPresets, tombstones }`; importer accepts Backup v2, v1 (`configs` only), and legacy `type: 'xivdyetools-collection'`.
- Strings live under `preset.local.*` in ALL SIX `src/locales/{en,ja,de,fr,ko,zh}.json`; en/de/ja authored, fr/ko/zh drafted with a `// native-review` note in the PR; `npm run validate:i18n -- --strict` must pass.
- Web-app gotchas: tool content renders inside `v4-layout-shell`'s shadow DOM (inline styles; document Tailwind doesn't reach it); modals render in light DOM `#modal-root`; custom elements referenced only via `document.createElement` need a bare side-effect import.
- Every task: run its test file(s), then `pnpm exec tsc --noEmit -p tsconfig.json` and `pnpm exec eslint <touched files>` from `apps/web-app`; commit with a conventional message. Do not touch CHANGELOGs until the final task.

---

## File structure

**Create**
- `apps/web-app/src/services/local-preset-service.ts` — the store: types, validation, CRUD, tombstones, migration from `CollectionService`, export/import shapes, content signature, community-rule check.
- `apps/web-app/src/services/__tests__/local-preset-service.test.ts`
- `apps/web-app/src/shared/local-preset-files.ts` — file (JSON) shape guards + download helper (`downloadJson(filename, obj)`), shared by the Saved tab and Backup.
- `apps/web-app/src/shared/__tests__/local-preset-files.test.ts`
- `apps/web-app/src/components/__tests__/v4/preset-tool-saved.test.ts` — Saved-tab behaviour.
- `apps/web-app/src/components/__tests__/preset-submission-form-local.test.ts`
- `apps/web-app/src/components/__tests__/advanced-options-backup.test.ts`
- `apps/og-worker/src/services/svg/presets-shared.ts` (+ `.test.ts`) — band card from `dyes`/`name`.

**Modify**
- `src/services/collection-service.ts` — expose what migration needs, then (last) delete the collections API.
- `src/components/mixer-tool.ts`, `budget-tool.ts`, `chara-import.ts` — write sites → `LocalPresetService`.
- `src/components/v4/preset-tool.ts`, `v4/preset-card.ts`, `v4/preset-detail.ts` — shelf, chips, kebab, New/Import, deep-link, shared-preset landing.
- `src/components/preset-submission-form.ts` — `mode: 'local' | 'community'`, chip reorder.
- `src/services/share-service.ts` — `PresetShareParams`, validation, title/description.
- `src/components/advanced-options-panel.ts` — Backup v2, clear action.
- `src/services/indexeddb-service.ts` — `PRESET_IMAGES` store (unit e).
- `src/locales/*.json` ×6 — `preset.local.*`.
- `apps/og-worker/src/og-data-generator.ts`, `src/index.ts` — presets card.
- `vitest.config.ts` — drop excludes for deleted files.
- Delete: `src/components/collection-manager-modal.ts`, `add-to-collection-menu.ts`; buttons in `dye-selector.ts:513-525`, `dye-grid.ts:286-300`.

Interfaces every task can rely on (defined in Task 1):

```ts
// src/services/local-preset-service.ts
export type LocalPresetOriginKind = 'authored'|'mixer'|'swap'|'character'|'imported'|'link'|'clone';
export interface LocalPresetOrigin { kind: LocalPresetOriginKind; target?: DyeId; sourceId?: number }
export interface LocalPreset {
  id: string; name: string; description: string; dyes: DyeId[];
  category_id?: PresetCategory; secondary_categories: PresetCategory[];
  example_link?: string; previewImage?: { key: string };
  origin: LocalPresetOrigin; publishedId?: number; createdAt: number; updatedAt: number;
}
export interface LocalPresetInput {   // create/update payload
  name: string; description?: string; dyes: number[];
  category_id?: PresetCategory; secondary_categories?: PresetCategory[];
  example_link?: string; origin?: LocalPresetOrigin;
}
export interface LocalPresetImportResult { imported: number; skipped: number; errors: string[] }
export class LocalPresetService {
  static initialize(): void;                       // load + migrate once
  static getAll(): LocalPreset[]; static get(id: string): LocalPreset | null;
  static create(input: LocalPresetInput): LocalPreset;      // throws Error(code) on rule violation
  static update(id: string, patch: Partial<LocalPresetInput>): LocalPreset;
  static remove(id: string): boolean;              // tombstones
  static duplicate(id: string): LocalPreset | null;
  static setPublishedId(id: string, publishedId: number): void;
  static subscribe(cb: (presets: LocalPreset[]) => void): () => void; // fires immediately
  static count(): number; static canCreate(): boolean;
  static contentSignature(dyes: number[], name: string): string;
  static findBySignature(sig: string): LocalPreset | null;
  static uniqueName(base: string): string;         // "Name", "Name (2)", …
  static validateForCommunity(p: LocalPreset): string[]; // [] = publishable
  static exportOne(id: string): LocalPresetFile | null;
  static exportAll(): LocalPresetsFile;
  static importFile(data: unknown, origin?: LocalPresetOriginKind): LocalPresetImportResult;
  static exportForBackup(): { presets: LocalPreset[]; tombstones: Tombstone[] };
  static importFromBackup(data: { presets?: unknown; tombstones?: unknown }): LocalPresetImportResult;
  static __reloadForTesting(): void; static reset(): void;
}
```

---

## Unit (a) — service, migration, write sites, shelf, editor

### Task 1: `LocalPresetService` — types, rules, CRUD, tombstones, subscribe

**Files:**
- Create: `apps/web-app/src/services/local-preset-service.ts`
- Test: `apps/web-app/src/services/__tests__/local-preset-service.test.ts`
- Read for patterns: `apps/web-app/src/services/saved-presets-service.ts` (subscribe/store shape), `collection-service.ts:120-146` (`toStainId`, caps), `storage-service.ts:58-118` (`StorageService.getItem/setItem/removeItem`).

**Interfaces:**
- Consumes: `StorageService`, `DyeId`/`PresetCategory` from `@xivdyetools/types`, `PRESET_CATEGORIES`-style slug list — use the same category slug source the submission form uses (`preset-category-selector.ts`; export/reuse its category id list, or `PresetCategory` union values from `@xivdyetools/types`).
- Produces: everything in the interface block above except import/export/migration (Tasks 2–3).

- [ ] **Step 1: Write the failing tests** (`local-preset-service.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalPresetService, type LocalPreset } from '../local-preset-service';

const KEY = 'v5_local_presets';
beforeEach(() => { localStorage.clear(); LocalPresetService.__reloadForTesting(); });

describe('LocalPresetService rules', () => {
  it('creates a preset with defaults and persists it', () => {
    const p = LocalPresetService.create({ name: '  Glam  ', dyes: [102, 51] });
    expect(p.id).toMatch(/^lp_/);
    expect(p.name).toBe('Glam');
    expect(p.description).toBe('');
    expect(p.dyes).toEqual([102, 51]);
    expect(p.secondary_categories).toEqual([]);
    expect(p.origin).toEqual({ kind: 'authored' });
    expect(JSON.parse(localStorage.getItem(KEY)!).presets).toHaveLength(1);
  });
  it('rejects empty/overlong names and bad dyes', () => {
    expect(() => LocalPresetService.create({ name: '', dyes: [1] })).toThrow('name');
    expect(() => LocalPresetService.create({ name: 'x'.repeat(51), dyes: [1] })).toThrow('name');
    expect(() => LocalPresetService.create({ name: 'a', dyes: [] })).toThrow('dyes');
    expect(() => LocalPresetService.create({ name: 'a', dyes: Array.from({length: 21}, (_, i) => i + 1) })).toThrow('dyes');
    expect(() => LocalPresetService.create({ name: 'a', dyes: [5729] })).toThrow('stainID'); // legacy itemID
    expect(() => LocalPresetService.create({ name: 'a', dyes: [0] })).toThrow('stainID');
  });
  it('dedupes dyes preserving order and caps secondaries', () => {
    const p = LocalPresetService.create({ name: 'a', dyes: [3, 1, 3, 2, 1] });
    expect(p.dyes).toEqual([3, 1, 2]);
    expect(() => LocalPresetService.create({ name: 'a', dyes: [1], category_id: 'jobs', secondary_categories: ['jobs'] })).toThrow('secondary');
    expect(() => LocalPresetService.create({ name: 'a', dyes: [1], secondary_categories: ['jobs', 'events', 'zones'] })).toThrow('secondary');
  });
  it('update patches fields, bumps updatedAt, keeps origin', () => {
    const p = LocalPresetService.create({ name: 'a', dyes: [1], origin: { kind: 'swap', target: 102 as any } });
    const u = LocalPresetService.update(p.id, { name: 'b', dyes: [2, 3], description: 'd' });
    expect(u.name).toBe('b'); expect(u.dyes).toEqual([2, 3]); expect(u.description).toBe('d');
    expect(u.origin).toEqual({ kind: 'swap', target: 102 });
    expect(u.updatedAt).toBeGreaterThanOrEqual(p.updatedAt);
  });
  it('remove tombstones and hides the record', () => {
    const p = LocalPresetService.create({ name: 'a', dyes: [1] });
    expect(LocalPresetService.remove(p.id)).toBe(true);
    expect(LocalPresetService.get(p.id)).toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY)!).tombstones).toEqual([expect.objectContaining({ id: p.id })]);
  });
  it('enforces the 200 cap and canCreate', () => {
    for (let i = 0; i < 200; i++) LocalPresetService.create({ name: `p${i}`, dyes: [1] });
    expect(LocalPresetService.canCreate()).toBe(false);
    expect(() => LocalPresetService.create({ name: 'over', dyes: [1] })).toThrow('cap');
  });
  it('duplicate copies with "(2)" name and origin clone-less authored', () => {
    const p = LocalPresetService.create({ name: 'a', dyes: [1, 2] });
    const d = LocalPresetService.duplicate(p.id)!;
    expect(d.id).not.toBe(p.id); expect(d.name).toBe('a (2)'); expect(d.dyes).toEqual([1, 2]);
  });
  it('subscribe fires immediately and on every change', () => {
    const seen: number[] = [];
    const off = LocalPresetService.subscribe((ps: LocalPreset[]) => seen.push(ps.length));
    LocalPresetService.create({ name: 'a', dyes: [1] });
    off();
    LocalPresetService.create({ name: 'b', dyes: [1] });
    expect(seen).toEqual([0, 1]);
  });
  it('validateForCommunity lists the community-only rules', () => {
    const p = LocalPresetService.create({ name: 'a', dyes: [1, 2] });
    expect(LocalPresetService.validateForCommunity(p)).toEqual(expect.arrayContaining([expect.stringMatching(/3.*6/), expect.stringMatching(/category/)]));
    const ok = LocalPresetService.create({ name: 'b', dyes: [1, 2, 3], category_id: 'events' });
    expect(LocalPresetService.validateForCommunity(ok)).toEqual([]);
  });
  it('setPublishedId marks the record', () => {
    const p = LocalPresetService.create({ name: 'a', dyes: [1] });
    LocalPresetService.setPublishedId(p.id, 42);
    expect(LocalPresetService.get(p.id)!.publishedId).toBe(42);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web-app && pnpm exec vitest run src/services/__tests__/local-preset-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```ts
// apps/web-app/src/services/local-preset-service.ts
import type { DyeId, PresetCategory } from '@xivdyetools/types';
import { StorageService } from './storage-service';
import { logger } from '@shared/logger';

export const LOCAL_PRESETS_KEY = 'v5_local_presets';
export const LOCAL_PRESET_LIMITS = { maxPresets: 200, maxTombstones: 200, maxDyes: 20, minDyes: 1, maxName: 50, maxDescription: 200, maxSecondary: 2, stainIdMax: 254 } as const;
export const COMMUNITY_RULES = { minDyes: 3, maxDyes: 6 } as const;

export type LocalPresetOriginKind = 'authored'|'mixer'|'swap'|'character'|'imported'|'link'|'clone';
export interface LocalPresetOrigin { kind: LocalPresetOriginKind; target?: DyeId; sourceId?: number }
export interface LocalPreset { /* as in the interface block */ }
export interface LocalPresetInput { /* as in the interface block */ }
export interface Tombstone { id: string; deletedAt: number }
interface StoreShape { version: 1; presets: LocalPreset[]; tombstones: Tombstone[]; lastModified: number }

const CATEGORY_SLUGS: readonly PresetCategory[] = ['jobs','grandCompanies','seasons','events','aesthetics','appearance','zones','raids-trials'] as const;
// ^ verify against @xivdyetools/types PresetCategory and preset-category-selector.ts before committing

function normalizeDyes(raw: number[]): DyeId[] {
  const out: DyeId[] = [];
  for (const v of raw) {
    if (!Number.isInteger(v) || v < 1 || v > LOCAL_PRESET_LIMITS.stainIdMax) throw new Error(`stainID: ${v} is not a stainID (1-${LOCAL_PRESET_LIMITS.stainIdMax})`);
    if (!out.includes(v as DyeId)) out.push(v as DyeId);
  }
  if (out.length < LOCAL_PRESET_LIMITS.minDyes || out.length > LOCAL_PRESET_LIMITS.maxDyes) throw new Error(`dyes: need ${LOCAL_PRESET_LIMITS.minDyes}-${LOCAL_PRESET_LIMITS.maxDyes}`);
  return out;
}
function normalizeName(raw: string): string {
  const n = (raw ?? '').trim();
  if (n.length < 1 || n.length > LOCAL_PRESET_LIMITS.maxName) throw new Error(`name: 1-${LOCAL_PRESET_LIMITS.maxName} characters`);
  return n;
}
function normalizeCategories(primary?: PresetCategory, secondary: PresetCategory[] = []): { category_id?: PresetCategory; secondary_categories: PresetCategory[] } {
  if (primary !== undefined && !CATEGORY_SLUGS.includes(primary)) throw new Error(`category: unknown ${primary}`);
  const sec = [...new Set(secondary)];
  if (sec.length > LOCAL_PRESET_LIMITS.maxSecondary) throw new Error('secondary: at most 2');
  if (sec.some(s => !CATEGORY_SLUGS.includes(s))) throw new Error('secondary: unknown category');
  if (primary && sec.includes(primary)) throw new Error('secondary: must differ from primary');
  return { category_id: primary, secondary_categories: sec };
}

export class LocalPresetService {
  private static store: StoreShape | null = null;
  private static listeners = new Set<(p: LocalPreset[]) => void>();

  static initialize(): void { this.load(); }   // Task 3 adds migrateFromCollections() here
  private static load(): StoreShape {
    if (this.store) return this.store;
    const raw = StorageService.getItem<StoreShape>(LOCAL_PRESETS_KEY);
    this.store = raw && raw.version === 1 && Array.isArray(raw.presets)
      ? { version: 1, presets: raw.presets, tombstones: raw.tombstones ?? [], lastModified: raw.lastModified ?? Date.now() }
      : { version: 1, presets: [], tombstones: [], lastModified: Date.now() };
    return this.store;
  }
  private static save(): void {
    const s = this.load(); s.lastModified = Date.now();
    StorageService.setItem(LOCAL_PRESETS_KEY, s);
    const snapshot = this.getAll(); this.listeners.forEach(l => l(snapshot));
  }
  static getAll(): LocalPreset[] { return this.load().presets.map(p => ({ ...p, dyes: [...p.dyes], secondary_categories: [...p.secondary_categories] })); }
  static get(id: string): LocalPreset | null { return this.getAll().find(p => p.id === id) ?? null; }
  static count(): number { return this.load().presets.length; }
  static canCreate(): boolean { return this.count() < LOCAL_PRESET_LIMITS.maxPresets; }
  static create(input: LocalPresetInput): LocalPreset {
    if (!this.canCreate()) throw new Error(`cap: ${LOCAL_PRESET_LIMITS.maxPresets} presets`);
    const now = Date.now();
    const cats = normalizeCategories(input.category_id, input.secondary_categories);
    const preset: LocalPreset = {
      id: `lp_${crypto.randomUUID()}`, name: normalizeName(input.name),
      description: (input.description ?? '').slice(0, LOCAL_PRESET_LIMITS.maxDescription),
      dyes: normalizeDyes(input.dyes), ...cats,
      example_link: input.example_link?.trim() || undefined,
      origin: input.origin ?? { kind: 'authored' }, createdAt: now, updatedAt: now,
    };
    this.load().presets.push(preset); this.save(); return preset;
  }
  static update(id: string, patch: Partial<LocalPresetInput>): LocalPreset {
    const s = this.load(); const p = s.presets.find(x => x.id === id);
    if (!p) throw new Error('not found');
    if (patch.name !== undefined) p.name = normalizeName(patch.name);
    if (patch.description !== undefined) p.description = patch.description.slice(0, LOCAL_PRESET_LIMITS.maxDescription);
    if (patch.dyes !== undefined) p.dyes = normalizeDyes(patch.dyes);
    if (patch.category_id !== undefined || patch.secondary_categories !== undefined) {
      Object.assign(p, normalizeCategories(patch.category_id ?? p.category_id, patch.secondary_categories ?? p.secondary_categories));
    }
    if (patch.example_link !== undefined) p.example_link = patch.example_link.trim() || undefined;
    p.updatedAt = Date.now(); this.save(); return { ...p };
  }
  static remove(id: string): boolean {
    const s = this.load(); const i = s.presets.findIndex(p => p.id === id);
    if (i === -1) return false;
    s.presets.splice(i, 1);
    s.tombstones.push({ id, deletedAt: Date.now() });
    if (s.tombstones.length > LOCAL_PRESET_LIMITS.maxTombstones) s.tombstones.splice(0, s.tombstones.length - LOCAL_PRESET_LIMITS.maxTombstones);
    this.save(); return true;
  }
  static isTombstoned(id: string): boolean { return this.load().tombstones.some(t => t.id === id); }
  static uniqueName(base: string): string {
    const names = new Set(this.load().presets.map(p => p.name.toLowerCase()));
    if (!names.has(base.toLowerCase())) return base;
    for (let n = 2; ; n++) { const c = `${base} (${n})`.slice(0, LOCAL_PRESET_LIMITS.maxName); if (!names.has(c.toLowerCase())) return c; }
  }
  static duplicate(id: string): LocalPreset | null {
    const p = this.get(id); if (!p) return null;
    return this.create({ name: this.uniqueName(p.name), description: p.description, dyes: p.dyes, category_id: p.category_id, secondary_categories: p.secondary_categories, example_link: p.example_link, origin: { kind: 'authored' } });
  }
  static setPublishedId(id: string, publishedId: number): void {
    const p = this.load().presets.find(x => x.id === id); if (!p) return; p.publishedId = publishedId; this.save();
  }
  static subscribe(cb: (presets: LocalPreset[]) => void): () => void { this.listeners.add(cb); cb(this.getAll()); return () => this.listeners.delete(cb); }
  static contentSignature(dyes: number[], name: string): string { return `${[...dyes].join(',')}|${name.trim().toLowerCase()}`; }
  static findBySignature(sig: string): LocalPreset | null { return this.getAll().find(p => this.contentSignature(p.dyes, p.name) === sig) ?? null; }
  static validateForCommunity(p: LocalPreset): string[] {
    const errs: string[] = [];
    if (p.dyes.length < COMMUNITY_RULES.minDyes || p.dyes.length > COMMUNITY_RULES.maxDyes) errs.push(`Community presets need ${COMMUNITY_RULES.minDyes}-${COMMUNITY_RULES.maxDyes} dyes`);
    if (!p.category_id) errs.push('Community presets need a category');
    return errs;
  }
  static __reloadForTesting(): void { this.store = null; this.listeners.clear(); }
  static reset(): void { this.store = { version: 1, presets: [], tombstones: [], lastModified: Date.now() }; this.save(); }
}
```
(Description length is truncated, not rejected, mirroring the community form's soft cap; the form validates ≤200 before calling.)

- [ ] **Step 4: Run tests → PASS**, then `pnpm exec tsc --noEmit -p tsconfig.json`.
- [ ] **Step 5: Commit** — `feat(web-app): LocalPresetService — rules, CRUD, tombstones, subscribe`

### Task 2: Export/import shapes (`local-preset-files.ts`) + service `exportOne/exportAll/importFile/exportForBackup/importFromBackup`

**Files:**
- Create: `apps/web-app/src/shared/local-preset-files.ts`, `apps/web-app/src/shared/__tests__/local-preset-files.test.ts`
- Modify: `apps/web-app/src/services/local-preset-service.ts`; extend `local-preset-service.test.ts`

**Interfaces:**
- Produces:
```ts
// src/shared/local-preset-files.ts
export interface LocalPresetFilePreset { name: string; description?: string; dyes: number[]; category_id?: string; secondary_categories?: string[]; example_link?: string; previewImage?: string /* dataURL, unit e */ }
export interface LocalPresetFile { type: 'xivdyetools-preset'; version: 1; exportedAt: string; preset: LocalPresetFilePreset }
export interface LocalPresetsFile { type: 'xivdyetools-presets'; version: 1; exportedAt: string; presets: LocalPresetFilePreset[] }
export function isLocalPresetFile(x: unknown): x is LocalPresetFile;
export function isLocalPresetsFile(x: unknown): x is LocalPresetsFile;
export function isLegacyCollectionFile(x: unknown): x is { type: 'xivdyetools-collection'; data: { collections?: Array<{ name: string; description?: string; dyes: number[]; kind?: string; target?: number }> } };
export function slugFilename(name: string, ext: string): string;  // "My Glam!" → "my-glam.xivpreset.json"
export function downloadJson(filename: string, obj: unknown): void; // Blob + a.download (same as advanced-options-panel export)
```

- [ ] **Step 1: Tests** (`local-preset-files.test.ts`: guards accept/reject; `slugFilename('My Glam!','xivpreset.json') === 'my-glam.xivpreset.json'`; `downloadJson` creates an anchor with `download` attr — spy `URL.createObjectURL`). Extend service tests:
```ts
it('exportOne/exportAll produce the file shapes', () => {
  const p = LocalPresetService.create({ name: 'a', dyes: [1, 2], category_id: 'events' });
  const one = LocalPresetService.exportOne(p.id)!;
  expect(one.type).toBe('xivdyetools-preset'); expect(one.preset).toMatchObject({ name: 'a', dyes: [1, 2], category_id: 'events' });
  expect(LocalPresetService.exportAll().presets).toHaveLength(1);
});
it('importFile maps, dedupes by signature, suffixes name conflicts, honours tombstones', () => {
  LocalPresetService.create({ name: 'a', dyes: [1, 2] });
  const r = LocalPresetService.importFile({ type: 'xivdyetools-presets', version: 1, exportedAt: 'x', presets: [
    { name: 'a', dyes: [1, 2] },          // exact duplicate → skipped
    { name: 'a', dyes: [3] },             // name conflict → "a (2)"
    { name: 'bad', dyes: [5729] },        // legacy id → error
  ]});
  expect(r).toEqual({ imported: 1, skipped: 1, errors: [expect.stringMatching(/stainID/)] });
  expect(LocalPresetService.getAll().map(p => p.name).sort()).toEqual(['a', 'a (2)']);
  expect(LocalPresetService.getAll().find(p => p.name === 'a (2)')!.origin.kind).toBe('imported');
});
it('importFile accepts a single-preset file and rejects junk', () => {
  expect(LocalPresetService.importFile({ type: 'xivdyetools-preset', version: 1, exportedAt: 'x', preset: { name: 'solo', dyes: [7] } }).imported).toBe(1);
  expect(LocalPresetService.importFile({ hello: 1 }).errors[0]).toMatch(/not a preset file/);
});
it('backup round-trip keeps ids and tombstones', () => {
  const p = LocalPresetService.create({ name: 'a', dyes: [1] }); const q = LocalPresetService.create({ name: 'b', dyes: [2] });
  LocalPresetService.remove(q.id);
  const dump = LocalPresetService.exportForBackup();
  LocalPresetService.reset();
  const r = LocalPresetService.importFromBackup(dump);
  expect(r.imported).toBe(1); expect(LocalPresetService.get(p.id)!.name).toBe('a'); expect(LocalPresetService.isTombstoned(q.id)).toBe(true);
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement.** In the service: `exportOne` maps a preset to `LocalPresetFilePreset` (drop id/origin/timestamps/publishedId); `exportAll` likewise; `importFile(data, origin='imported')`: guard with `isLocalPresetFile`/`isLocalPresetsFile` (else `{imported:0, skipped:0, errors:['not a preset file']}`), for each entry: try `create({..., name: uniqueName(name) if name taken else name, origin:{kind: origin}})` after signature check (`findBySignature` → skipped); catch → errors. `exportForBackup` returns raw `presets` + `tombstones` copies; `importFromBackup({presets, tombstones})`: merge tombstones (dedupe by id, cap), then for each preset **keep its id** if not present and not tombstoned (validate through the same normalizers; on error → errors), else skip; save once.
- [ ] **Step 4: Run both test files → PASS**; tsc; eslint.
- [ ] **Step 5: Commit** — `feat(web-app): local preset file shapes, import/export, backup round-trip`

### Task 3: Migration from `CollectionService` (palette/swap/character → local presets)

**Files:**
- Modify: `apps/web-app/src/services/local-preset-service.ts` (`initialize()` → `migrateFromCollections()`), `apps/web-app/src/services/collection-service.ts` (add `static __takeCollectionsForMigration(): { collections: Collection[]; tombstones: Tombstone[] } | null` that reads the store, returns records, then removes `COLLECTIONS_KEY` and clears in-memory collections — favorites untouched)
- Test: extend `local-preset-service.test.ts`; find where `CollectionService.initialize()` is called at boot (grep `CollectionService.initialize(` in `src/`) and add `LocalPresetService.initialize()` right after it.

**Interfaces:**
- Consumes: `CollectionService.initialize()` (which itself migrates 4.x PaletteService data into collections first — order matters), `Collection` shape `{ id, name, description?, kind, target?, dyes, createdAt, updatedAt }`.
- Produces: migrated `LocalPreset` records with `origin.kind` = `palette`→`'authored'` (or `'mixer'` when the name matches `/^.+ × .+$/`), `swap`→`'swap'`+`target`, `character`→`'character'`; a `localStorage` flag `v5_local_presets_migrated = '1'` so it runs once.

- [ ] **Step 1: Test**
```ts
it('migrates every CollectionService kind once and retires the collections key', () => {
  localStorage.setItem('xivdyetools_collections', JSON.stringify({ version: '2.0.0', lastModified: Date.now(), tombstones: [{ id: 'gone', deletedAt: 1 }], collections: [
    { id: 'c1', name: 'Rolanberry Red × Jet Black', kind: 'palette', dyes: [1, 102, 5], createdAt: 1, updatedAt: 1 },
    { id: 'c2', name: 'Jet Black', kind: 'swap', target: 102, dyes: [51], createdAt: 1, updatedAt: 1 },
    { id: 'c3', name: 'Character colours', kind: 'character', dyes: [7, 8], createdAt: 1, updatedAt: 1 },
    { id: 'c4', name: 'Hand made', description: 'd', kind: 'palette', dyes: [9], createdAt: 1, updatedAt: 1 },
  ]}));
  CollectionService.__reloadForTesting(); CollectionService.initialize();
  LocalPresetService.__reloadForTesting(); LocalPresetService.initialize();
  const all = LocalPresetService.getAll();
  expect(all.map(p => [p.name, p.origin.kind, p.origin.target ?? null])).toEqual(expect.arrayContaining([
    ['Rolanberry Red × Jet Black', 'mixer', null], ['Jet Black', 'swap', 102], ['Character colours', 'character', null], ['Hand made', 'authored', null],
  ]));
  expect(all.find(p => p.name === 'Hand made')!.description).toBe('d');
  expect(LocalPresetService.isTombstoned('gone')).toBe(true);
  expect(localStorage.getItem('xivdyetools_collections')).toBeNull();
  // idempotent
  LocalPresetService.__reloadForTesting(); LocalPresetService.initialize();
  expect(LocalPresetService.count()).toBe(4);
});
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `migrateFromCollections()` (guard on the flag; call `CollectionService.__takeCollectionsForMigration()`; map + `create` with `updatedAt/createdAt` copied — add an internal `createRaw(preset)` path that bypasses `Date.now()` for timestamps but keeps validation; records failing validation are logged and skipped, never thrown; tombstone ids carried over verbatim; set the flag; save once). Wire `LocalPresetService.initialize()` at boot after `CollectionService.initialize()`.
- [ ] **Step 4: Run → PASS**; run `collection-service.test.ts` too (must still pass); tsc.
- [ ] **Step 5: Commit** — `feat(web-app): migrate CollectionService palettes/swaps/character sets into local presets`

### Task 4: Rewire the four write sites + Advanced "Clear saved palettes"

**Files:**
- Modify: `apps/web-app/src/components/mixer-tool.ts:1371-1400` (`saveCurrentMix`), `budget-tool.ts:1188-1215` (`saveSwapRecord`), `chara-import.ts:553-590` (`saveCharacterRecord`) and `:1157-1180` (`saveLocalPalette`), `advanced-options-panel.ts:274-290` (clear action → `LocalPresetService.reset()`… **no**: clear = remove all local presets with tombstones? Decision: "Clear saved palettes" removes every local preset via `remove()` so tombstones protect a later import; label copy unchanged)
- Tests: existing `mixer-tool.test.ts` / `budget-tool.test.ts` / `chara-import.test.ts` (find them under `src/components/__tests__/`) — update the assertions that spy on `CollectionService.createCollection` to spy on `LocalPresetService.create` and check the origin.

- [ ] **Step 1: Update tests** — e.g. mixer: `expect(LocalPresetService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rolanberry Red × Jet Black', dyes: [1, 102, 5], origin: { kind: 'mixer' } }))`; budget: `origin: { kind: 'swap', target: 102 }`, `dyes: [<cheapest stainID>]`; chara character: `origin: { kind: 'character' }`; chara palette: name via `LocalPresetService.uniqueName(...)`, `origin: { kind: 'authored' }`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — replace each `createCollection` + `addDyeToCollection` loop with one `LocalPresetService.create({ name, dyes: [...stainIds], origin })`; catch `Error` → `ToastService.error(t('preset.local.saveFailed'))` (key added in Task 8; until then use the existing generic error key the site already uses). Advanced clear: `LocalPresetService.getAll().forEach(p => LocalPresetService.remove(p.id))` and dispatch the existing `palettes-cleared` event.
- [ ] **Step 4: Run the four suites → PASS**; tsc; eslint.
- [ ] **Step 5: Commit** — `refactor(web-app): tools save into LocalPresetService`

### Task 5: Saved tab lists local presets (all origins) with chips; New preset; deep-link

**Files:**
- Modify: `apps/web-app/src/components/v4/preset-tool.ts` (`localPalettes: Collection[]` → `localPresets: LocalPreset[]`, subscribe to `LocalPresetService`, `localPaletteToUnified` → `localPresetToUnified`, `localPalettePool`, `handleDeepLink` `local-` ids, `renderFilters` gets a Saved-only toolbar, `renderEmpty` Saved branch), `v4/preset-card.ts` (new `@property({attribute:false}) local?: { originLabel?: string; published: boolean }` → chips), `services/hybrid-preset-service.ts` (`UnifiedPreset` gains `local?: { id: string; origin: LocalPresetOrigin; publishedId?: number }`)
- Create test: `apps/web-app/src/components/__tests__/v4/preset-tool-saved.test.ts` (mount `<v4-preset-tool>` with `tab='saved'`; mock `hybridPresetService`/network via the existing MSW setup; seed `LocalPresetService`)
- vitest.config.ts: remove `src/components/v4/preset-tool.ts` from `coverage.exclude` (it now has tests).

**Interfaces:**
- Produces: `UnifiedPreset.local`, `PresetCard.local`, `PresetTool.localPresetToUnified(p: LocalPreset): UnifiedPreset` (id `local-<p.id>`, `category: p.category_id ?? 'aesthetics'`, `secondaryCategories`, `exampleLink: p.example_link ?? null`, `isFromAPI: false`, `local: { id: p.id, origin: p.origin, publishedId: p.publishedId }`), `originLabel(origin): string | undefined` (swap → `t.interp('preset.local.originSwap', { dye })`, character → `preset.local.originCharacter`, link → `preset.local.originLink`, imported → `preset.local.originImported`, clone → `preset.local.originClone`; authored/mixer → undefined).

- [ ] **Step 1: Tests**
```ts
it('lists local presets of every origin on the Saved tab with Local + origin chips', async () => {
  LocalPresetService.create({ name: 'Mix', dyes: [1, 2], origin: { kind: 'mixer' } });
  LocalPresetService.create({ name: 'Jet Black', dyes: [51], origin: { kind: 'swap', target: 102 as DyeId } });
  LocalPresetService.create({ name: 'Char', dyes: [7], origin: { kind: 'character' } });
  const tool = await mountPresetTool({ tab: 'saved' });      // helper in this test file: creates <v4-preset-tool>, sets tab, awaits updateComplete
  const cards = tool.shadowRoot!.querySelectorAll('v4-preset-card');
  expect(cards).toHaveLength(3);
  const chips = [...cards].map(c => [...c.shadowRoot!.querySelectorAll('.chip')].map(x => x.textContent!.trim()));
  expect(chips.flat()).toEqual(expect.arrayContaining(['Local', 'Swap for Jet Black', 'Character colours']));
});
it('New preset creates "Untitled preset" and opens the editor', async () => {
  const spy = vi.spyOn(SubmissionForm, 'showPresetSubmissionForm').mockImplementation(() => {});
  const tool = await mountPresetTool({ tab: 'saved' });
  (tool.shadowRoot!.querySelector('[data-testid="saved-new"]') as HTMLButtonElement).click();
  expect(LocalPresetService.getAll()[0].name).toBe('Untitled preset');
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ mode: 'local', localId: LocalPresetService.getAll()[0].id }));
});
it('New preset is disabled at the cap', …);
it('deep link /presets/local-<id> opens the detail for a local preset', …);
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — state `localPresets: LocalPreset[]` fed by `LocalPresetService.subscribe` in `connectedCallback` (unsubscribe in `disconnectedCallback`); `localPresetToUnified`; `localPalettePool` renamed `localPresetPool` (search on name/description); Saved toolbar in `renderFilters` when `this.tab === 'saved'`: `<button data-testid="saved-new" ?disabled=${!LocalPresetService.canCreate()} title=${capHint}>${t('preset.local.newPreset')}</button>` + an Import button (`data-testid="saved-import"`, wired in Task 9); `handleNewPreset()` → `LocalPresetService.create({ name: LocalPresetService.uniqueName(t('preset.local.untitled')), dyes: [dyeService.getAllDyes()[0].stainID] })`?? — **no**: an empty dye list is invalid; create with a placeholder is dishonest. Instead: New preset opens the editor in local mode with `initial: { name: uniqueName(untitled) }` and no record; the record is created on Save (Task 6). Adjust the test accordingly: `expect(spy).toHaveBeenCalledWith(expect.objectContaining({ mode: 'local', initial: { name: 'Untitled preset' } }))` and no record until save. Card chips: in `preset-card.ts` render `.chip--local` "Local" (+ `originLabel` chip, + `Published` chip when `local.published`) in place of the category chip when `data.preset.local` is set; hide the save pill for local records; keep vote pill hidden. `handleDeepLink`: `local-` prefix resolves from `localPresets`.
- [ ] **Step 4: Run → PASS**; also `preset-card.test.ts`; tsc; eslint.
- [ ] **Step 5: Commit** — `feat(web-app): Saved tab lists local presets with origin chips; New preset entry`

### Task 6: Submission form `mode: 'local'` (Save), chip reorder, New/Edit wiring

**Files:**
- Modify: `apps/web-app/src/components/preset-submission-form.ts` (signature → `showPresetSubmissionForm(options: SubmissionFormOptions)` with back-compat overload for `(onSubmit?, initial?)`), `v4/preset-tool.ts` (New → local mode; kebab Edit → local mode with `localId`)
- Test: create `apps/web-app/src/components/__tests__/preset-submission-form-local.test.ts`; extend `preset-tool-saved.test.ts`.

**Interfaces:**
- Produces:
```ts
export interface SubmissionFormOptions {
  mode?: 'community' | 'local';        // default 'community' (existing behaviour, incl. the auth gate)
  onSubmit?: OnSubmitCallback;         // community mode
  onSaved?: (preset: LocalPreset) => void; // local mode
  initial?: SubmissionFormInitial & { description?: string; categories?: CategorySelection; exampleLink?: string };
  localId?: string;                    // local mode: edit this record (prefills from LocalPresetService.get)
  publishFromLocalId?: string;         // community mode: prefill from a local record and set publishedId on success (Task 12)
}
export function showPresetSubmissionForm(options?: SubmissionFormOptions): void;
export function showPresetSubmissionForm(onSubmit?: OnSubmitCallback, initial?: SubmissionFormInitial): void; // legacy overload
```
- Local mode differences: no auth gate; title `preset.local.editorTitleNew|editorTitleEdit`; validation = local rules (`MIN_DYES_LOCAL = 1`, `MAX_DYES_LOCAL = 20`, name ≥ 1, description may be empty, category optional — the category selector shows a "None" option in local mode), tags/preview-picture fields hidden (`previewImage` arrives in unit e); a passive rule strip under the dye counter lists `LocalPresetService.validateForCommunity(draft)` messages (`preset.local.publishHint`); primary button `preset.local.save` → `LocalPresetService.create/update` → `ModalService.dismissTop()` → `ToastService.success(t('preset.local.saved'))` → `onSaved?.(preset)`. Chip reorder: each chip in `updateSelectedDisplay()` gets ▲/▼ buttons (`data-testid="dye-up"/"dye-down"`, disabled at ends) that swap in `state.selectedDyes` and re-render (both modes).

- [ ] **Step 1: Tests** (`preset-submission-form-local.test.ts`, following `preset-submission-form.test.ts`'s `clickSubmit(content)` helper style):
```ts
it('local mode: no auth gate, saves 1 dye with no category, toasts', async () => {
  vi.spyOn(authService, 'isAuthenticated').mockReturnValue(false);
  showPresetSubmissionForm({ mode: 'local', initial: { name: 'Untitled preset' } });
  const content = ModalService.getTop()!.content!;             // or query #modal-root
  (content.querySelector('#preset-name') as HTMLInputElement).value = 'Solo'; dispatch input;
  click first swatch in the dye grid;
  click primary button (text = t('preset.local.save'));
  expect(LocalPresetService.getAll()[0]).toMatchObject({ name: 'Solo', dyes: [expect.any(Number)] });
});
it('local mode: rule strip lists community blockers but does not block Save', …);
it('local mode with localId prefills and updates the same record', …);
it('▲/▼ reorder chips in both modes', …);
it('community mode is unchanged: auth gate + 3–6 dyes + category required', …);
```
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement.** **Step 4: Run new + existing `preset-submission-form.test.ts` → PASS**; tsc; eslint.
- [ ] **Step 5: Commit** — `feat(web-app): submission form local mode (Save), chip reorder`

### Task 7: Card kebab (Edit · Duplicate · Delete) + detail page for local presets

**Files:**
- Modify: `v4/preset-card.ts` (kebab button `data-testid="card-menu"` for local records emitting `preset-menu` `{ preset, action: 'edit'|'duplicate'|'export'|'share'|'publish'|'delete' }` — a small popover built with the card's own styles; only Edit/Duplicate/Delete enabled in this task, others wired in later tasks but rendered disabled with `title` hints), `v4/preset-tool.ts` (`@preset-menu=${this.handleLocalMenu}`: edit → form local mode with `localId`; duplicate → `LocalPresetService.duplicate` + toast; delete → `ModalService.showConfirm({ destructive: true, title: t('preset.local.deleteTitle'), content: t('preset.local.deleteBody'), confirmText: t('preset.local.delete'), onConfirm: () => LocalPresetService.remove(id) })`), `v4/preset-detail.ts` (`@property({attribute:false}) local?: UnifiedPreset['local']`: shows `Swap for {target}` line for swap origin, hides vote/save, shows the same kebab actions via `preset-menu`).
- Test: extend `preset-tool-saved.test.ts` (kebab actions), `preset-card.test.ts` (kebab renders only for local).

- [ ] Steps 1–5 as usual. Commit — `feat(web-app): local preset kebab (edit/duplicate/delete) + detail`

### Task 8: Strings `preset.local.*` ×6 + `validate:i18n`

**Files:** `apps/web-app/src/locales/{en,de,ja,fr,ko,zh}.json`.

Keys (en values; de/ja authored, fr/ko/zh drafted):
`preset.local.chip` "Local", `published` "Published", `originSwap` "Swap for {dye}", `originCharacter` "Character colours", `originLink` "From link", `originImported` "Imported", `originClone` "Copy of {name}", `newPreset` "New preset", `untitled` "Untitled preset", `import` "Import", `capReached` "Your shelf is full (200)", `edit` "Edit", `duplicate` "Duplicate", `exportJson` "Export JSON", `copyLink` "Copy share link", `publish` "Publish to community", `delete` "Delete", `deleteTitle` "Delete this preset?", `deleteBody` "It leaves your shelf. A later import will not bring it back.", `editorTitleNew` "New preset", `editorTitleEdit` "Edit preset", `save` "Save", `saved` "Saved to your shelf", `saveFailed` "Couldn't save this preset", `publishHint` "To publish: {rules}", `categoryNone` "No category", `emptyShelf` "Nothing on your shelf yet — New preset, Import, or Save from Mixer, Budget or Swatch.", `imported` "Imported {n} · skipped {skipped}", `importFailed` "That file isn't an XIV Dye Tools preset", `linkCopied` "Share link copied", `sharedEyebrow` "Shared with you", `saveToShelf` "Save to my shelf", `alreadyOnShelf` "Already on your shelf", `duplicated` "Copied to your shelf", `publishedToast` "Published — it's now in the community gallery", `duplicateToShelf` "Duplicate to my shelf".

- [ ] Add to all six files (keep key order identical); replace the temporary keys used in Tasks 4–7; run `npm run validate:i18n -- --strict` → exit 0; run the touched component tests; commit — `feat(web-app): preset.local strings ×6`.

### Task 9 (unit b): Import on the Saved tab (button + drop) + Export JSON kebab action

**Files:** `v4/preset-tool.ts` (hidden `<input type=file accept=".json">` behind `data-testid="saved-import"`; `dragover/drop` on the Saved grid container; both → `file.text()` → `JSON.parse` → `LocalPresetService.importFile` → toast `preset.local.imported` with counts or `importFailed`), kebab `export` → `downloadJson(slugFilename(name,'xivpreset.json'), LocalPresetService.exportOne(id))`; enable the Export action.
- Test: `preset-tool-saved.test.ts` — import via a `File` in a `DataTransfer` on the drop target; export spies `downloadJson`.
- Commit — `feat(web-app): import/export local presets as .xivpreset.json`.

### Task 10 (unit b): Backup v2 in Advanced Options

**Files:** `advanced-options-panel.ts:292-340`; test `advanced-options-backup.test.ts`.
- Export: `{ version: 2, exportedAt, type: 'xivdyetools-settings', configs: configController.exportAllConfigs(), favorites: CollectionService.getFavorites(), ...LocalPresetService.exportForBackup() }` (`localPresets`, `tombstones`).
- Import: after `type` guard: `configs` → `configController.importConfigs` (unchanged); if `version >= 2`: `favorites` → clear + `addFavorite` each (skip invalid), `localPresets/tombstones` → `LocalPresetService.importFromBackup`; else if `isLegacyCollectionFile(data)` → map `data.data.collections` through the same kind→origin mapper as Task 3 and `importFile`. Per-part try/catch; result toast `config.importSuccess` + counts. Replace the `alert()` failure with `ToastService.error`.
- Tests: v1 file imports configs only; v2 round-trip restores favorites + presets + tombstones; legacy collection file imports; a corrupt `localPresets` part doesn't block configs.
- Commit — `feat(web-app): Backup v2 includes favorites and local presets`.

### Task 11 (unit c): Share-link — `ShareService` presets grammar + Shared-preset landing + Copy link

**Files:** `share-service.ts` (add `PresetShareParams { dyes: number[]; name?: string; cat?: PresetCategory; sec?: PresetCategory[]; desc?: string }`, `ShareParams` union member `{ tool: 'presets'; params: PresetShareParams }`, `validateShareParams` case: `dyes` 1–20 stainIDs (reuse the stainID guard used for comparison), `cat`/`sec` known slugs, `name` ≤ 50, `desc` ≤ 200; `generateTitle` "{name} | XIV Dye Tools" / `generateDescription` "A dye palette shared from XIV Dye Tools"), `v4/preset-tool.ts` (on first connect read `new URLSearchParams(window.location.search)`: if `dyes` present and `RouterService.getSubPath()` empty → `this.sharedPreset = { name, dyes, cat, sec, desc }` and render `<v4-preset-detail .preset=${sharedToUnified} .shared=${true}>` with eyebrow `preset.local.sharedEyebrow` and a **Save to my shelf** button (`origin: {kind:'link'}`; if `findBySignature` hits → disabled `alreadyOnShelf`); kebab `share` → `ShareService.generateUrl({tool:'presets', params})` → `copyToClipboard` → toast `linkCopied`), `v4/preset-detail.ts` (`shared` prop + button + `save-to-shelf` event).
- Tests: `share-service.test.ts` presets grammar (valid, legacy id rejected, unknown cat rejected, url shape `…/presets/?dyes=102%2C51&name=…&v=1` — check whether `addParamsToUrl` joins arrays with `,` and whether the URL encoder leaves `,`), `preset-tool-saved.test.ts` landing + save + already-on-shelf + copy link.
- Commit — `feat(web-app): self-contained preset share links`.

### Task 12 (unit c): og-worker card for shared preset links

**Files:** `apps/og-worker/src/services/svg/presets-shared.ts` (+ test): `generateSharedPresetOG({ dyes: number[]; name?: string; locale; frame }): string` → `generateBandCard({ bands: dyes→{hex, share equal}, toolTag: 'PRESETS', path: '/presets/', deck: name ?? null, frame })` using core `dyeService.getByStainId` (drop unknown ids; if none → return null and let the caller 404 to default); `src/index.ts`: route `GET /og/presets/shared` (query `dyes`, `name`, `lang`, `frame`) → PNG via the same raster helper as `/og/presets/:presetId`; `og-data-generator.ts`: `case 'presets'`: if `searchParams.get('dyes')` parses to ≥1 valid stainID → `imageUrl = withLang(`${base}/presets/shared?dyes=…&name=…`)`, title = name ?? default, description = the shared-deck string; else existing default.
- Tests: `og-data-generator.test.ts` (presets with `dyes` → shared image URL + title; presets without → default), `presets-shared.test.ts` (svg contains the dye hexes; unknown ids dropped; none → null), `index.test.ts` route 200 + 404.
- Commit — `feat(og-worker): 15E band card for shared preset links`.

### Task 13 (unit d): Publish from a local preset + Duplicate to my shelf

**Files:** `preset-submission-form.ts` (`publishFromLocalId`: prefill name/description/dyes/categories/exampleLink from `LocalPresetService.get`; on success `LocalPresetService.setPublishedId(localId, result.preset.id)`; toast `publishedToast`), `v4/preset-tool.ts` (kebab `publish` → if `validateForCommunity` non-empty → toast listing rules and open the local editor; else community form with `publishFromLocalId`; enable the action), community/bookmark card kebab or detail action **Duplicate to my shelf** (`LocalPresetService.create({..., origin: {kind:'clone', sourceId}})` → toast `duplicated`).
- Tests: `preset-submission-form-local.test.ts` publish path (mock `presetSubmissionService.submitPreset` → sets `publishedId`), `preset-tool-saved.test.ts` publish gate + duplicate-to-shelf.
- Commit — `feat(web-app): publish a local preset; duplicate community presets to the shelf`.

### Task 14 (unit e, optional last): Local preview picture

**Files:** `indexeddb-service.ts` (`STORES.PRESET_IMAGES = 'preset_images'`, `DB_VERSION = 3`, upgrade branch), `local-preset-service.ts` (`setPreviewImage(id, blob)`, `getPreviewImageUrl(id)`, `removePreviewImage(id)`; export embeds dataURL when present; import stores it), submission form local mode shows the preview-picture field (reuse `createPreviewImageInput`, size cap `MAX_PREVIEW_IMAGE_BYTES`), card/detail show it (`previewImageUrl` from an object URL, revoked on disconnect).
- Tests: `indexeddb-service.test.ts` store exists at v3; service set/get/remove; export/import round-trip with a tiny PNG dataURL.
- Commit — `feat(web-app): local preset preview pictures`.

### Task 15: Remove the dead 4.x Collection Manager and `CollectionService`'s collections API

**Files:** delete `src/components/collection-manager-modal.ts`, `add-to-collection-menu.ts`; remove the "Manage Collections" button (`dye-selector.ts:513-525`) and the folder button (`dye-grid.ts:286-300`) and their imports; `collection-service.ts`: delete `createCollection/updateCollection/deleteCollection/getCollections/getCollection/getCollectionByName/getCollectionsByKind/deleteCollectionsByKind/addDyeToCollection/removeDyeFromCollection/reorderCollectionDyes/getCollectionsCount/canCreateCollection/getCollectionsContainingDye/exportCollection/importData/subscribeCollections/exportAll` and the `Collection*` types **except** what `__takeCollectionsForMigration` needs to read old data (keep the read-side types private); keep favorites API + 4.x PaletteService migration; `vitest.config.ts` coverage-exclude lines for the deleted files removed.
- Tests: `collection-service.test.ts` / `-branches.test.ts` — delete the collections cases, keep favorites + migration; grep the repo for any remaining `CollectionService.createCollection|getCollections|subscribeCollections` → none. Full web-app suite green.
- Commit — `refactor(web-app): remove the 4.x Collection Manager and CollectionService collections API`.

### Task 16: E2E, docs, version bump, changelog

**Files:** `e2e/collection-manager.spec.ts` (rewrite: Presets → Saved → New preset → fill name, add 2 dyes, reorder, Save → card visible with Local chip → kebab Export (download event) → Import the file (skipped as duplicate toast) → Copy share link → open link in a fresh context → Save to my shelf → Delete with confirm; plus Backup export/import round-trip in Advanced Options), `docs/user-guides/web-app/favorites-collections.md` (→ "Your shelf: favorites and local presets"), `docs/projects/web-app/tools.md` (presets section) + `components.md` (services list, submission form modes), og-worker `CLAUDE.md` route table + `docs/projects/og-worker/overview.md`, `apps/web-app/package.json` `5.1.0`, `apps/web-app/CHANGELOG.md` `## [5.1.0]` + `CHANGELOG-laymans.md` "Web-App Version 5.1.0" entry (parser format!), og-worker changelog bullet, root `CHANGELOG-laymans.md` 5.1.0 entry (strict `## [5.1.0] - date` grammar).
- Run: `pnpm turbo run test type-check lint --filter=xivdyetools-web-app --filter=xivdyetools-og-worker`, `pnpm --filter xivdyetools-web-app exec playwright test e2e/collection-manager.spec.ts`, `npm run validate:i18n -- --strict`.
- Commit — `release(web-app): 5.1.0 — local presets`.

---

## Self-review

- **Spec coverage:** §1 data/service → Tasks 1–3, 15; §2 shelf → 5, 7, 9; §3 editor → 6, 13; §4 share-link → 11–12 (PRESERVED_PARAMS deliberately not used — see Global Constraints); §5 files/backup → 2, 9, 10; §6 units/tests/docs → 5–16; removals → 15; strings → 8; preview picture (e) → 14.
- **Placeholders:** Task 5's "New preset" was corrected in-plan (no placeholder dye; record created on Save). Tasks 7, 9–14 give files, behaviour, tests and commit but abbreviate step scaffolding; each still names the exact functions/events/testids introduced.
- **Type consistency:** `LocalPreset`, `LocalPresetInput`, `LocalPresetOrigin`, `LocalPresetService.*` names match across tasks; `preset-menu` action union `'edit'|'duplicate'|'export'|'share'|'publish'|'delete'` used in 7, 9, 11, 13; `SubmissionFormOptions` fields `mode/onSaved/localId/publishFromLocalId` used in 5, 6, 13; file guards `isLocalPresetFile/isLocalPresetsFile/isLegacyCollectionFile` used in 2, 9, 10.

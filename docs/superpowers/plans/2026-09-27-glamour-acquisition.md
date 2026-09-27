# Glamour Export — Automatic Acquisition Line Implementation Plan

**Status:** approved 2026-09-27 — Native execution. Amended the same day by the Glamour Reader designs: Task 5 attaches the line to every alternate too, and Task 7 is superseded by the [Glamour Reader plan](2026-09-27-glamour-reader.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the Swatch Matcher glamour export's `Acquisition:` line automatically, in the GPOSERS guide's exact wording, from a build-time table the api-worker serves on `POST /v1/chara/resolve`.

**Architecture:** A hand-run build script (`apps/api-worker/scripts/build-acquisition.ts`) pins Teamcraft's data files to one commit, looks up the rest on XIVAPI, and runs three pure stages — collect sources → apply the rules → format the guide's string — for every equippable item, writing `src/chara/data/acquisition.en.json`. The resolver attaches the line to the named item; the web-app copies it into the export. PR 1 is the api-worker half (this branch, off `main`); PR 2 is the web-app half, stacked on PR #206.

**Tech Stack:** TypeScript 5.9 (strict, `verbatimModuleSyntax`), Vitest 5, `tsx` (repo root) for the build script, Cloudflare Workers + Hono (api-worker), Vite + Lit (web-app).

**Spec:** [`docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md`](../specs/2026-09-27-glamour-acquisition-design.md) · research: [`docs/research/2026-09-27-glamour-acquisition/`](../../research/2026-09-27-glamour-acquisition/README.md)

## Global Constraints

- Lines are **English only** and use the guide's exact strings: `Crafted (WVR Lvl. 92)`, `Name - Zone - Outpost (1,500 Trophy Crystals)`, `Scrip Exchange - Old Gridania (250 White Gatherers' Scrips)`, `(Main Story Quest)` / `(Sidequest)`, `Name - Zone (FATE)`, `Name (Achievement)`, `Airship Voyages` / `Subaquatic Voyages`, `Moogle Treasure Trove`, `Desynthesis (CLS) - Source Item`, `FFXIV Online Store`, and the nine saga names verbatim (`Zodiac Weapons Saga`, `Anima Weapons Saga`, `Eureka Gear & Weapons`, `Resistance Gear & Weapons`, `Manderville Weapons Saga`, `Phantom Gear & Weapons`, `Skysteel Tools Saga`, `Splendorous Tools Saga`, `Cosmic Tools Saga`). Several routes join with `" / "` in the guide's order.
- **Blank beats wrong** (spec Goal 2): when any part of a line lacks its data, write no line at all; the worker omits the field and the export keeps its blank label.
- **No request-time acquisition work:** the worker only reads the bundled table; Teamcraft, Garland Tools and XIVAPI are touched by the build script alone.
- User rules (2026-09-27): Savage gear lists only its encounters (never books); random containers only when they are the only source; several NPCs → Gridania first, else the lowest-level reachable zone; scrip exchanges are always `Scrip Exchange - Old Gridania`.
- TypeScript: relative imports carry `.js` (bundler resolution, as `src/` does); type-only imports use `import type`.
- Export only what another module uses: knip treats every `apps/api-worker/scripts/**` file as an entry with `includeEntryExports`, and `pnpm dead-code:check` flags exports only tests reach. Test helpers live under `apps/api-worker/tests/`, which both treat as test code.
- Single test file: `pnpm --filter xivdyetools-api-worker exec vitest run <file> --coverage.enabled=false` (without the flag a green subset exits 1 on coverage thresholds).
- Commits: in the worktree only, `git commit --only -- <paths>`, message `<type>(<scope>): <claim>` ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push `main`, never merge locally.
- American English in comments and docs.

## Review Focus

The inputs most likely to surprise a player that the spec implies but no rule test would catch unprompted — each is pinned by a test in the task named:

1. **A family's named item has no line although an alternate does** — each twin carries its own line and never borrows another's (spec D3, amended: the Glamour Reader writes the picked twin's line). Test: Task 5, `pickItem` "gives each twin its own line, never a sibling's".
2. **The same price at two shops in different towns** — one vendor segment, choosing the preferred NPC across both shops. Test: Task 2, "one segment per price".
3. **A single unit of a currency** — "(1 Wolf Mark)", singular. Test: Task 1, "writes a free vendor without parentheses and a single unit in the singular".
4. **Duty names stored with a lowercase "the"** ("the Thousand Maws of Toto-Rak") — must read as the Duty Finder shows them. Test: Task 3, "capitalizes duty names".
5. **A vendor in a zone new this patch** (no FATE data yet, so no level) — still listed, ranked after known zones. Test: Task 2, "ranks a zone with no known level after every known zone".

---

## File Structure

**PR 1 — api-worker** (branch `feat/glamour-acquisition`, worktree `.claude/worktrees/glamour-acquisition`):

| File | Responsibility |
|---|---|
| `apps/api-worker/scripts/acquisition/model.ts` | Shared types: `Inputs`, `Tables`, `Source`, `Entry`, `Npc`, `Shop`, `Offer`, `Cost`, `ItemInfo`, `QuestKind` |
| `apps/api-worker/scripts/acquisition/format.ts` | Stage 3: `formatEntries()` → the guide's string; `pluralOf()` |
| `apps/api-worker/scripts/acquisition/sources.ts` | Stage 1: `collectSources()` — every raw route for one item |
| `apps/api-worker/scripts/acquisition/select.ts` | Stage 2: `selectEntries()` — the rules (D5–D12, "only if" clauses, vendor choice) |
| `apps/api-worker/scripts/acquisition/labels.ts` | `markerCoordinate()`, `nearestLabel()` — outposts from map labels |
| `apps/api-worker/scripts/acquisition/inputs.ts` | Stage 0: `buildInputs()`, `fateZoneLevels()`, `tablesFrom()` — raw files + XIVAPI → `Inputs` / `Tables`; relic membership; zone levels |
| `apps/api-worker/scripts/acquisition/tables/*.json` | Hand-kept, reviewed: `gacha-containers`, `relic-sagas`, `eureka-lockboxes`, `ishgard-districts` |
| `apps/api-worker/scripts/build-acquisition.ts` | I/O only: pin Teamcraft, fetch, XIVAPI lookups, run the stages, write table + meta, spot checks, review report, `--fixture` |
| `apps/api-worker/src/chara/data/acquisition.en.json` / `.meta.json` | Generated table and its provenance |
| `apps/api-worker/src/chara/acquisition.ts` | `acquisitionFor(itemId)` over the bundled table |
| `apps/api-worker/src/chara/resolver.ts`, `types.ts` | `pickItem()` attaches `acquisition`; `ResolvedCharaItem.acquisition?` |
| `apps/api-worker/tests/acquisition/*` | Stage tests, helpers, acceptance test + fixture |

**PR 2 — web-app** (branch `feat/glamour-acquisition-web`, stacked on `claude/zen-dijkstra-llw78l` until #206 merges):

| File | Responsibility |
|---|---|
| `apps/web-app/src/services/chara-resolve-service.ts` | `CharaResolvedItem.acquisition?` |
| `apps/web-app/src/shared/glamour-markdown.ts` | `GlamourMarkdownPiece.acquisition`; the line's value |
| `apps/web-app/src/components/glamour-list-actions.ts` | `glamourMarkdownInput()` copies the resolved line |

---

### Task 1: Types, test helpers and the formatter

**Files:**
- Modify: `apps/api-worker/tsconfig.json` (the `include` array)
- Create: `apps/api-worker/scripts/acquisition/model.ts`
- Create: `apps/api-worker/scripts/acquisition/format.ts`
- Create: `apps/api-worker/tests/acquisition/helpers.ts`
- Test: `apps/api-worker/tests/acquisition/format.test.ts`

**Interfaces:**
- Produces: every type in `model.ts` (exact definitions below); `formatEntries(entries: Entry[], inputs: Inputs, tables: Tables): string | null`; `pluralOf(name: string, gamePlural: string): string`; test helpers `emptyInputs(): Inputs`, `emptyTables(): Tables`, `npc(id, name, zone, extra?): Npc`.

- [ ] **Step 1: Let `tsc` see the scripts**

In `apps/api-worker/tsconfig.json` change the include line to:

```json
  "include": ["src/**/*.ts", "tests/**/*.ts", "scripts/**/*.ts"],
```

(`@types/node` is already in `types`, so the build script's `node:fs` imports type-check.)

- [ ] **Step 2: Write the types**

Create `apps/api-worker/scripts/acquisition/model.ts`:

```ts
/**
 * Shapes shared by the acquisition build (`scripts/build-acquisition.ts`).
 * `Inputs` is everything the pure stages read, already normalized by
 * `inputs.ts` from Teamcraft's data files and XIVAPI — the stages never see a
 * raw file, so they test without the network.
 */

export interface Npc {
  id: number;
  /** English name as the game stores it ("independent merchant", "Enie"); `format.ts` title-cases it. */
  name: string;
  /** Place name of the NPC's map ("Urqopacha", "Old Gridania", "The Firmament"); null = position unknown. */
  zone: string | null;
  /** Nearest map area label, wilderness NPCs only ("Worlar's Echo"). */
  outpost: string | null;
  /** Stands in a duty or housing map. */
  unreachable: boolean;
}

export interface Cost {
  itemId: number;
  amount: number;
}

export interface Shop {
  id: number;
  /** English shop name ("Repurchase Monk Gear", "Phantom Weapons Penumbrae"); "" when unnamed. */
  name: string;
  npcIds: number[];
  /** Opens only during a seasonal event (XIVAPI `SpecialShop.RequiredFestival` ≠ 0). */
  festival: boolean;
}

export interface Offer {
  shop: Shop;
  /** What one unit costs; empty = free. */
  costs: Cost[];
}

export type QuestKind = 'msq' | 'side' | 'event';

export interface ItemInfo {
  /** Title-case name ("Trophy Crystal") */
  name: string;
  /** Title-case plural from `pluralOf` ("Trophy Crystals") */
  plural: string;
  /** ItemUICategory row: 63 "Other" and 100 "Currency" hold general currencies; raid tokens are 61 "Miscellany" */
  uiCategory: number;
}

export interface Inputs {
  /** Every item a line may mention: costs, containers, desynthesis sources. */
  items: Map<number, ItemInfo>;
  /** item → recipes (`job` 8–15 = CRP…CUL) */
  recipes: Map<number, Array<{ job: number; level: number }>>;
  /** item → every shop offer that sells it */
  offers: Map<number, Offer[]>;
  npcs: Map<number, Npc>;
  /** zone → the level players reach it at (spec D9) */
  zoneLevels: Map<string, number>;
  /** duty (Teamcraft instance id) → Duty Finder name */
  dutyNames: Map<number, string>;
  /** item → duties it drops in (items, coffers and tokens alike) */
  duties: Map<number, number[]>;
  /** item → container items it comes out of */
  containers: Map<number, number[]>;
  /** Mog Station products */
  onlineStore: Set<number>;
  /** item → quests that reward it */
  quests: Map<number, number[]>;
  questInfo: Map<number, { name: string; kind: QuestKind }>;
  /** item → names of achievements that reward it */
  achievements: Map<number, string[]>;
  fates: Map<number, Array<{ name: string; zone: string }>>;
  voyages: Map<number, Array<'airship' | 'submarine'>>;
  /** item → items it is desynthesized from, with the desynthesis class */
  desynth: Map<number, Array<{ sourceItemId: number; job: number }>>;
  /** relic item → the guide's saga line (spec D11) */
  relics: Map<number, string>;
}

export interface Tables {
  /** Reviewed random containers: listed only when they are an item's only source. */
  gachaContainers: Set<number>;
  /** Eureka lockbox item → "Eureka <Zone> Lockboxes" (always treated as random). */
  eurekaLockboxes: Map<number, string>;
  /** Districts written "Ishgard - <district>". */
  ishgardDistricts: Set<string>;
}

/** A raw route to an item, before any rule. */
export type Source =
  | { kind: 'relic'; saga: string }
  | { kind: 'duty'; dutyId: number }
  | { kind: 'quest'; questId: number }
  | { kind: 'fate'; name: string; zone: string }
  | { kind: 'achievement'; name: string }
  | { kind: 'craft'; job: number; level: number }
  | { kind: 'offer'; offer: Offer }
  | { kind: 'container'; containerId: number }
  | { kind: 'voyage'; voyage: 'airship' | 'submarine' }
  | { kind: 'desynth'; sourceItemId: number; job: number }
  | { kind: 'onlineStore' };

/** A route that survived the rules, ready to format. */
export type Entry =
  | { kind: 'relic'; saga: string }
  | { kind: 'duty'; dutyId: number }
  | { kind: 'quest'; questId: number }
  | { kind: 'fate'; name: string; zone: string }
  | { kind: 'achievement'; name: string }
  | { kind: 'craft'; job: number; level: number }
  | { kind: 'scrip'; cost: Cost }
  | { kind: 'vendor'; npc: Npc; costs: Cost[] }
  | { kind: 'eurekaLockbox'; line: string }
  | { kind: 'container'; containerId: number }
  | { kind: 'voyage'; voyage: 'airship' | 'submarine' }
  | { kind: 'treasureTrove' }
  | { kind: 'desynth'; sourceItemId: number; job: number }
  | { kind: 'onlineStore' };
```

- [ ] **Step 3: Write the test helpers**

Create `apps/api-worker/tests/acquisition/helpers.ts`:

```ts
/** Builders for the acquisition stage tests: empty inputs and tables to fill per case. */

import type { Inputs, Npc, Tables } from '../../scripts/acquisition/model.js';

export function emptyInputs(): Inputs {
  return {
    items: new Map(),
    recipes: new Map(),
    offers: new Map(),
    npcs: new Map(),
    zoneLevels: new Map(),
    dutyNames: new Map(),
    duties: new Map(),
    containers: new Map(),
    onlineStore: new Set(),
    quests: new Map(),
    questInfo: new Map(),
    achievements: new Map(),
    fates: new Map(),
    voyages: new Map(),
    desynth: new Map(),
    relics: new Map(),
  };
}

export function emptyTables(): Tables {
  return {
    gachaContainers: new Set(),
    eurekaLockboxes: new Map(),
    ishgardDistricts: new Set(['Foundation', 'The Pillars', 'The Firmament']),
  };
}

export function npc(id: number, name: string, zone: string | null, extra: Partial<Npc> = {}): Npc {
  return { id, name, zone, outpost: null, unreachable: false, ...extra };
}
```

- [ ] **Step 4: Write the failing formatter tests**

Create `apps/api-worker/tests/acquisition/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatEntries, pluralOf } from '../../scripts/acquisition/format.js';
import type { Entry, Inputs } from '../../scripts/acquisition/model.js';
import { emptyInputs, emptyTables, npc } from './helpers.js';

function inputs(): Inputs {
  const i = emptyInputs();
  i.items.set(25, { name: 'Wolf Mark', plural: 'Wolf Marks', uiCategory: 63 });
  i.items.set(28063, { name: "Skybuilders' Scrip", plural: "Skybuilders' Scrips", uiCategory: 100 });
  i.items.set(33913, { name: "Purple Crafters' Scrip", plural: "Purple Crafters' Scrips", uiCategory: 100 });
  i.items.set(36656, { name: 'Trophy Crystal', plural: 'Trophy Crystals', uiCategory: 100 });
  i.items.set(33441, { name: 'Fête Present', plural: 'Fête Presents', uiCategory: 61 });
  i.items.set(40000, { name: 'Base Coat', plural: 'Base Coats', uiCategory: 35 });
  i.items.set(40001, { name: 'Twine', plural: 'Twines', uiCategory: 61 });
  i.items.set(5000, { name: 'Linen Robe', plural: 'Linen Robes', uiCategory: 35 });
  i.dutyNames.set(30100, "Eden's Promise: Litany (Savage)");
  i.dutyNames.set(30102, "Eden's Promise: Anamorphosis (Savage)");
  i.questInfo.set(1, { name: 'Close to Home', kind: 'msq' });
  i.questInfo.set(2, { name: 'A Custom Delivery', kind: 'side' });
  return i;
}

const line = (entries: Entry[]): string | null => formatEntries(entries, inputs(), emptyTables());

describe('formatEntries', () => {
  it('writes the guide string for each kind of route', () => {
    expect(line([{ kind: 'duty', dutyId: 30100 }])).toBe("Eden's Promise: Litany (Savage)");
    expect(line([{ kind: 'quest', questId: 1 }])).toBe('Close to Home (Main Story Quest)');
    expect(line([{ kind: 'quest', questId: 2 }])).toBe('A Custom Delivery (Sidequest)');
    expect(line([{ kind: 'fate', name: 'He Taketh It with His Eyes', zone: 'Coerthas Western Highlands' }])).toBe(
      'He Taketh It with His Eyes - Coerthas Western Highlands (FATE)'
    );
    expect(line([{ kind: 'achievement', name: 'Let the Bodies Hit the Floor' }])).toBe('Let the Bodies Hit the Floor (Achievement)');
    expect(line([{ kind: 'craft', job: 13, level: 92 }])).toBe('Crafted (WVR Lvl. 92)');
    expect(line([{ kind: 'scrip', cost: { itemId: 33913, amount: 250 } }])).toBe(
      "Scrip Exchange - Old Gridania (250 Purple Crafters' Scrips)"
    );
    expect(line([{ kind: 'relic', saga: 'Phantom Gear & Weapons' }])).toBe('Phantom Gear & Weapons');
    expect(line([{ kind: 'eurekaLockbox', line: 'Eureka Anemos Lockboxes' }])).toBe('Eureka Anemos Lockboxes');
    expect(line([{ kind: 'container', containerId: 33441 }])).toBe('Fête Present');
    expect(line([{ kind: 'voyage', voyage: 'airship' }])).toBe('Airship Voyages');
    expect(line([{ kind: 'voyage', voyage: 'submarine' }])).toBe('Subaquatic Voyages');
    expect(line([{ kind: 'treasureTrove' }])).toBe('Moogle Treasure Trove');
    expect(line([{ kind: 'desynth', sourceItemId: 5000, job: 13 }])).toBe('Desynthesis (WVR) - Linen Robe');
    expect(line([{ kind: 'onlineStore' }])).toBe('FFXIV Online Store');
  });

  it('writes a vendor as Name - Zone (cost), title-casing generic NPC names', () => {
    expect(
      line([{ kind: 'vendor', npc: npc(1, 'crystal quartermaster', "Wolves' Den Pier"), costs: [{ itemId: 36656, amount: 1500 }] }])
    ).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
    expect(
      line([
        {
          kind: 'vendor',
          npc: npc(2, 'independent merchant', 'Urqopacha', { outpost: "Worlar's Echo" }),
          costs: [{ itemId: 1, amount: 28483 }],
        },
      ])
    ).toBe("Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil)");
  });

  it('prefixes Ishgard districts', () => {
    expect(line([{ kind: 'vendor', npc: npc(3, 'Enie', 'The Firmament'), costs: [{ itemId: 28063, amount: 1200 }] }])).toBe(
      "Enie - Ishgard - The Firmament (1,200 Skybuilders' Scrips)"
    );
  });

  it('writes a free vendor without parentheses and a single unit in the singular', () => {
    expect(line([{ kind: 'vendor', npc: npc(4, 'Varsarudh', 'Old Sharlayan'), costs: [] }])).toBe('Varsarudh - Old Sharlayan');
    expect(line([{ kind: 'vendor', npc: npc(5, 'mark quartermaster', "Wolves' Den Pier"), costs: [{ itemId: 25, amount: 1 }] }])).toBe(
      "Mark Quartermaster - Wolves' Den Pier (1 Wolf Mark)"
    );
  });

  it('writes an upgrade as its items, counting only what takes more than one', () => {
    expect(
      line([
        {
          kind: 'vendor',
          npc: npc(6, 'Djole', 'Radz-at-Han'),
          costs: [
            { itemId: 40000, amount: 1 },
            { itemId: 40001, amount: 2 },
          ],
        },
      ])
    ).toBe('Djole - Radz-at-Han (Base Coat, 2 Twines)');
  });

  it('joins routes with " / " in the guide order and drops duplicates', () => {
    expect(
      line([
        { kind: 'onlineStore' },
        {
          kind: 'vendor',
          npc: npc(2, 'independent merchant', 'Urqopacha', { outpost: "Worlar's Echo" }),
          costs: [{ itemId: 1, amount: 28483 }],
        },
        { kind: 'craft', job: 13, level: 92 },
        { kind: 'duty', dutyId: 30100 },
        { kind: 'duty', dutyId: 30102 },
        { kind: 'onlineStore' },
      ])
    ).toBe(
      "Eden's Promise: Litany (Savage) / Eden's Promise: Anamorphosis (Savage) / Crafted (WVR Lvl. 92) / " +
        "Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil) / FFXIV Online Store"
    );
  });

  it('writes nothing rather than part of a line when a route lacks its data', () => {
    expect(line([{ kind: 'craft', job: 13, level: 92 }, { kind: 'duty', dutyId: 99999 }])).toBeNull();
    expect(line([{ kind: 'vendor', npc: npc(7, 'merchant', 'Limsa Lominsa Lower Decks'), costs: [{ itemId: 99999, amount: 3 }] }])).toBeNull();
    expect(line([{ kind: 'craft', job: 99, level: 1 }])).toBeNull();
    expect(line([])).toBeNull();
  });
});

describe('pluralOf', () => {
  it('pluralizes the word the game pluralized, keeping the title-case name', () => {
    expect(pluralOf('Trophy Crystal', 'Trophy Crystals')).toBe('Trophy Crystals');
    expect(pluralOf("Skybuilders' Scrip", "skybuilders' scrips")).toBe("Skybuilders' Scrips");
    expect(pluralOf('Allagan Tomestone of Poetics', 'Allagan tomestones of poetics')).toBe('Allagan Tomestones of Poetics');
  });

  it('keeps the name when the game plural is a measure phrase', () => {
    expect(pluralOf('Book of Litany', 'copies of the Book of Litany')).toBe('Book of Litany');
    expect(pluralOf('Arcanite', 'chunks of arcanite')).toBe('Arcanite');
    expect(pluralOf('Gil', 'gil')).toBe('Gil');
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/format.test.ts --coverage.enabled=false`
Expected: FAIL — `Failed to resolve import "../../scripts/acquisition/format.js"`.

- [ ] **Step 6: Write the formatter**

Create `apps/api-worker/scripts/acquisition/format.ts`:

```ts
/**
 * Stage 3 of the acquisition build: the entries that survived `select.ts`,
 * in the GPOSERS guide's wording ("Obtained Order & Format Reference",
 * October 2025). One line per item; several routes join with " / " in the
 * guide's order. An entry whose data is missing voids the whole line — a
 * partial line would read as complete (spec Goal 2).
 */

import type { Cost, Entry, Inputs, Npc, Tables } from './model.js';

const JOBS: Record<number, string> = { 8: 'CRP', 9: 'BSM', 10: 'ARM', 11: 'GSM', 12: 'LTW', 13: 'WVR', 14: 'ALC', 15: 'CUL' };

/** The guide's order. */
const ORDER: ReadonlyArray<Entry['kind']> = [
  'duty',
  'quest',
  'fate',
  'achievement',
  'craft',
  'scrip',
  'vendor',
  'relic',
  'eurekaLockbox',
  'container',
  'voyage',
  'treasureTrove',
  'desynth',
  'onlineStore',
];

const MINOR_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to']);

const GIL = 1;

export function formatEntries(entries: Entry[], inputs: Inputs, tables: Tables): string | null {
  const ordered = [...entries].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const parts: string[] = [];
  for (const entry of ordered) {
    const text = formatEntry(entry, inputs, tables);
    if (text === null) return null;
    if (!parts.includes(text)) parts.push(text);
  }
  return parts.length > 0 ? parts.join(' / ') : null;
}

/**
 * Title-case plural for a cost item. The game's `Plural` is inconsistently
 * cased ("Trophy Crystals" but "skybuilders' scrips") and for some items a
 * measure phrase ("copies of the Book of Litany"), so this pluralizes the word
 * of the title-case `name` that the game pluralized ("s" or "es" appended) and
 * keeps `name` when no single word matches.
 */
export function pluralOf(name: string, gamePlural: string): string {
  const words = name.split(' ');
  const target = gamePlural.toLowerCase();
  for (let i = words.length - 1; i >= 0; i--) {
    for (const suffix of ['s', 'es']) {
      const candidate = words.map((word, j) => (j === i ? word + suffix : word)).join(' ');
      if (candidate.toLowerCase() === target) return candidate;
    }
  }
  return name;
}

function formatEntry(entry: Entry, inputs: Inputs, tables: Tables): string | null {
  switch (entry.kind) {
    case 'duty':
      return inputs.dutyNames.get(entry.dutyId) ?? null;
    case 'quest': {
      const quest = inputs.questInfo.get(entry.questId);
      if (!quest) return null;
      return `${quest.name} (${quest.kind === 'msq' ? 'Main Story Quest' : 'Sidequest'})`;
    }
    case 'fate':
      return `${entry.name} - ${entry.zone} (FATE)`;
    case 'achievement':
      return `${entry.name} (Achievement)`;
    case 'craft': {
      const job = JOBS[entry.job];
      return job ? `Crafted (${job} Lvl. ${entry.level})` : null;
    }
    case 'scrip': {
      const cost = costText([entry.cost], inputs);
      return cost === null ? null : `Scrip Exchange - Old Gridania (${cost})`;
    }
    case 'vendor':
      return vendorText(entry.npc, entry.costs, inputs, tables);
    case 'relic':
      return entry.saga;
    case 'eurekaLockbox':
      return entry.line;
    case 'container':
      return inputs.items.get(entry.containerId)?.name ?? null;
    case 'voyage':
      return entry.voyage === 'airship' ? 'Airship Voyages' : 'Subaquatic Voyages';
    case 'treasureTrove':
      return 'Moogle Treasure Trove';
    case 'desynth': {
      const job = JOBS[entry.job];
      const source = inputs.items.get(entry.sourceItemId)?.name;
      return job && source ? `Desynthesis (${job}) - ${source}` : null;
    }
    case 'onlineStore':
      return 'FFXIV Online Store';
  }
}

function vendorText(npc: Npc, costs: Cost[], inputs: Inputs, tables: Tables): string | null {
  if (npc.zone === null) return null;
  const place = tables.ishgardDistricts.has(npc.zone) ? `Ishgard - ${npc.zone}` : npc.zone;
  const outpost = npc.outpost ? ` - ${npc.outpost}` : '';
  const head = `${titleCase(npc.name)} - ${place}${outpost}`;
  if (costs.length === 0) return head;
  const cost = costText(costs, inputs);
  return cost === null ? null : `${head} (${cost})`;
}

/** "28,483 Gil", "1,500 Trophy Crystals", "1 Wolf Mark"; an upgrade lists its items: "Base Coat, 2 Twines". */
function costText(costs: Cost[], inputs: Inputs): string | null {
  const parts: string[] = [];
  for (const { itemId, amount } of costs) {
    if (itemId === GIL) {
      parts.push(`${count(amount)} Gil`);
      continue;
    }
    const item = inputs.items.get(itemId);
    if (!item) return null;
    if (amount === 1) parts.push(costs.length > 1 ? item.name : `1 ${item.name}`);
    else parts.push(`${count(amount)} ${item.plural}`);
  }
  return parts.join(', ');
}

function count(amount: number): string {
  return amount.toLocaleString('en-US');
}

function titleCase(name: string): string {
  return name
    .split(' ')
    .map((word, i) => (i > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/format.test.ts --coverage.enabled=false`
Expected: PASS (9 tests).

- [ ] **Step 8: Type-check**

Run: `pnpm --filter xivdyetools-api-worker run type-check`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/api-worker/tsconfig.json apps/api-worker/scripts/acquisition/model.ts apps/api-worker/scripts/acquisition/format.ts apps/api-worker/tests/acquisition/helpers.ts apps/api-worker/tests/acquisition/format.test.ts
git commit --only -m "feat(api-worker): GPOSERS acquisition formatter" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/api-worker/tsconfig.json apps/api-worker/scripts/acquisition/model.ts apps/api-worker/scripts/acquisition/format.ts apps/api-worker/tests/acquisition/helpers.ts apps/api-worker/tests/acquisition/format.test.ts
```

---

### Task 2: Sources and the selection rules

**Files:**
- Create: `apps/api-worker/scripts/acquisition/sources.ts`
- Create: `apps/api-worker/scripts/acquisition/select.ts`
- Test: `apps/api-worker/tests/acquisition/select.test.ts`

**Interfaces:**
- Consumes: `model.ts` types; `emptyInputs`, `emptyTables`, `npc` (Task 1).
- Produces: `collectSources(itemId: number, inputs: Inputs): Source[]`; `selectEntries(sources: Source[], inputs: Inputs, tables: Tables): Selection` where `interface Selection { entries: Entry[]; dropped: string[] }` (`dropped` holds rule names: `seasonalQuest`, `repurchaseShop`, `seasonalShop`, `vendorWithoutPosition`, `questNotOnlySource`, `gachaNotOnlySource`).

- [ ] **Step 1: Write the failing tests**

Create `apps/api-worker/tests/acquisition/select.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Cost, Entry, Inputs, Offer, Shop, Tables } from '../../scripts/acquisition/model.js';
import { selectEntries, type Selection } from '../../scripts/acquisition/select.js';
import { collectSources } from '../../scripts/acquisition/sources.js';
import { emptyInputs, emptyTables, npc } from './helpers.js';

const ITEM = 100;

function shop(id: number, npcIds: number[], extra: Partial<Shop> = {}): Shop {
  return { id, name: '', npcIds, festival: false, ...extra };
}

function offer(s: Shop, costs: Cost[]): Offer {
  return { shop: s, costs };
}

function select(inputs: Inputs, tables: Tables = emptyTables()): Selection {
  return selectEntries(collectSources(ITEM, inputs), inputs, tables);
}

const kinds = (entries: Entry[]): string[] => entries.map((e) => e.kind);

describe('selectEntries', () => {
  it('a relic shows only its saga, whatever else sells it', () => {
    const i = emptyInputs();
    i.relics.set(ITEM, 'Phantom Gear & Weapons');
    i.offers.set(ITEM, [offer(shop(1770926, [1053905]), [{ itemId: 47750, amount: 3 }])]);
    i.npcs.set(1053905, npc(1053905, 'Dodokkuli', 'Phantom Village'));
    expect(select(i).entries).toEqual([{ kind: 'relic', saga: 'Phantom Gear & Weapons' }]);
  });

  it('Savage gear lists the encounters where the piece, its coffer or its token drops — never the book exchange', () => {
    const i = emptyInputs();
    i.items.set(32141, { name: 'Book of Litany', plural: 'Book of Litany', uiCategory: 61 });
    i.duties.set(32141, [30100]);
    i.duties.set(32147, [30100, 30102]);
    i.containers.set(ITEM, [32147]);
    i.offers.set(ITEM, [offer(shop(1770331, [1030123]), [{ itemId: 32141, amount: 6 }])]);
    i.npcs.set(1030123, npc(1030123, 'Ghul Gul', 'Amh Araeng'));
    expect(select(i).entries).toEqual([
      { kind: 'duty', dutyId: 30100 },
      { kind: 'duty', dutyId: 30102 },
    ]);
  });

  it('an upgrade that also takes a base item keeps the vendor line', () => {
    const i = emptyInputs();
    i.items.set(40000, { name: 'Base Coat', plural: 'Base Coats', uiCategory: 35 });
    i.items.set(40001, { name: 'Twine', plural: 'Twines', uiCategory: 61 });
    i.duties.set(40001, [30100]);
    i.offers.set(ITEM, [offer(shop(1, [10]), [{ itemId: 40000, amount: 1 }, { itemId: 40001, amount: 1 }])]);
    i.npcs.set(10, npc(10, 'Djole', 'Radz-at-Han'));
    expect(kinds(select(i).entries)).toEqual(['vendor']);
  });

  it('a general currency is never a duty token, even when duties reward it', () => {
    const i = emptyInputs();
    i.items.set(28, { name: 'Allagan Tomestone of Poetics', plural: 'Allagan Tomestones of Poetics', uiCategory: 63 });
    i.duties.set(28, [1, 2, 3]);
    i.offers.set(ITEM, [offer(shop(1, [10]), [{ itemId: 28, amount: 495 }])]);
    i.npcs.set(10, npc(10, 'Auriana', 'Mor Dhona'));
    expect(kinds(select(i).entries)).toEqual(['vendor']);
  });

  it('ignores repurchase shops and seasonal-event shops', () => {
    const i = emptyInputs();
    i.offers.set(ITEM, [
      offer(shop(262680, [1006004], { name: 'Repurchase Monk Gear' }), [{ itemId: 1, amount: 2000 }]),
      offer(shop(1769999, [20], { festival: true }), [{ itemId: 5, amount: 1 }]),
    ]);
    i.npcs.set(1006004, npc(1006004, 'Calamity salvager', 'Limsa Lominsa Lower Decks'));
    i.npcs.set(20, npc(20, 'event vendor', 'New Gridania'));
    const result = select(i);
    expect(result.entries).toEqual([]);
    expect(result.dropped).toEqual(['repurchaseShop', 'seasonalShop']);
  });

  it("turns a crafters'/gatherers' scrip offer into the scrip exchange and irregular tomestones into the Moogle Treasure Trove", () => {
    const i = emptyInputs();
    i.items.set(33913, { name: "Purple Crafters' Scrip", plural: "Purple Crafters' Scrips", uiCategory: 100 });
    i.items.set(45000, { name: 'Irregular Tomestone of Heliometry', plural: 'Irregular Tomestones of Heliometry', uiCategory: 100 });
    i.offers.set(ITEM, [
      offer(shop(1, [10]), [{ itemId: 33913, amount: 250 }]),
      offer(shop(2, [11]), [{ itemId: 45000, amount: 4 }]),
    ]);
    expect(select(i).entries).toEqual([{ kind: 'scrip', cost: { itemId: 33913, amount: 250 } }, { kind: 'treasureTrove' }]);
  });

  it('a random container appears only when it is the only source', () => {
    const tables = emptyTables();
    tables.gachaContainers.add(33441);
    const alone = emptyInputs();
    alone.containers.set(ITEM, [33441]);
    expect(select(alone, tables).entries).toEqual([{ kind: 'container', containerId: 33441 }]);

    const withVendor = emptyInputs();
    withVendor.containers.set(ITEM, [33441]);
    withVendor.offers.set(ITEM, [offer(shop(1770281, [1031680]), [{ itemId: 28063, amount: 1200 }])]);
    withVendor.npcs.set(1031680, npc(1031680, 'Enie', 'The Firmament'));
    const result = select(withVendor, tables);
    expect(kinds(result.entries)).toEqual(['vendor']);
    expect(result.dropped).toContain('gachaNotOnlySource');
  });

  it('a Eureka lockbox writes the guide line when it is the only source', () => {
    const tables = emptyTables();
    tables.eurekaLockboxes.set(22508, 'Eureka Anemos Lockboxes');
    const i = emptyInputs();
    i.containers.set(ITEM, [22508]);
    expect(select(i, tables).entries).toEqual([{ kind: 'eurekaLockbox', line: 'Eureka Anemos Lockboxes' }]);
  });

  it('a quest appears only when it is the only source, and a seasonal quest never', () => {
    const only = emptyInputs();
    only.quests.set(ITEM, [1]);
    only.questInfo.set(1, { name: 'Close to Home', kind: 'msq' });
    expect(select(only).entries).toEqual([{ kind: 'quest', questId: 1 }]);

    const withCraft = emptyInputs();
    withCraft.quests.set(ITEM, [1]);
    withCraft.questInfo.set(1, { name: 'Close to Home', kind: 'msq' });
    withCraft.recipes.set(ITEM, [{ job: 13, level: 50 }]);
    const crafted = select(withCraft);
    expect(crafted.entries).toEqual([{ kind: 'craft', job: 13, level: 50 }]);
    expect(crafted.dropped).toEqual(['questNotOnlySource']);

    const seasonal = emptyInputs();
    seasonal.quests.set(ITEM, [2]);
    seasonal.questInfo.set(2, { name: 'Blue Starlight', kind: 'event' });
    const result = select(seasonal);
    expect(result.entries).toEqual([]);
    expect(result.dropped).toEqual(['seasonalQuest']);
  });

  it('a fixed coffer takes its own source: store product, quest reward, or its own name', () => {
    const store = emptyInputs();
    store.containers.set(ITEM, [36814]);
    store.onlineStore.add(36814);
    expect(select(store).entries).toEqual([{ kind: 'onlineStore' }]);

    const questCoffer = emptyInputs();
    questCoffer.containers.set(ITEM, [500]);
    questCoffer.quests.set(500, [3]);
    questCoffer.questInfo.set(3, { name: 'The Coffer Quest', kind: 'side' });
    expect(select(questCoffer).entries).toEqual([{ kind: 'quest', questId: 3 }]);

    const plain = emptyInputs();
    plain.containers.set(ITEM, [501]);
    expect(select(plain).entries).toEqual([{ kind: 'container', containerId: 501 }]);
  });
});

describe('vendor choice', () => {
  function vendors(npcs: Array<[number, string | null, { unreachable?: boolean }?]>): Inputs {
    const i = emptyInputs();
    i.zoneLevels.set('Urqopacha', 90).set("Kozama'uka", 91).set('Old Gridania', 1).set('Central Shroud', 1);
    i.offers.set(ITEM, [offer(shop(263178, npcs.map(([id]) => id)), [{ itemId: 1, amount: 28483 }])]);
    for (const [id, zone, extra] of npcs) i.npcs.set(id, npc(id, 'merchant', zone, extra));
    return i;
  }
  const chosen = (i: Inputs): number | undefined => {
    const [entry] = select(i).entries;
    return entry?.kind === 'vendor' ? entry.npc.id : undefined;
  };

  it('prefers Gridania over any level', () => {
    expect(chosen(vendors([[1, 'Central Shroud'], [2, 'Old Gridania']]))).toBe(2);
  });

  it('otherwise takes the lowest-level zone, then the lowest NPC id', () => {
    expect(chosen(vendors([[3, "Kozama'uka"], [4, 'Urqopacha']]))).toBe(4);
    expect(chosen(vendors([[6, 'Urqopacha'], [5, 'Urqopacha']]))).toBe(5);
  });

  it('ranks a zone with no known level after every known zone', () => {
    expect(chosen(vendors([[7, 'Brand New Zone'], [8, "Kozama'uka"]]))).toBe(8);
    expect(chosen(vendors([[7, 'Brand New Zone']]))).toBe(7);
  });

  it('skips NPCs in duty or housing maps and drops a vendor nobody reachable runs', () => {
    expect(chosen(vendors([[9, 'Old Gridania', { unreachable: true }], [10, 'Urqopacha']]))).toBe(10);
    const nowhere = select(vendors([[11, null]]));
    expect(nowhere.entries).toEqual([]);
    expect(nowhere.dropped).toEqual(['vendorWithoutPosition']);
  });

  it('one segment per price: the same cost at two shops picks one NPC across both', () => {
    const i = emptyInputs();
    i.zoneLevels.set('Urqopacha', 90).set("Kozama'uka", 91);
    i.offers.set(ITEM, [
      offer(shop(1, [21]), [{ itemId: 1, amount: 500 }]),
      offer(shop(2, [20]), [{ itemId: 1, amount: 500 }]),
    ]);
    i.npcs.set(21, npc(21, 'merchant', "Kozama'uka"));
    i.npcs.set(20, npc(20, 'merchant', 'Urqopacha'));
    const { entries } = select(i);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind === 'vendor' && entries[0].npc.id).toBe(20);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/select.test.ts --coverage.enabled=false`
Expected: FAIL — `Failed to resolve import "../../scripts/acquisition/select.js"`.

- [ ] **Step 3: Write the sources stage**

Create `apps/api-worker/scripts/acquisition/sources.ts`:

```ts
/**
 * Stage 1 of the acquisition build: every raw route the data knows for one
 * item, before any rule removes or rewrites one. Order does not matter here;
 * `format.ts` sorts.
 */

import type { Inputs, Source } from './model.js';

export function collectSources(itemId: number, inputs: Inputs): Source[] {
  const out: Source[] = [];
  const saga = inputs.relics.get(itemId);
  if (saga) out.push({ kind: 'relic', saga });
  for (const dutyId of inputs.duties.get(itemId) ?? []) out.push({ kind: 'duty', dutyId });
  for (const questId of inputs.quests.get(itemId) ?? []) out.push({ kind: 'quest', questId });
  for (const fate of inputs.fates.get(itemId) ?? []) out.push({ kind: 'fate', ...fate });
  for (const name of inputs.achievements.get(itemId) ?? []) out.push({ kind: 'achievement', name });
  for (const recipe of inputs.recipes.get(itemId) ?? []) out.push({ kind: 'craft', ...recipe });
  for (const offer of inputs.offers.get(itemId) ?? []) out.push({ kind: 'offer', offer });
  for (const containerId of inputs.containers.get(itemId) ?? []) out.push({ kind: 'container', containerId });
  for (const voyage of inputs.voyages.get(itemId) ?? []) out.push({ kind: 'voyage', voyage });
  for (const desynth of inputs.desynth.get(itemId) ?? []) out.push({ kind: 'desynth', ...desynth });
  if (inputs.onlineStore.has(itemId)) out.push({ kind: 'onlineStore' });
  return out;
}
```

- [ ] **Step 4: Write the rules stage**

Create `apps/api-worker/scripts/acquisition/select.ts`:

```ts
/**
 * Stage 2 of the acquisition build: which of an item's raw sources the line
 * shows, and in what form — spec D5–D12 plus the guide's own "only if"
 * clauses. Nothing here formats text.
 */

import type { Cost, Entry, Inputs, Npc, Offer, Source, Tables } from './model.js';

/**
 * Spec D6: a token exchange from any duty follows the Savage rule (list the
 * duties, not the exchange). `false` limits the rule to Savage duties.
 */
const TOKEN_RULE_ALL_DUTIES = true;

/** ItemUICategory rows of general currencies: 63 "Other" (gil, seals, marks, tomestones, MGP) and 100 "Currency". */
const CURRENCY_CATEGORIES = new Set([63, 100]);

const GRIDANIA = new Set(['New Gridania', 'Old Gridania']);

const SCRIP = / (Crafters'|Gatherers') Scrip$/;
const IRREGULAR_TOMESTONE = /^Irregular Tomestone of /;

export interface Selection {
  entries: Entry[];
  /** Rule names that removed a source — the build's meta counts. */
  dropped: string[];
}

export function selectEntries(sources: Source[], inputs: Inputs, tables: Tables): Selection {
  const relic = sources.find((s) => s.kind === 'relic');
  if (relic) return { entries: [relic], dropped: [] };

  const dropped: string[] = [];
  const duties = new Set<number>();
  const quests = new Set<number>();
  const gacha: Entry[] = [];
  const rest: Entry[] = [];
  const vendors = new Map<string, { costs: Cost[]; npcIds: number[] }>();

  function addQuest(questId: number): void {
    const quest = inputs.questInfo.get(questId);
    if (!quest) return;
    if (quest.kind === 'event') dropped.push('seasonalQuest');
    else quests.add(questId);
  }

  function addContainer(containerId: number): void {
    if (inputs.onlineStore.has(containerId)) {
      rest.push({ kind: 'onlineStore' });
      return;
    }
    const eureka = tables.eurekaLockboxes.get(containerId);
    if (eureka) {
      gacha.push({ kind: 'eurekaLockbox', line: eureka });
      return;
    }
    if (tables.gachaContainers.has(containerId)) {
      gacha.push({ kind: 'container', containerId });
      return;
    }
    const containerDuties = inputs.duties.get(containerId) ?? [];
    const containerQuests = inputs.quests.get(containerId) ?? [];
    if (containerDuties.length > 0) containerDuties.forEach((d) => duties.add(d));
    else if (containerQuests.length > 0) containerQuests.forEach(addQuest);
    else rest.push({ kind: 'container', containerId });
  }

  function addOffer(offer: Offer): void {
    if (/^Repurchase\b/.test(offer.shop.name)) {
      dropped.push('repurchaseShop');
      return;
    }
    if (offer.shop.festival) {
      dropped.push('seasonalShop');
      return;
    }
    const tokenDuties = dutyTokenDuties(offer.costs, inputs);
    if (tokenDuties) {
      tokenDuties.forEach((d) => duties.add(d));
      return;
    }
    const single = offer.costs.length === 1 ? offer.costs[0] : undefined;
    if (single && SCRIP.test(inputs.items.get(single.itemId)?.name ?? '')) {
      rest.push({ kind: 'scrip', cost: single });
      return;
    }
    if (offer.costs.length > 0 && offer.costs.every((c) => IRREGULAR_TOMESTONE.test(inputs.items.get(c.itemId)?.name ?? ''))) {
      rest.push({ kind: 'treasureTrove' });
      return;
    }
    const key = offer.costs.map((c) => `${c.itemId}x${c.amount}`).join('+');
    const group = vendors.get(key) ?? { costs: offer.costs, npcIds: [] };
    group.npcIds.push(...offer.shop.npcIds);
    vendors.set(key, group);
  }

  for (const source of sources) {
    switch (source.kind) {
      case 'duty':
        duties.add(source.dutyId);
        break;
      case 'quest':
        addQuest(source.questId);
        break;
      case 'container':
        addContainer(source.containerId);
        break;
      case 'offer':
        addOffer(source.offer);
        break;
      default:
        rest.push(source);
    }
  }

  for (const group of vendors.values()) {
    const npc = chooseNpc(group.npcIds, inputs);
    if (npc) rest.push({ kind: 'vendor', npc, costs: group.costs });
    else dropped.push('vendorWithoutPosition');
  }

  const entries: Entry[] = [...[...duties].sort((a, b) => a - b).map((dutyId): Entry => ({ kind: 'duty', dutyId })), ...rest];
  if (quests.size > 0) {
    if (entries.length === 0) entries.push(...[...quests].map((questId): Entry => ({ kind: 'quest', questId })));
    else dropped.push('questNotOnlySource');
  }
  if (gacha.length > 0) {
    if (entries.length === 0) entries.push(...gacha);
    else dropped.push('gachaNotOnlySource');
  }
  return { entries, dropped };
}

/** The duties a pure token exchange stands for; null when any cost is not a duty token (spec D5/D6). */
function dutyTokenDuties(costs: Cost[], inputs: Inputs): number[] | null {
  if (costs.length === 0) return null;
  const duties: number[] = [];
  for (const { itemId } of costs) {
    const item = inputs.items.get(itemId);
    const drops = inputs.duties.get(itemId) ?? [];
    if (!item || CURRENCY_CATEGORIES.has(item.uiCategory) || drops.length === 0) return null;
    duties.push(...drops);
  }
  if (!TOKEN_RULE_ALL_DUTIES && !duties.every((d) => (inputs.dutyNames.get(d) ?? '').endsWith('(Savage)'))) return null;
  return duties;
}

/** Spec D9: Gridania, else the lowest-level zone, else the lowest NPC id; unreachable or unplaced NPCs never. */
function chooseNpc(npcIds: number[], inputs: Inputs): Npc | null {
  const rank = (npc: Npc): number => {
    const zone = npc.zone ?? '';
    if (GRIDANIA.has(zone)) return -1;
    return inputs.zoneLevels.get(zone) ?? Number.MAX_SAFE_INTEGER;
  };
  const candidates = [...new Set(npcIds)]
    .map((id) => inputs.npcs.get(id))
    .filter((npc): npc is Npc => npc !== undefined && npc.zone !== null && !npc.unreachable);
  candidates.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  return candidates[0] ?? null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/select.test.ts --coverage.enabled=false`
Expected: PASS (15 tests).

- [ ] **Step 6: Type-check and commit**

Run: `pnpm --filter xivdyetools-api-worker run type-check` — expected exit 0.

```bash
git add apps/api-worker/scripts/acquisition/sources.ts apps/api-worker/scripts/acquisition/select.ts apps/api-worker/tests/acquisition/select.test.ts
git commit --only -m "feat(api-worker): acquisition rules — only-source, Savage, vendor choice" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/api-worker/scripts/acquisition/sources.ts apps/api-worker/scripts/acquisition/select.ts apps/api-worker/tests/acquisition/select.test.ts
```

---

### Task 3: Inputs, outposts and the hand-kept tables

**Files:**
- Create: `apps/api-worker/scripts/acquisition/labels.ts`
- Create: `apps/api-worker/scripts/acquisition/inputs.ts`
- Create: `apps/api-worker/scripts/acquisition/tables/gacha-containers.json`
- Create: `apps/api-worker/scripts/acquisition/tables/eureka-lockboxes.json`
- Create: `apps/api-worker/scripts/acquisition/tables/ishgard-districts.json`
- Create: `apps/api-worker/scripts/acquisition/tables/relic-sagas.json`
- Test: `apps/api-worker/tests/acquisition/labels.test.ts`, `apps/api-worker/tests/acquisition/inputs.test.ts`

**Interfaces:**
- Consumes: `model.ts`; `pluralOf` (Task 1).
- Produces: `markerCoordinate(px: number, sizeFactor: number): number`; `nearestLabel(labels: readonly MapLabel[], x: number, y: number, maxDistance?: number): string | null` with `interface MapLabel { name: string; x: number; y: number }`; `interface RawFiles`, `interface XivapiExtras`, `interface RelicRule`, `interface TableFiles` (exact shapes below); `fateZoneLevels(raw: RawFiles, levelZones: Map<number, string>): Map<string, number>`; `buildInputs(raw: RawFiles, extras: XivapiExtras, rules: RelicRule[]): Inputs`; `tablesFrom(files: TableFiles, inputs: Inputs): Tables`.

- [ ] **Step 1: Write the failing label tests**

Create `apps/api-worker/tests/acquisition/labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { markerCoordinate, nearestLabel } from '../../scripts/acquisition/labels.js';

describe('markerCoordinate', () => {
  it('maps the 2048-px texture onto 41 map units at SizeFactor 100', () => {
    expect(markerCoordinate(0, 100)).toBeCloseTo(1);
    expect(markerCoordinate(2048, 100)).toBeCloseTo(42);
    expect(markerCoordinate(2048, 200)).toBeCloseTo(21.5);
  });
});

describe('nearestLabel', () => {
  const urqopacha = [
    { name: 'Ten Thousand Steps', x: 32.93, y: 34.83 },
    { name: "Worlar's Echo", x: 30.83, y: 34.21 },
    { name: 'Solace', x: 29.43, y: 37.64 },
  ];

  it('picks the closest label (the Independent Merchant stands in Worlar\'s Echo)', () => {
    expect(nearestLabel(urqopacha, 30.47, 34.64)).toBe("Worlar's Echo");
  });

  it('returns null when nothing is within 3 map units', () => {
    expect(nearestLabel(urqopacha, 10, 10)).toBeNull();
    expect(nearestLabel([], 30, 30)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure, then write `labels.ts`**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/labels.test.ts --coverage.enabled=false` — expected FAIL (unresolved import).

Create `apps/api-worker/scripts/acquisition/labels.ts`:

```ts
/**
 * Outposts for wilderness vendors (spec D10): the nearest area label the game
 * prints on the NPC's map. `MapMarker` positions are pixels on the 2048-px map
 * texture; NPC positions (Teamcraft) are in-game map coordinates.
 */

export interface MapLabel {
  name: string;
  x: number;
  y: number;
}

/** In-game map coordinate of a MapMarker pixel: 41 units across at SizeFactor 100. */
export function markerCoordinate(px: number, sizeFactor: number): number {
  return (41 / (sizeFactor / 100)) * (px / 2048) + 1;
}

/** The closest label within `maxDistance` map units, or null. */
export function nearestLabel(labels: readonly MapLabel[], x: number, y: number, maxDistance = 3): string | null {
  let best: MapLabel | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const label of labels) {
    const distance = Math.hypot(label.x - x, label.y - y);
    if (distance <= maxDistance && distance < bestDistance) {
      best = label;
      bestDistance = distance;
    }
  }
  return best?.name ?? null;
}
```

Run the label tests again — expected PASS (3 tests).

- [ ] **Step 3: Write the hand-kept tables**

Create `apps/api-worker/scripts/acquisition/tables/gacha-containers.json` (seeded from research §6: every container yielding more than 15 items whose description or name marks it random; reviewed in Task 4):

```json
[
  { "id": 33441, "name": "Fête Present" },
  { "id": 41667, "name": "Sanctuary Materiel Container" },
  { "id": 36635, "name": "Materiel Container 3.0" },
  { "id": 36636, "name": "Materiel Container 4.0" },
  { "id": 32161, "name": "Venture Coffer" },
  { "id": 31357, "name": "Southern Front Lockbox" },
  { "id": 33797, "name": "Zadnor Lockbox" },
  { "id": 22508, "name": "Anemos Lockbox" },
  { "id": 23142, "name": "Pagos Lockbox" },
  { "id": 24141, "name": "Pyros Lockbox" },
  { "id": 24848, "name": "Hydatos Lockbox" },
  { "id": 16170, "name": "Bronze-trimmed Sack" },
  { "id": 16171, "name": "Iron-trimmed Sack" },
  { "id": 16172, "name": "Silver-trimmed Sack" },
  { "id": 16173, "name": "Gold-trimmed Sack" },
  { "id": 23223, "name": "Silver-haloed Sack" },
  { "id": 23224, "name": "Gold-haloed Sack" },
  { "id": 23225, "name": "Platinum-haloed Sack" },
  { "id": 6688, "name": "Timeworn Leather Map" },
  { "id": 6689, "name": "Timeworn Goatskin Map" },
  { "id": 6690, "name": "Timeworn Toadskin Map" },
  { "id": 6691, "name": "Timeworn Boarskin Map" },
  { "id": 6692, "name": "Timeworn Peisteskin Map" },
  { "id": 8156, "name": "Unhidden Leather Map" },
  { "id": 12241, "name": "Timeworn Archaeoskin Map" },
  { "id": 12242, "name": "Timeworn Wyvernskin Map" },
  { "id": 12243, "name": "Timeworn Dragonskin Map" },
  { "id": 17835, "name": "Timeworn Gaganaskin Map" },
  { "id": 26744, "name": "Timeworn Gliderskin Map" },
  { "id": 36611, "name": "Timeworn Saigaskin Map" },
  { "id": 36612, "name": "Timeworn Kumbhiraskin Map" },
  { "id": 43556, "name": "Timeworn Loboskin Map" }
]
```

Create `apps/api-worker/scripts/acquisition/tables/eureka-lockboxes.json` (container name → the guide's line; names that do not exist in the data never match):

```json
{
  "Anemos Lockbox": "Eureka Anemos Lockboxes",
  "Pagos Lockbox": "Eureka Pagos Lockboxes",
  "Cold-warped Lockbox": "Eureka Pagos Lockboxes",
  "Pyros Lockbox": "Eureka Pyros Lockboxes",
  "Heat-warped Lockbox": "Eureka Pyros Lockboxes",
  "Hydatos Lockbox": "Eureka Hydatos Lockboxes",
  "Moisture-warped Lockbox": "Eureka Hydatos Lockboxes"
}
```

Create `apps/api-worker/scripts/acquisition/tables/ishgard-districts.json`:

```json
["Foundation", "The Pillars", "The Firmament"]
```

Create `apps/api-worker/scripts/acquisition/tables/relic-sagas.json` (spec D11; first matching rule wins; `spotChecks` fail the build when they stop matching):

```json
[
  {
    "saga": "Zodiac Weapons Saga",
    "sheets": [{ "sheet": "RelicItem", "items": "links" }],
    "shops": [], "zones": [], "toolShops": [], "include": [], "exclude": [],
    "spotChecks": [10059, 6257]
  },
  {
    "saga": "Anima Weapons Saga",
    "sheets": [{ "sheet": "AnimaWeaponItem", "items": "links" }, { "sheet": "AnimaWeapon5", "items": "links" }],
    "shops": [], "zones": [], "toolShops": [], "include": [], "exclude": [],
    "spotChecks": [13611, 14870]
  },
  {
    "saga": "Eureka Gear & Weapons",
    "sheets": [],
    "shops": ["^Replicate Eureka Weapons"],
    "zones": ["Eureka Anemos", "Eureka Pagos", "Eureka Pyros", "Eureka Hydatos"],
    "toolShops": [], "include": [], "exclude": [],
    "spotChecks": []
  },
  {
    "saga": "Resistance Gear & Weapons",
    "sheets": [{ "sheet": "ResistanceWeaponAdjust", "items": "rowIds" }],
    "shops": ["^Bozjan Gear (Exchange|Augmentation)$", "^Law's Order Gear (Exchange|Augmentation)$"],
    "zones": [], "toolShops": [], "include": [], "exclude": [],
    "spotChecks": [32669]
  },
  {
    "saga": "Manderville Weapons Saga",
    "sheets": [{ "sheet": "MandervilleWeaponEnhance", "items": "rowIds" }],
    "shops": [], "zones": [], "toolShops": [], "include": [], "exclude": [],
    "spotChecks": [39921]
  },
  {
    "saga": "Phantom Gear & Weapons",
    "sheets": [],
    "shops": ["^Phantom Weapons ", "^Phantom Weapon Replication", "^Phantom Vision Gear Augmentation"],
    "zones": [], "toolShops": [], "include": [], "exclude": [],
    "spotChecks": [47878]
  },
  {
    "saga": "Skysteel Tools Saga",
    "sheets": [],
    "shops": ["^Skysteel Prototype (\\+1 )?Augmentation$", "^Purchase Skysteel (Prototypes|Replicas)$"],
    "zones": [], "toolShops": [], "include": [], "exclude": [],
    "spotChecks": []
  },
  {
    "saga": "Splendorous Tools Saga",
    "sheets": [],
    "shops": ["^Purchase Splendorous Replicas$"],
    "zones": [], "toolShops": [], "include": [], "exclude": [],
    "spotChecks": []
  },
  {
    "saga": "Cosmic Tools Saga",
    "sheets": [],
    "shops": [], "zones": [],
    "toolShops": ["^Cosmic Exploration Token Exchange$"],
    "include": [], "exclude": [],
    "spotChecks": []
  }
]
```

- [ ] **Step 4: Write the failing inputs tests**

Create `apps/api-worker/tests/acquisition/inputs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildInputs,
  fateZoneLevels,
  tablesFrom,
  type RawFiles,
  type RelicRule,
  type XivapiExtras,
} from '../../scripts/acquisition/inputs.js';

function raw(): RawFiles {
  return {
    shops: [
      {
        id: 263178,
        type: 'GilShop',
        npcs: [1048726],
        trades: [
          { currencies: [{ id: 1, amount: 28483 }], items: [{ id: 42027, amount: 1 }] },
          { currencies: [{ id: 1, amount: 10 }], items: [{ id: 5, amount: 1 }] },
        ],
      },
      { id: 1770926, type: 'SpecialShop', npcs: [1053905], trades: [{ currencies: [{ id: 47750, amount: 3 }], items: [{ id: 47878, amount: 1 }] }] },
      { id: 1770974, type: 'SpecialShop', npcs: [2], trades: [{ currencies: [{ id: 900, amount: 1 }], items: [{ id: 700, amount: 1 }, { id: 701, amount: 1 }] }] },
      { id: 1770500, type: 'SpecialShop', npcs: [3], trades: [{ currencies: [{ id: 901, amount: 0 }], items: [{ id: 702, amount: 1 }] }] },
    ],
    npcs: {
      1048726: { en: 'independent merchant', position: { map: 857, x: 30.47, y: 34.64 } },
      1053905: { en: 'Dodokkuli', position: { map: 1000, x: 6.71, y: 7.14 } },
      2: { en: 'token trader', position: { map: 1001, x: 1, y: 1 } },
      3: { en: 'in a duty', position: { map: 1002, x: 1, y: 1 } },
    },
    maps: {
      857: { placename_id: 4505, territory_id: 1187, dungeon: false, housing: false },
      1000: { placename_id: 5000, territory_id: 1269, dungeon: false, housing: false },
      1001: { placename_id: 5001, territory_id: 1300, dungeon: false, housing: false },
      1002: { placename_id: 5002, territory_id: 1301, dungeon: true, housing: false },
    },
    places: { 4505: { en: 'Urqopacha' }, 5000: { en: 'Phantom Village' }, 5001: { en: 'Sinus Ardorum' }, 5002: { en: 'Some Duty' } },
    instances: { 30100: { en: "Eden's Promise: Litany (Savage)" }, 1: { en: 'the Thousand Maws of Toto-Rak' } },
    instanceSources: { 32147: [30100], 42027: [1] },
    lootSources: { 36828: [36814] },
    mogstationSources: { 36814: { price: 22, id: 875 } },
    recipesPerItem: { 42027: [{ job: 13, lvl: 92 }], 5: [{ job: 8, lvl: 1 }] },
    questSources: { 42027: [65621, 70317, 66656] },
    quests: {
      65621: { name: { en: 'Close to Home' } },
      70317: { name: { en: 'Blue Starlight' } },
      66656: { name: { en: 'A Relic Reborn (Curtana)' } },
    },
    achievements: { 7: { en: 'Let the Bodies Hit the Floor', itemReward: 42027 } },
    fateSources: { 42027: [506] },
    fates: {
      506: { name: { en: 'He Taketh It with His Eyes' }, level: 92, location: 111 },
      507: { name: { en: 'Early FATE' }, level: 90, location: 111 },
      508: { name: { en: 'Unplaced' }, level: 50, location: 999 },
    },
    voyageSources: { 42027: [{ type: 0, id: 1 }, { type: 1, id: 2 }, { type: 1, id: 3 }] },
    desynth: { 42027: [5000] },
    specialShopNames: { 1770926: { en: 'Phantom Weapons Penumbrae' }, 1770974: { en: 'Cosmic Exploration Token Exchange' }, 1770500: { en: '' } },
    gilShopNames: { 263178: { en: 'Purchase Battlecraft Gear (DoW)' } },
  };
}

function extras(): XivapiExtras {
  return {
    equippable: new Map([
      [42027, 'Head'],
      [47878, "Rogue's Arm"],
      [700, "Carpenter's Primary Tool"],
      [701, 'Body'],
      [702, 'Legs'],
      [36828, 'Hands'],
      [10059, "Conjurer's Arm"],
    ]),
    items: new Map([
      [47750, { name: 'Arcanite', plural: 'chunks of arcanite', uiCategory: 61, repairJob: 0 }],
      [36656, { name: 'Trophy Crystal', plural: 'Trophy Crystals', uiCategory: 100, repairJob: 0 }],
      [5000, { name: 'Linen Robe', plural: 'linen robes', uiCategory: 35, repairJob: 13 }],
    ]),
    questJournal: new Map([
      [65621, { category: 'Seventh Umbral Era Main Scenario Quests', section: 'Main Scenario (A Realm Reborn through Endwalker)' }],
      [70317, { category: 'Seasonal Events', section: 'Other Quests' }],
      [66656, { category: 'Disciple of War Job Quests', section: 'Class & Job Quests' }],
    ]),
    levelZones: new Map([[111, 'Urqopacha']]),
    expansions: new Map([
      [1187, 5],
      [1269, 5],
      [1300, 5],
    ]),
    festivalShops: new Set([1770500]),
    outposts: new Map([[1048726, "Worlar's Echo"]]),
    relicSheetItems: new Map([['RelicItem', [10059]]]),
  };
}

function rule(saga: string, extra: Partial<RelicRule>): RelicRule {
  return { saga, sheets: [], shops: [], zones: [], toolShops: [], include: [], exclude: [], spotChecks: [], ...extra };
}

const RULES: RelicRule[] = [
  rule('Zodiac Weapons Saga', { sheets: [{ sheet: 'RelicItem', items: 'links' }] }),
  rule('Phantom Gear & Weapons', { shops: ['^Phantom Weapons '] }),
  rule('Cosmic Tools Saga', { toolShops: ['^Cosmic Exploration Token Exchange$'] }),
];

describe('buildInputs', () => {
  const inputs = buildInputs(raw(), extras(), RULES);

  it('keeps offers for equippable items only, dropping zero-amount costs and naming shops by type', () => {
    expect(inputs.offers.get(42027)).toEqual([
      {
        shop: { id: 263178, name: 'Purchase Battlecraft Gear (DoW)', npcIds: [1048726], festival: false },
        costs: [{ itemId: 1, amount: 28483 }],
      },
    ]);
    expect(inputs.offers.has(5)).toBe(false);
    expect(inputs.offers.get(702)?.[0]).toMatchObject({ shop: { festival: true }, costs: [] });
  });

  it('places NPCs by their map, with the outpost and duty/housing flags', () => {
    expect(inputs.npcs.get(1048726)).toEqual({
      id: 1048726,
      name: 'independent merchant',
      zone: 'Urqopacha',
      outpost: "Worlar's Echo",
      unreachable: false,
    });
    expect(inputs.npcs.get(3)?.unreachable).toBe(true);
  });

  it('levels a zone by its lowest FATE and a FATE-less zone by its expansion', () => {
    expect(inputs.zoneLevels.get('Urqopacha')).toBe(90);
    expect(inputs.zoneLevels.get('Phantom Village')).toBe(90);
    expect(fateZoneLevels(raw(), extras().levelZones)).toEqual(new Map([['Urqopacha', 90]]));
  });

  it('capitalizes duty names', () => {
    expect(inputs.dutyNames.get(1)).toBe('The Thousand Maws of Toto-Rak');
    expect(inputs.dutyNames.get(30100)).toBe("Eden's Promise: Litany (Savage)");
    expect(inputs.duties.get(32147)).toEqual([30100]);
  });

  it('classifies quests: main scenario, seasonal event, everything else a sidequest', () => {
    expect(inputs.questInfo.get(65621)).toEqual({ name: 'Close to Home', kind: 'msq' });
    expect(inputs.questInfo.get(70317)).toEqual({ name: 'Blue Starlight', kind: 'event' });
    expect(inputs.questInfo.get(66656)).toEqual({ name: 'A Relic Reborn (Curtana)', kind: 'side' });
  });

  it('reads recipes, achievements, FATEs, voyages and desynthesis', () => {
    expect(inputs.recipes.get(42027)).toEqual([{ job: 13, level: 92 }]);
    expect(inputs.recipes.has(5)).toBe(false);
    expect(inputs.achievements.get(42027)).toEqual(['Let the Bodies Hit the Floor']);
    expect(inputs.fates.get(42027)).toEqual([{ name: 'He Taketh It with His Eyes', zone: 'Urqopacha' }]);
    expect(inputs.voyages.get(42027)).toEqual(['airship', 'submarine']);
    expect(inputs.desynth.get(42027)).toEqual([{ sourceItemId: 5000, job: 13 }]);
  });

  it('builds title-case plurals and keeps the store and container maps', () => {
    expect(inputs.items.get(36656)).toEqual({ name: 'Trophy Crystal', plural: 'Trophy Crystals', uiCategory: 100 });
    expect(inputs.items.get(47750)?.plural).toBe('Arcanite');
    expect(inputs.containers.get(36828)).toEqual([36814]);
    expect(inputs.onlineStore.has(36814)).toBe(true);
  });

  it('computes relic sagas from sheets, shop names and tool-only shops', () => {
    expect(inputs.relics.get(10059)).toBe('Zodiac Weapons Saga');
    expect(inputs.relics.get(47878)).toBe('Phantom Gear & Weapons');
    expect(inputs.relics.get(700)).toBe('Cosmic Tools Saga');
    expect(inputs.relics.has(701)).toBe(false);
  });

  it('applies include and exclude, and the first matching rule wins', () => {
    const relics = buildInputs(raw(), extras(), [
      rule('Phantom Gear & Weapons', { shops: ['^Phantom Weapons '], exclude: [47878] }),
      rule('Other Saga', { shops: ['^Phantom Weapons '], include: [42027] }),
    ]).relics;
    expect(relics.get(47878)).toBe('Other Saga');
    expect(relics.get(42027)).toBe('Other Saga');
  });
});

describe('tablesFrom', () => {
  it('resolves Eureka lockbox names to item ids and keeps the reviewed lists', () => {
    const inputs = buildInputs(raw(), extras(), []);
    inputs.items.set(22508, { name: 'Anemos Lockbox', plural: 'Anemos Lockboxes', uiCategory: 61 });
    const tables = tablesFrom(
      {
        gacha: [{ id: 33441, name: 'Fête Present' }],
        eurekaLockboxes: { 'Anemos Lockbox': 'Eureka Anemos Lockboxes' },
        ishgardDistricts: ['The Firmament'],
      },
      inputs
    );
    expect(tables.gachaContainers).toEqual(new Set([33441]));
    expect(tables.eurekaLockboxes).toEqual(new Map([[22508, 'Eureka Anemos Lockboxes']]));
    expect(tables.ishgardDistricts).toEqual(new Set(['The Firmament']));
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/inputs.test.ts --coverage.enabled=false`
Expected: FAIL — unresolved import `../../scripts/acquisition/inputs.js`.

- [ ] **Step 6: Write `inputs.ts`**

Create `apps/api-worker/scripts/acquisition/inputs.ts`:

```ts
/**
 * Stage 0 of the acquisition build: Teamcraft's data files and the XIVAPI
 * lookups, normalized into `Inputs` — the only shape the rule stages read.
 * Also computes zone levels (spec D9) and relic saga membership (spec D11),
 * and turns the hand-kept table files into `Tables`.
 */

import { pluralOf } from './format.js';
import type { Inputs, ItemInfo, Npc, Offer, QuestKind, Shop, Tables } from './model.js';

/** Teamcraft `libs/data/src/lib/json` files, parsed — only the fields read here. */
export interface RawFiles {
  shops: Array<{
    id: number;
    type: string;
    npcs: number[];
    trades: Array<{ currencies: Array<{ id: number; amount: number }>; items: Array<{ id: number; amount: number }> }>;
  }>;
  npcs: Record<string, { en: string; position?: { map: number; x: number; y: number } | null }>;
  maps: Record<string, { placename_id: number; territory_id: number; dungeon: boolean; housing: boolean }>;
  places: Record<string, { en: string }>;
  instances: Record<string, { en: string }>;
  instanceSources: Record<string, number[]>;
  lootSources: Record<string, number[]>;
  mogstationSources: Record<string, unknown>;
  recipesPerItem: Record<string, Array<{ job: number; lvl: number }>>;
  questSources: Record<string, number[]>;
  quests: Record<string, { name: { en: string } }>;
  achievements: Record<string, { en: string; itemReward?: number }>;
  fateSources: Record<string, number[]>;
  fates: Record<string, { name: { en: string }; level: number; location: number }>;
  voyageSources: Record<string, Array<{ type: number; id: number }>>;
  desynth: Record<string, number[]>;
  specialShopNames: Record<string, { en: string }>;
  gilShopNames: Record<string, { en: string }>;
}

/** What the build script looked up on XIVAPI. */
export interface XivapiExtras {
  /** Equippable item → ItemUICategory name ("Body", "Carpenter's Primary Tool") */
  equippable: Map<number, string>;
  /** Raw game strings for every item a line may mention; `repairJob` is ClassJobRepair (the desynthesis class) */
  items: Map<number, { name: string; plural: string; uiCategory: number; repairJob: number }>;
  /** Quest → journal category and section names */
  questJournal: Map<number, { category: string; section: string }>;
  /** Level row → zone name (FATE locations) */
  levelZones: Map<number, string>;
  /** TerritoryType → ExVersion (0 A Realm Reborn … 5 Dawntrail) */
  expansions: Map<number, number>;
  /** SpecialShops that open only during a seasonal event */
  festivalShops: Set<number>;
  /** Wilderness NPC → nearest map area label */
  outposts: Map<number, string>;
  /** Relic sheet name → the item ids it lists */
  relicSheetItems: Map<string, number[]>;
}

/** One saga's membership rules (`tables/relic-sagas.json`, spec D11). */
export interface RelicRule {
  saga: string;
  /** Game sheets listing the saga's items: Item links in each row, or rows keyed by item id. */
  sheets: Array<{ sheet: string; items: 'links' | 'rowIds' }>;
  /** Shop-name patterns: every equippable item such a shop sells belongs to the saga. */
  shops: string[];
  /** Zones whose vendors sell only this saga's gear. */
  zones: string[];
  /** Shop-name patterns that count only DoH/DoL tools. */
  toolShops: string[];
  include: number[];
  exclude: number[];
  /** Known answers: the build fails when one of these is not in the saga. */
  spotChecks: number[];
}

/** The hand-kept table files, parsed. */
export interface TableFiles {
  gacha: Array<{ id: number; name: string }>;
  /** Container name → the guide's line */
  eurekaLockboxes: Record<string, string>;
  ishgardDistricts: string[];
}

/** Starting level of each expansion, by ExVersion. */
const EXPANSION_LEVEL = [1, 50, 60, 70, 80, 90];
const TOOL_CATEGORY = /(Primary|Secondary) Tool$/;
const VOYAGE: Record<number, 'airship' | 'submarine'> = { 0: 'airship', 1: 'submarine' };

type RawShop = RawFiles['shops'][number];

/** Zone → its lowest FATE level. The zones listed are the wilderness (spec D10). */
export function fateZoneLevels(raw: RawFiles, levelZones: Map<number, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const fate of Object.values(raw.fates)) {
    const zone = levelZones.get(fate.location);
    if (!zone || fate.level <= 0) continue;
    out.set(zone, Math.min(fate.level, out.get(zone) ?? Number.MAX_SAFE_INTEGER));
  }
  return out;
}

export function buildInputs(raw: RawFiles, extras: XivapiExtras, rules: RelicRule[]): Inputs {
  const shopName = (s: RawShop): string =>
    (s.type === 'GilShop' ? raw.gilShopNames[s.id]?.en : raw.specialShopNames[s.id]?.en) ?? '';
  const zoneOfMap = (mapId: number): string | null => {
    const map = raw.maps[mapId];
    return (map && raw.places[map.placename_id]?.en) || null;
  };
  const zoneOfNpc = (npcId: number): string | null => {
    const position = raw.npcs[npcId]?.position;
    return position ? zoneOfMap(position.map) : null;
  };

  const offers = new Map<number, Offer[]>();
  const npcIds = new Set<number>();
  for (const s of raw.shops) {
    const shop: Shop = { id: s.id, name: shopName(s), npcIds: s.npcs, festival: extras.festivalShops.has(s.id) };
    for (const trade of s.trades) {
      const costs = trade.currencies.filter((c) => c.amount > 0).map((c) => ({ itemId: c.id, amount: c.amount }));
      for (const product of trade.items) {
        if (!extras.equippable.has(product.id)) continue;
        push(offers, product.id, { shop, costs });
        s.npcs.forEach((id) => npcIds.add(id));
      }
    }
  }

  const npcs = new Map<number, Npc>();
  for (const id of npcIds) {
    const record = raw.npcs[id];
    if (!record) continue;
    const map = record.position ? raw.maps[record.position.map] : undefined;
    npcs.set(id, {
      id,
      name: record.en,
      zone: zoneOfNpc(id),
      outpost: extras.outposts.get(id) ?? null,
      unreachable: map ? map.dungeon || map.housing : false,
    });
  }

  const zoneLevels = fateZoneLevels(raw, extras.levelZones);
  for (const map of Object.values(raw.maps)) {
    const zone = raw.places[map.placename_id]?.en;
    const expansion = extras.expansions.get(map.territory_id);
    if (zone && expansion !== undefined && !zoneLevels.has(zone)) zoneLevels.set(zone, EXPANSION_LEVEL[expansion] ?? 1);
  }

  const items = new Map<number, ItemInfo>();
  for (const [id, item] of extras.items) {
    items.set(id, { name: item.name, plural: pluralOf(item.name, item.plural), uiCategory: item.uiCategory });
  }

  const recipes = new Map<number, Array<{ job: number; level: number }>>();
  for (const [id, list] of Object.entries(raw.recipesPerItem)) {
    if (extras.equippable.has(Number(id))) recipes.set(Number(id), list.map((r) => ({ job: r.job, level: r.lvl })));
  }

  const duties = numberLists(raw.instanceSources);
  const dutyNames = new Map<number, string>();
  for (const list of duties.values()) {
    for (const id of list) {
      const name = raw.instances[id]?.en;
      if (name) dutyNames.set(id, name.charAt(0).toUpperCase() + name.slice(1));
    }
  }

  const quests = numberLists(raw.questSources);
  const questInfo = new Map<number, { name: string; kind: QuestKind }>();
  for (const list of quests.values()) {
    for (const id of list) {
      const name = raw.quests[id]?.name.en;
      const journal = extras.questJournal.get(id);
      if (name && journal) questInfo.set(id, { name, kind: questKind(journal) });
    }
  }

  const achievements = new Map<number, string[]>();
  for (const achievement of Object.values(raw.achievements)) {
    if (achievement.itemReward) push(achievements, achievement.itemReward, achievement.en);
  }

  const fates = new Map<number, Array<{ name: string; zone: string }>>();
  for (const [id, list] of Object.entries(raw.fateSources)) {
    for (const fateId of list) {
      const fate = raw.fates[fateId];
      const zone = fate ? extras.levelZones.get(fate.location) : undefined;
      if (fate && zone && fate.name.en) push(fates, Number(id), { name: fate.name.en, zone });
    }
  }

  const voyages = new Map<number, Array<'airship' | 'submarine'>>();
  for (const [id, list] of Object.entries(raw.voyageSources)) {
    const found = [...new Set(list.map((v) => VOYAGE[v.type]).filter((k): k is 'airship' | 'submarine' => k !== undefined))];
    if (found.length > 0) voyages.set(Number(id), found);
  }

  const desynth = new Map<number, Array<{ sourceItemId: number; job: number }>>();
  for (const [id, list] of Object.entries(raw.desynth)) {
    for (const sourceItemId of list) {
      const job = extras.items.get(sourceItemId)?.repairJob;
      if (job) push(desynth, Number(id), { sourceItemId, job });
    }
  }

  return {
    items,
    recipes,
    offers,
    npcs,
    zoneLevels,
    dutyNames,
    duties,
    containers: numberLists(raw.lootSources),
    onlineStore: new Set(Object.keys(raw.mogstationSources).map(Number)),
    quests,
    questInfo,
    achievements,
    fates,
    voyages,
    desynth,
    relics: relicsFrom(rules, raw, extras, shopName, zoneOfNpc),
  };
}

export function tablesFrom(files: TableFiles, inputs: Inputs): Tables {
  const eurekaLockboxes = new Map<number, string>();
  for (const [id, item] of inputs.items) {
    const line = files.eurekaLockboxes[item.name];
    if (line) eurekaLockboxes.set(id, line);
  }
  return {
    gachaContainers: new Set(files.gacha.map((g) => g.id)),
    eurekaLockboxes,
    ishgardDistricts: new Set(files.ishgardDistricts),
  };
}

function relicsFrom(
  rules: RelicRule[],
  raw: RawFiles,
  extras: XivapiExtras,
  shopName: (s: RawShop) => string,
  zoneOfNpc: (npcId: number) => string | null
): Map<number, string> {
  const out = new Map<number, string>();
  for (const rule of rules) {
    const members = new Set<number>();
    for (const { sheet } of rule.sheets) for (const id of extras.relicSheetItems.get(sheet) ?? []) members.add(id);
    const shopPatterns = rule.shops.map((p) => new RegExp(p));
    const toolPatterns = rule.toolShops.map((p) => new RegExp(p));
    for (const s of raw.shops) {
      const name = shopName(s);
      const byName = shopPatterns.some((re) => re.test(name));
      const byZone = rule.zones.length > 0 && s.npcs.some((id) => rule.zones.includes(zoneOfNpc(id) ?? ''));
      const byTool = toolPatterns.some((re) => re.test(name));
      if (!byName && !byZone && !byTool) continue;
      for (const trade of s.trades) {
        for (const { id } of trade.items) {
          const category = extras.equippable.get(id);
          if (category === undefined) continue;
          if (byName || byZone || TOOL_CATEGORY.test(category)) members.add(id);
        }
      }
    }
    rule.include.forEach((id) => members.add(id));
    rule.exclude.forEach((id) => members.delete(id));
    for (const id of members) if (extras.equippable.has(id) && !out.has(id)) out.set(id, rule.saga);
  }
  return out;
}

function questKind(journal: { category: string; section: string }): QuestKind {
  if (journal.category === 'Seasonal Events') return 'event';
  return journal.section.startsWith('Main Scenario') ? 'msq' : 'side';
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function numberLists(record: Record<string, number[]>): Map<number, number[]> {
  return new Map(Object.entries(record).map(([key, list]) => [Number(key), list]));
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition --coverage.enabled=false`
Expected: PASS (all four acquisition suites).

- [ ] **Step 8: Type-check and commit**

Run: `pnpm --filter xivdyetools-api-worker run type-check` — expected exit 0.

```bash
git add apps/api-worker/scripts/acquisition/labels.ts apps/api-worker/scripts/acquisition/inputs.ts apps/api-worker/scripts/acquisition/tables apps/api-worker/tests/acquisition/labels.test.ts apps/api-worker/tests/acquisition/inputs.test.ts
git commit --only -m "feat(api-worker): acquisition inputs — zones, outposts, relic sagas, tables" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/api-worker/scripts/acquisition/labels.ts apps/api-worker/scripts/acquisition/inputs.ts apps/api-worker/scripts/acquisition/tables apps/api-worker/tests/acquisition/labels.test.ts apps/api-worker/tests/acquisition/inputs.test.ts
```

---

### Task 4: The build script, the generated table, and the acceptance test

**Files:**
- Create: `apps/api-worker/scripts/build-acquisition.ts`
- Modify: `apps/api-worker/tests/acquisition/helpers.ts` (add `reviveInputs`)
- Create: `apps/api-worker/tests/acquisition/acceptance.test.ts`
- Generate: `apps/api-worker/tests/acquisition/fixtures/inputs.json`, `apps/api-worker/src/chara/data/acquisition.en.json`, `apps/api-worker/src/chara/data/acquisition.meta.json`
- Modify: `.gitattributes`

**Interfaces:**
- Consumes: `collectSources`, `selectEntries`, `formatEntries`, `buildInputs`, `fateZoneLevels`, `tablesFrom`, `markerCoordinate`, `nearestLabel` and the types above.
- Produces: the committed table `{ "<itemId>": "<line>" }` (read by Task 5) and meta; the fixture read by the acceptance test.

- [ ] **Step 1: Add the fixture reviver to the test helpers**

Append to `apps/api-worker/tests/acquisition/helpers.ts`:

```ts
/** The acceptance fixture stores every Map as entry pairs and the one Set as an array. */
export function reviveInputs(json: Record<string, unknown>): Inputs {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(json)) {
    out[key] = key === 'onlineStore' ? new Set(value as number[]) : new Map(value as Array<[unknown, unknown]>);
  }
  return out as unknown as Inputs;
}
```

- [ ] **Step 2: Write the failing acceptance test**

Create `apps/api-worker/tests/acquisition/acceptance.test.ts`. The expected strings are the user's hand-written GPOSERS lines (research §5) and must not be edited to make the test pass:

```ts
/**
 * Acceptance: a real glamour written by hand to the GPOSERS guide, reproduced
 * from the pinned data (research §5). The fixture is the normalized inputs for
 * these items only, written by `build-acquisition.ts --fixture`.
 */

import { describe, expect, it } from 'vitest';
import { formatEntries } from '../../scripts/acquisition/format.js';
import { tablesFrom } from '../../scripts/acquisition/inputs.js';
import { selectEntries } from '../../scripts/acquisition/select.js';
import { collectSources } from '../../scripts/acquisition/sources.js';
import eurekaLockboxes from '../../scripts/acquisition/tables/eureka-lockboxes.json';
import gacha from '../../scripts/acquisition/tables/gacha-containers.json';
import ishgardDistricts from '../../scripts/acquisition/tables/ishgard-districts.json';
import fixture from './fixtures/inputs.json';
import { reviveInputs } from './helpers.js';

const inputs = reviveInputs(fixture as unknown as Record<string, unknown>);
const tables = tablesFrom({ gacha, eurekaLockboxes, ishgardDistricts }, inputs);
const lineFor = (itemId: number): string | null =>
  formatEntries(selectEntries(collectSources(itemId, inputs), inputs, tables).entries, inputs, tables);

describe('acceptance — the user\'s "Cropsey" glamour', () => {
  it.each([
    [47878, 'Phantom Gear & Weapons'],
    [42027, "Crafted (WVR Lvl. 92) / Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil)"],
    [42038, "Crafted (WVR Lvl. 93) / Independent Merchant - Urqopacha - Worlar's Echo (47,471 Gil)"],
    [32326, "Eden's Promise: Litany (Savage) / Eden's Promise: Anamorphosis (Savage)"],
    [47252, "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)"],
    [32797, "Enie - Ishgard - The Firmament (1,200 Skybuilders' Scrips)"],
  ])('item %i reads as written by hand', (itemId, expected) => {
    expect(lineFor(itemId)).toBe(expected);
  });
});

describe('acceptance — research §2–§3 pieces', () => {
  it.each([
    [36828, 'FFXIV Online Store'],
    [44665, 'FFXIV Online Store'],
    [10059, 'Zodiac Weapons Saga'],
  ])('item %i', (itemId, expected) => {
    expect(lineFor(itemId)).toBe(expected);
  });
});
```

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/acceptance.test.ts --coverage.enabled=false`
Expected: FAIL — `Failed to resolve import "./fixtures/inputs.json"`.

- [ ] **Step 3: Write the build script**

Create `apps/api-worker/scripts/build-acquisition.ts`:

```ts
/**
 * Build the GPOSERS "Acquisition" table for `POST /v1/chara/resolve`.
 *
 * A BUILD-TIME step, run by hand after each patch (after build-item-names.mjs),
 * from the repository root:
 *
 *   pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts
 *   pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts --fixture 47878,42027
 *
 * Inputs: Teamcraft's data files at ONE pinned commit (MIT) and XIVAPI v2 at one
 * game version. Output: src/chara/data/acquisition.en.json
 * ({ "<itemId>": "<line>" } for equippable items that have a line) and
 * acquisition.meta.json. `--fixture` writes the normalized inputs for the given
 * items to tests/acquisition/fixtures/inputs.json instead of the table.
 * Design: docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatEntries } from './acquisition/format.js';
import { buildInputs, fateZoneLevels, tablesFrom, type RawFiles, type RelicRule, type TableFiles, type XivapiExtras } from './acquisition/inputs.js';
import { markerCoordinate, nearestLabel, type MapLabel } from './acquisition/labels.js';
import type { Inputs, Tables } from './acquisition/model.js';
import { selectEntries } from './acquisition/select.js';
import { collectSources } from './acquisition/sources.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'src', 'chara', 'data');
const TABLES_DIR = join(HERE, 'acquisition', 'tables');
const FIXTURE = join(HERE, '..', 'tests', 'acquisition', 'fixtures', 'inputs.json');
const UA = 'xivdyetools-build-acquisition/1.0 (https://xivdyetools.app)';
const XIVAPI = 'https://v2.xivapi.com/api';
const TEAMCRAFT_REPO = 'ffxiv-teamcraft/ffxiv-teamcraft';
const TEAMCRAFT_DIR = 'libs/data/src/lib/json';
const BATCH = 100;

const TEAMCRAFT_FILES = {
  shops: 'shops',
  npcs: 'npcs',
  maps: 'maps',
  places: 'places',
  instances: 'instances',
  instanceSources: 'instance-sources',
  lootSources: 'loot-sources',
  mogstationSources: 'mogstation-sources',
  recipesPerItem: 'recipes-per-item',
  questSources: 'quest-sources',
  quests: 'quests',
  achievements: 'achievements',
  fateSources: 'fate-sources',
  fates: 'fates',
  voyageSources: 'voyage-sources',
  desynth: 'desynth',
  specialShopNames: 'special-shop-names',
  gilShopNames: 'gil-shop-names',
} as const satisfies Record<keyof RawFiles, string>;

type Link = { value?: number; fields?: Record<string, unknown> };

let gameVersion = 'latest';

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 503 && url.startsWith(XIVAPI)) {
      throw new Error(`XIVAPI answered 503 — search for this game version is not ingested yet; retry later (${url})`);
    }
    if (attempt >= 3 || res.status < 500) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
  }
}

/** Every call after the first pins the game version the first one answered with. */
async function xivapi<T>(path: string, params: Record<string, string>, pin = true): Promise<T> {
  const query = new URLSearchParams(pin ? { ...params, version: gameVersion } : params);
  const out = await getJson<T & { version?: string }>(`${XIVAPI}/${path}?${query}`);
  if (out.version) gameVersion = out.version;
  return out;
}

async function rows<F>(sheet: string, ids: Iterable<number>, fields: string): Promise<Map<number, F>> {
  const out = new Map<number, F>();
  const unique = [...new Set(ids)].filter((id) => id > 0);
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const page = await xivapi<{ rows: Array<{ row_id: number; fields: F }> }>(`sheet/${sheet}`, {
      rows: chunk.join(','),
      fields,
      limit: String(chunk.length),
    });
    for (const row of page.rows) out.set(row.row_id, row.fields);
  }
  return out;
}

async function pinTeamcraft(): Promise<string> {
  const commit = await getJson<{ sha: string }>(`https://api.github.com/repos/${TEAMCRAFT_REPO}/commits/staging`);
  return commit.sha;
}

async function loadTeamcraft(sha: string): Promise<RawFiles> {
  const entries = await Promise.all(
    Object.entries(TEAMCRAFT_FILES).map(
      async ([key, file]) =>
        [key, await getJson(`https://raw.githubusercontent.com/${TEAMCRAFT_REPO}/${sha}/${TEAMCRAFT_DIR}/${file}.json`)] as const
    )
  );
  const raw = Object.fromEntries(entries) as unknown as RawFiles;
  assertShapes(raw);
  return raw;
}

/** Fail loudly when a Teamcraft file stops having the fields `inputs.ts` reads (spec, Error handling). */
function assertShapes(raw: RawFiles): void {
  const fail = (file: string, expected: string): never => {
    throw new Error(`Teamcraft ${file}.json changed shape — expected ${expected}; update inputs.ts`);
  };
  if (!Array.isArray(raw.shops) || !raw.shops.every((s) => Array.isArray(s.trades) && Array.isArray(s.npcs))) {
    fail('shops', '[{ id, type, npcs[], trades[] }]');
  }
  const placed = Object.values(raw.npcs).find((n) => n.position);
  if (typeof placed?.position?.map !== 'number') fail('npcs', '{ en, position: { map, x, y } }');
  const map = Object.values(raw.maps)[0];
  if (typeof map?.placename_id !== 'number' || typeof map.territory_id !== 'number') fail('maps', '{ placename_id, territory_id }');
  const recipe = Object.values(raw.recipesPerItem)[0]?.[0];
  if (typeof recipe?.job !== 'number' || typeof recipe.lvl !== 'number') fail('recipes-per-item', '[{ job, lvl }]');
  const fate = Object.values(raw.fates).find((f) => f.level > 0);
  if (typeof fate?.location !== 'number' || typeof fate.name?.en !== 'string') fail('fates', '{ name.en, level, location }');
  if (typeof Object.values(raw.quests)[0]?.name?.en !== 'string') fail('quests', '{ name.en }');
  const lists: Array<[string, Record<string, unknown>]> = [
    ['instance-sources', raw.instanceSources],
    ['loot-sources', raw.lootSources],
    ['quest-sources', raw.questSources],
    ['fate-sources', raw.fateSources],
    ['desynth', raw.desynth],
  ];
  for (const [file, record] of lists) if (!Object.values(record).every(Array.isArray)) fail(file, '{ itemId: number[] }');
}

async function equippableItems(): Promise<Map<number, string>> {
  type Page = { results: Array<{ row_id: number; fields: { ItemUICategory?: { fields?: { Name?: string } } } }>; next?: string };
  const out = new Map<number, string>();
  let page = await xivapi<Page>('search', { sheets: 'Item', query: 'EquipSlotCategory>0', fields: 'ItemUICategory.Name', limit: '500' });
  for (;;) {
    for (const r of page.results) out.set(r.row_id, r.fields.ItemUICategory?.fields?.Name ?? '');
    if (!page.next) return out;
    page = await xivapi<Page>('search', { cursor: page.next, limit: '500' }, false);
  }
}

async function relicSheetItems(rules: RelicRule[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  for (const { sheet, items } of rules.flatMap((r) => r.sheets)) {
    const list = await xivapi<{ rows: Array<{ row_id: number }> }>(`sheet/${sheet}`, { limit: '500' });
    if (items === 'rowIds') {
      out.set(sheet, list.rows.map((r) => r.row_id));
      continue;
    }
    const ids: number[] = [];
    for (const { row_id } of list.rows) {
      const row = await xivapi<{ fields: Record<string, unknown> }>(`sheet/${sheet}/${row_id}`, {});
      ids.push(...itemLinks(row.fields));
    }
    out.set(sheet, ids);
  }
  return out;
}

/** Item ids linked from a row's own columns — never from the linked rows' fields. */
function itemLinks(fields: Record<string, unknown>): number[] {
  const ids: number[] = [];
  for (const value of Object.values(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      const link = v as { sheet?: string; row_id?: number } | null;
      if (link?.sheet === 'Item' && typeof link.row_id === 'number' && link.row_id > 0) ids.push(link.row_id);
    }
  }
  return ids;
}

async function mapLabels(range: number, sizeFactor: number): Promise<MapLabel[]> {
  type Marker = { row_id: number; fields: { X: number; Y: number; PlaceNameSubtext?: { fields?: { Name?: string } } } };
  const page = await xivapi<{ rows: Marker[] }>('sheet/MapMarker', { after: String(range - 1), limit: '500', fields: 'X,Y,PlaceNameSubtext.Name' });
  const labels: MapLabel[] = [];
  for (const row of page.rows) {
    const name = row.fields.PlaceNameSubtext?.fields?.Name;
    if (row.row_id === range && name) labels.push({ name, x: markerCoordinate(row.fields.X, sizeFactor), y: markerCoordinate(row.fields.Y, sizeFactor) });
  }
  return labels;
}

async function outpostsFor(npcIds: number[], raw: RawFiles, wilderness: Set<string>): Promise<Map<number, string>> {
  const byMap = new Map<number, number[]>();
  for (const id of npcIds) {
    const position = raw.npcs[id]?.position;
    const map = position ? raw.maps[position.map] : undefined;
    const zone = map ? raw.places[map.placename_id]?.en : undefined;
    if (!position || !zone || !wilderness.has(zone)) continue;
    byMap.set(position.map, [...(byMap.get(position.map) ?? []), id]);
  }
  const out = new Map<number, string>();
  for (const [mapId, ids] of byMap) {
    const map = await xivapi<{ fields: { MapMarkerRange: number; SizeFactor: number } }>(`sheet/Map/${mapId}`, { fields: 'MapMarkerRange,SizeFactor' });
    if (!map.fields.MapMarkerRange) continue;
    const labels = await mapLabels(map.fields.MapMarkerRange, map.fields.SizeFactor);
    for (const id of ids) {
      const position = raw.npcs[id]?.position;
      const label = position ? nearestLabel(labels, position.x, position.y) : null;
      if (label) out.set(id, label);
    }
  }
  return out;
}

function readTable<T>(file: string): T {
  return JSON.parse(readFileSync(join(TABLES_DIR, file), 'utf8')) as T;
}

/** Spot checks and "every rule still matches something" (spec D11). */
function checkRelics(rules: RelicRule[], inputs: Inputs): void {
  const problems: string[] = [];
  for (const rule of rules) {
    const count = [...inputs.relics.values()].filter((saga) => saga === rule.saga).length;
    const hasRules = rule.sheets.length + rule.shops.length + rule.zones.length + rule.toolShops.length + rule.include.length > 0;
    if (hasRules && count === 0) problems.push(`${rule.saga}: its rules matched no equippable item — was a sheet or shop renamed?`);
    for (const id of rule.spotChecks) {
      const saga = inputs.relics.get(id);
      if (saga !== rule.saga) problems.push(`${rule.saga}: spot check ${id} is ${saga ? `"${saga}"` : 'not a relic'}`);
    }
  }
  if (problems.length > 0) throw new Error(`Relic rules failed:\n  ${problems.join('\n  ')}`);
}

/** The subset of `inputs` the given items read, Maps as entry pairs (see tests/acquisition/helpers.ts). */
function writeFixture(inputs: Inputs, itemIds: number[]): void {
  const keep = new Set<number>(itemIds);
  for (const id of itemIds) {
    for (const c of inputs.containers.get(id) ?? []) keep.add(c);
    for (const o of inputs.offers.get(id) ?? []) for (const c of o.costs) keep.add(c.itemId);
    for (const d of inputs.desynth.get(id) ?? []) keep.add(d.sourceItemId);
  }
  const npcIds = new Set(itemIds.flatMap((id) => (inputs.offers.get(id) ?? []).flatMap((o) => o.shop.npcIds)));
  const dutyIds = new Set([...keep].flatMap((id) => inputs.duties.get(id) ?? []));
  const questIds = new Set([...keep].flatMap((id) => inputs.quests.get(id) ?? []));
  const pick = <V>(map: Map<number, V>, wanted: Set<number>): Array<[number, V]> => [...map].filter(([key]) => wanted.has(key));
  const fixture = {
    items: pick(inputs.items, keep),
    recipes: pick(inputs.recipes, keep),
    offers: pick(inputs.offers, keep),
    npcs: pick(inputs.npcs, npcIds),
    zoneLevels: [...inputs.zoneLevels],
    dutyNames: pick(inputs.dutyNames, dutyIds),
    duties: pick(inputs.duties, keep),
    containers: pick(inputs.containers, keep),
    onlineStore: [...inputs.onlineStore].filter((id) => keep.has(id)),
    quests: pick(inputs.quests, keep),
    questInfo: pick(inputs.questInfo, questIds),
    achievements: pick(inputs.achievements, keep),
    fates: pick(inputs.fates, keep),
    voyages: pick(inputs.voyages, keep),
    desynth: pick(inputs.desynth, keep),
    relics: pick(inputs.relics, keep),
  };
  writeFileSync(FIXTURE, `${JSON.stringify(fixture, null, 1)}\n`);
  console.log(`wrote ${FIXTURE}`);
}

/** Printed for the human review in Task 4 Step 6; not written to disk. */
async function printReview(inputs: Inputs, tables: Tables, raw: RawFiles): Promise<void> {
  const names = await rows<{ Name: string }>('Item', inputs.relics.keys(), 'Name');
  const bySaga = new Map<string, string[]>();
  for (const [id, saga] of inputs.relics) bySaga.set(saga, [...(bySaga.get(saga) ?? []), names.get(id)?.Name ?? String(id)]);
  console.log('\nRelic sagas (review):');
  for (const [saga, list] of bySaga) console.log(`  ${saga} — ${list.length}: ${list.sort().join('; ')}`);

  const containers = [...new Set(Object.values(raw.lootSources).flat())].filter(
    (id) => !tables.gachaContainers.has(id) && !tables.eurekaLockboxes.has(id)
  );
  const described = await rows<{ Name: string; Description: string }>('Item', containers, 'Name,Description');
  console.log('\nRandom-container candidates NOT in gacha-containers.json (review):');
  for (const [id, row] of described) {
    if (/random|mystery|contents of which remain/i.test(row.Description) || /(Lockbox|Sack|Timeworn .* Map)$/.test(row.Name)) {
      console.log(`  ${id} ${row.Name}`);
    }
  }
}

async function main(): Promise<void> {
  const fixtureArg = process.argv.indexOf('--fixture');
  const fixtureIds = fixtureArg >= 0 ? (process.argv[fixtureArg + 1] ?? '').split(',').map(Number).filter(Boolean) : null;

  const sha = await pinTeamcraft();
  console.log(`Teamcraft staging pinned at ${sha}`);
  const raw = await loadTeamcraft(sha);
  const rules = readTable<RelicRule[]>('relic-sagas.json');
  const tableFiles: TableFiles = {
    gacha: readTable('gacha-containers.json'),
    eurekaLockboxes: readTable('eureka-lockboxes.json'),
    ishgardDistricts: readTable('ishgard-districts.json'),
  };

  const equippable = await equippableItems();
  console.log(`XIVAPI ${gameVersion}: ${equippable.size} equippable items`);
  const sellers = raw.shops.filter((s) => s.trades.some((t) => t.items.some((i) => equippable.has(i.id))));
  const npcIds = [...new Set(sellers.flatMap((s) => s.npcs))];
  const containerIds = [...equippable.keys()].flatMap((id) => raw.lootSources[id] ?? []);
  const desynthIds = [...equippable.keys()].flatMap((id) => raw.desynth[id] ?? []);
  const costIds = sellers.flatMap((s) => s.trades.flatMap((t) => t.currencies.map((c) => c.id)));

  type ItemRow = { Name: string; Plural: string; ItemUICategory?: Link; ClassJobRepair?: Link };
  const itemRows = await rows<ItemRow>('Item', [...costIds, ...containerIds, ...desynthIds], 'Name,Plural,ItemUICategory.value,ClassJobRepair.value');
  type QuestRow = { JournalGenre?: { fields?: { JournalCategory?: { fields?: { Name?: string; JournalSection?: { fields?: { Name?: string } } } } } } };
  const questIds = [...equippable.keys(), ...containerIds].flatMap((id) => raw.questSources[id] ?? []);
  const questRows = await rows<QuestRow>('Quest', questIds, 'JournalGenre.JournalCategory.Name,JournalGenre.JournalCategory.JournalSection.Name');
  type LevelRow = { Territory?: { fields?: { PlaceName?: { fields?: { Name?: string } } } } };
  const levelRows = await rows<LevelRow>('Level', Object.values(raw.fates).map((f) => f.location), 'Territory.PlaceName.Name');
  const territoryIds = npcIds.flatMap((id) => {
    const map = raw.npcs[id]?.position?.map;
    const territory = map !== undefined ? raw.maps[map]?.territory_id : undefined;
    return territory !== undefined ? [territory] : [];
  });
  const territoryRows = await rows<{ ExVersion?: Link }>('TerritoryType', territoryIds, 'ExVersion.value');
  const specialIds = sellers.filter((s) => s.type === 'SpecialShop').map((s) => s.id);
  const specialRows = await rows<{ RequiredFestival?: Link }>('SpecialShop', specialIds, 'RequiredFestival.value');

  const levelZones = new Map<number, string>();
  for (const [id, row] of levelRows) {
    const zone = row.Territory?.fields?.PlaceName?.fields?.Name;
    if (zone) levelZones.set(id, zone);
  }
  const ishgard = new Set(tableFiles.ishgardDistricts);
  const wilderness = new Set([...fateZoneLevels(raw, levelZones).keys()].filter((zone) => !ishgard.has(zone)));

  const extras: XivapiExtras = {
    equippable,
    items: new Map(
      [...itemRows].map(([id, row]) => [
        id,
        { name: row.Name, plural: row.Plural, uiCategory: row.ItemUICategory?.value ?? 0, repairJob: row.ClassJobRepair?.value ?? 0 },
      ])
    ),
    questJournal: new Map(
      [...questRows].map(([id, row]) => {
        const category = row.JournalGenre?.fields?.JournalCategory?.fields;
        return [id, { category: category?.Name ?? '', section: category?.JournalSection?.fields?.Name ?? '' }];
      })
    ),
    levelZones,
    expansions: new Map([...territoryRows].map(([id, row]) => [id, row.ExVersion?.value ?? 0])),
    festivalShops: new Set([...specialRows].filter(([, row]) => (row.RequiredFestival?.value ?? 0) > 0).map(([id]) => id)),
    outposts: await outpostsFor(npcIds, raw, wilderness),
    relicSheetItems: await relicSheetItems(rules),
  };

  const inputs = buildInputs(raw, extras, rules);
  const tables = tablesFrom(tableFiles, inputs);
  checkRelics(rules, inputs);

  if (fixtureIds) {
    writeFixture(inputs, fixtureIds);
    return;
  }

  const table: Record<string, string> = {};
  const entryCounts: Record<string, number> = {};
  const dropped: Record<string, number> = {};
  let sourcesButNoLine = 0;
  for (const itemId of [...equippable.keys()].sort((a, b) => a - b)) {
    const sources = collectSources(itemId, inputs);
    const selection = selectEntries(sources, inputs, tables);
    for (const reason of selection.dropped) dropped[reason] = (dropped[reason] ?? 0) + 1;
    const line = formatEntries(selection.entries, inputs, tables);
    if (line) {
      table[itemId] = line;
      for (const kind of new Set(selection.entries.map((e) => e.kind))) entryCounts[kind] = (entryCounts[kind] ?? 0) + 1;
    } else if (sources.length > 0) {
      sourcesButNoLine++;
    }
  }

  const json = JSON.stringify(table);
  const sagas: Record<string, number> = {};
  for (const saga of inputs.relics.values()) sagas[saga] = (sagas[saga] ?? 0) + 1;
  const meta = {
    generated: new Date().toISOString().slice(0, 10),
    teamcraftCommit: sha,
    xivapiVersion: gameVersion,
    equippable: equippable.size,
    lines: Object.keys(table).length,
    sourcesButNoLine,
    bytes: Buffer.byteLength(json),
    itemsPerRoute: entryCounts,
    dropped,
    relicSagas: sagas,
    unleveledVendorZones: [...new Set([...inputs.npcs.values()].map((n) => n.zone).filter((z): z is string => z !== null && !inputs.zoneLevels.has(z)))].sort(),
  };
  writeFileSync(join(DATA_DIR, 'acquisition.en.json'), json);
  writeFileSync(join(DATA_DIR, 'acquisition.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`wrote ${meta.lines} lines (${meta.bytes} bytes) to src/chara/data/acquisition.en.json`);
  await printReview(inputs, tables, raw);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Type-check the script, then generate the fixture**

Run: `pnpm --filter xivdyetools-api-worker run type-check` — expected exit 0.

Run from the repository root (a few minutes; ~70 MB of downloads and a few hundred XIVAPI calls):

```bash
pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts --fixture 47878,42027,42038,32326,47252,32797,36828,44665,10059
```

Expected: `Teamcraft staging pinned at <sha>`, `XIVAPI <version>: ~29000 equippable items`, `wrote …/tests/acquisition/fixtures/inputs.json`, exit 0.
If it stops with `Relic rules failed`: for each failing spot check, find the missing items with `https://v2.xivapi.com/api/search?sheets=Item&query=Name~"<weapon name stem>"&fields=Name` and add their ids to that saga's `include` in `relic-sagas.json`; never delete a spot check to make the build pass. Rerun.

- [ ] **Step 5: Run the acceptance test**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition/acceptance.test.ts --coverage.enabled=false`
Expected: PASS (9 tests). If a line differs, the data or a rule disagrees with the user's hand-written line: print the item's `collectSources` and `selectEntries` output, fix the rule (and add a unit case for it in Task 2's or Task 3's suite), rerun. Do not edit the expected strings.

- [ ] **Step 6: Generate the full table and review it with the user**

Run from the repository root: `pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts`
Expected: `wrote <N> lines (<B> bytes) …`, then the two review lists.

Stop and show the user: `acquisition.meta.json` (lines, `itemsPerRoute`, `dropped`, `relicSagas`, `unleveledVendorZones`), the relic-saga lists, and the random-container candidates. Apply their corrections — `include`/`exclude` in `relic-sagas.json`, ids added to `gacha-containers.json` — and rerun Steps 4–6 until they approve. Record the approval in the commit message.

- [ ] **Step 7: Mark the table as generated**

In `.gitattributes`, below the `item-names.*.json` line, add:

```
# Generated GPOSERS acquisition table (apps/api-worker/scripts/build-acquisition.ts)
apps/api-worker/src/chara/data/acquisition.en.json linguist-generated=true -diff
```

- [ ] **Step 8: Run all acquisition suites and commit**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run tests/acquisition --coverage.enabled=false` — expected PASS.

```bash
git add apps/api-worker/scripts/build-acquisition.ts apps/api-worker/scripts/acquisition/tables apps/api-worker/tests/acquisition apps/api-worker/src/chara/data/acquisition.en.json apps/api-worker/src/chara/data/acquisition.meta.json .gitattributes
git commit --only -m "feat(api-worker): build the GPOSERS acquisition table" -m "Pinned Teamcraft <sha> + XIVAPI <version>; relic and random-container lists reviewed by the user." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/api-worker/scripts/build-acquisition.ts apps/api-worker/scripts/acquisition/tables apps/api-worker/tests/acquisition apps/api-worker/src/chara/data/acquisition.en.json apps/api-worker/src/chara/data/acquisition.meta.json .gitattributes
```

(Replace `<sha>` and `<version>` with the values the build printed.)

---

### Task 5: Serve the line on `POST /v1/chara/resolve`

**Files:**
- Create: `apps/api-worker/src/chara/acquisition.ts`
- Modify: `apps/api-worker/src/chara/types.ts` (`ResolvedCharaItem`)
- Modify: `apps/api-worker/src/chara/resolver.ts` (`pickItem`, around line 78)
- Test: `apps/api-worker/src/chara/acquisition.test.ts`, `apps/api-worker/src/chara/resolver.test.ts`

**Interfaces:**
- Consumes: `src/chara/data/acquisition.en.json` (Task 4).
- Produces: `acquisitionFor(itemId: number): string | undefined`; `ResolvedCharaItem.acquisition?: string` (read by the web-app in Task 7).

- [ ] **Step 1: Write the failing tests**

Create `apps/api-worker/src/chara/acquisition.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { acquisitionFor } from './acquisition.js';

describe('acquisitionFor', () => {
  it('reads the build-time table', () => {
    expect(acquisitionFor(47252)).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
  });

  it('is undefined for an item the table does not know', () => {
    expect(acquisitionFor(-1)).toBeUndefined();
  });
});
```

In `apps/api-worker/src/chara/resolver.test.ts`, add below the existing imports:

```ts
vi.mock('./acquisition.js', () => ({
  acquisitionFor: (itemId: number) => (itemId === 47252 ? "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)" : undefined),
}));
```

(add `vi` to the `vitest` import if it is not there), and inside `describe('pickItem', …)`:

```ts
  it("adds the named item's acquisition line and omits the field when there is none", () => {
    const itemRow = (rowId: number): ItemRow => ({
      rowId,
      names: { en: `Item ${rowId}`, ja: '', de: '', fr: '' },
      iconId: null,
      modelMain: '1',
      modelSub: '0',
      slots: ['Legs'],
    });
    expect(pickItem([itemRow(47252)])?.acquisition).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
    expect(pickItem([itemRow(5)])).not.toHaveProperty('acquisition');
  });

  it("gives each twin its own line, never a sibling's", () => {
    const itemRow = (rowId: number): ItemRow => ({
      rowId,
      names: { en: `Item ${rowId}`, ja: '', de: '', fr: '' },
      iconId: null,
      modelMain: '1',
      modelSub: '0',
      slots: ['Legs'],
    });
    const item = pickItem([itemRow(47252), itemRow(5)]);
    expect(item?.itemId).toBe(5);
    expect(item).not.toHaveProperty('acquisition');
    expect(item?.alternates[0]).toEqual({
      itemId: 47252,
      names: expect.any(Object),
      acquisition: "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)",
    });
  });
```

(import `type ItemRow` from `./types.js` if the file does not already).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run src/chara/acquisition.test.ts src/chara/resolver.test.ts --coverage.enabled=false`
Expected: FAIL — unresolved `./acquisition.js`; the `pickItem` cases fail on `acquisition`.

- [ ] **Step 3: Implement**

Create `apps/api-worker/src/chara/acquisition.ts`:

```ts
/**
 * GPOSERS "Acquisition" lines — a build-time table, English only.
 *
 * `scripts/build-acquisition.ts` regenerates `data/acquisition.en.json`
 * (equippable items that have a line) after each patch from Teamcraft's data
 * files and XIVAPI; the worker never computes or fetches acquisition data at
 * request time. Missing means "no line": the glamour export leaves the field
 * for the player (spec: docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md).
 */

import table from './data/acquisition.en.json';

const lines = table as Record<string, string>;

export function acquisitionFor(itemId: number): string | undefined {
  return lines[String(itemId)];
}
```

In `apps/api-worker/src/chara/types.ts`, inside `interface ResolvedCharaItem` after `viaMainHand`:

```ts
  /**
   * Where the named item comes from, as one English line in the GPOSERS
   * submission format ("Crafted (WVR Lvl. 92) / Independent Merchant -
   * Urqopacha - Worlar's Echo (28,483 Gil)"). Omitted when the build-time
   * table has none. Describes `itemId` only; each alternate carries its own.
   */
  acquisition?: string;
```

Still in `types.ts`, widen the alternates entry to `Array<{ itemId: number; names: ItemNames; acquisition?: string }>`.

In `apps/api-worker/src/chara/resolver.ts`: add `import { acquisitionFor } from './acquisition.js';` beside the `regional-names.js` import, and replace `pickItem` with (the field is present only when there is a line):

```ts
/** Lowest row_id names the item; the rest are alternates, row_id ascending. */
export function pickItem(rows: readonly ItemRow[]): ResolvedCharaItem | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.rowId - b.rowId);
  const primary = sorted[0];
  const acquisition = acquisitionFor(primary.rowId);
  return {
    itemId: primary.rowId,
    names: withRegional(primary.rowId, primary.names),
    iconId: primary.iconId,
    familySize: sorted.length,
    alternates: sorted.slice(1, 1 + MAX_ALTERNATES).map((r) => {
      const line = acquisitionFor(r.rowId);
      return { itemId: r.rowId, names: withRegional(r.rowId, r.names), ...(line ? { acquisition: line } : {}) };
    }),
    viaMainHand: false,
    ...(acquisition ? { acquisition } : {}),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter xivdyetools-api-worker exec vitest run src/chara --coverage.enabled=false`
Expected: PASS — including every existing resolver and router case.

- [ ] **Step 5: Measure the worker bundle**

Run: `pnpm --filter xivdyetools-api-worker exec wrangler deploy --dry-run --outdir .wrangler/dry-run --env production`
Expected: a `Total Upload: … KiB / gzip: … KiB` line. Record it for the PR. If gzip exceeds 2,500 KiB, stop and report — the table would need trimming before it ships (Cloudflare's free-plan limit is 3 MiB compressed).

- [ ] **Step 6: Commit**

```bash
git add apps/api-worker/src/chara/acquisition.ts apps/api-worker/src/chara/acquisition.test.ts apps/api-worker/src/chara/types.ts apps/api-worker/src/chara/resolver.ts apps/api-worker/src/chara/resolver.test.ts
git commit --only -m "feat(api-worker): acquisition line on /v1/chara/resolve items" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/api-worker/src/chara/acquisition.ts apps/api-worker/src/chara/acquisition.test.ts apps/api-worker/src/chara/types.ts apps/api-worker/src/chara/resolver.ts apps/api-worker/src/chara/resolver.test.ts
```

---

### Task 6: Docs, version, gates and PR 1

**Files:**
- Modify: `apps/api-worker/docs/reference/chara.md` (response example + field table)
- Modify: `apps/api-worker/CLAUDE.md` (scripts list, beside `build-item-names.mjs`)
- Modify: `apps/api-worker/CHANGELOG.md`, `apps/api-worker/package.json` (0.14.6 → 0.15.0)
- Modify: `docs/versions.md`, `README.md` (api-worker rows)
- Modify: `docs/superpowers/README.md` (status column), this plan's and the spec's `**Status:**` lines

- [ ] **Step 1: Public docs**

In `apps/api-worker/docs/reference/chara.md`, add to the first item of the response example (after `"viaMainHand": false`):

```json
        "acquisition": "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)"
```

(add the comma the JSON needs), and a row to the field table after `items.OffHand.viaMainHand`:

```md
| `items.<slot>.acquisition` | Where the named item comes from, as one English line in the GPOSERS glamour-submission format — e.g. `Crafted (WVR Lvl. 92) / Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil)`. Omitted when unknown. Built after each patch from game data and Teamcraft's data files; describes `itemId`, not the alternates. |
```

- [ ] **Step 2: Maintainer notes**

In `apps/api-worker/CLAUDE.md`, beside the `scripts/build-item-names.mjs` line, add:

```
scripts/build-acquisition.ts  # Regenerates the GPOSERS acquisition table after a patch (Teamcraft at a pinned commit + XIVAPI); run from the repo root: pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts — review the printed relic and random-container lists, commit the output
```

Run `grep -rn "build-item-names" docs/projects/api-worker docs/operations` and add a matching mention of `build-acquisition.ts` next to each hit.

- [ ] **Step 3: Version and changelog**

Set `"version": "0.15.0"` in `apps/api-worker/package.json`, and update the api-worker rows in `docs/versions.md` and the root `README.md` to `0.15.0` (`pnpm docs:check-versions` enforces both).

Add at the top of `apps/api-worker/CHANGELOG.md`, dated the day of the commit:

```md
## [0.15.0] - YYYY-MM-DD

### Added

- **`acquisition` on each resolved item** (`POST /v1/chara/resolve`): where the named item comes
  from, as one English line in the GPOSERS submission format ("Crafted (WVR Lvl. 92) /
  Independent Merchant - Urqopacha - Worlar's Echo (28,483 Gil)"). Omitted when unknown. The
  table is built by hand after each patch by `scripts/build-acquisition.ts` from Teamcraft's data
  files (MIT, one pinned commit) and XIVAPI, and ships with the worker
  (`src/chara/data/acquisition.en.json`, provenance in `acquisition.meta.json`); nothing is
  fetched at request time. Design: `docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md`.
```

- [ ] **Step 4: Status lines**

Set the spec's and this plan's `**Status:**` to `in progress — PR 1 (api-worker) open, PR 2 (web-app) after #206`, and the `docs/superpowers/README.md` row's status column to the same.

- [ ] **Step 5: Run every gate**

```bash
pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker
pnpm test:scripts
pnpm dead-code:check
pnpm docs:check-versions
pnpm docs:check-links
```

Expected: all exit 0. `lint` includes knip for the api-worker workspace; a knip "unused export" means a stage exports something only a test uses — un-export it.

- [ ] **Step 6: Commit, push, open PR 1**

```bash
git add apps/api-worker/docs/reference/chara.md apps/api-worker/CLAUDE.md apps/api-worker/CHANGELOG.md apps/api-worker/package.json docs/versions.md README.md docs/superpowers
git commit --only -m "docs(api-worker): 0.15.0 — acquisition on /v1/chara/resolve" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/api-worker/docs/reference/chara.md apps/api-worker/CLAUDE.md apps/api-worker/CHANGELOG.md apps/api-worker/package.json docs/versions.md README.md docs/superpowers
git push -u origin feat/glamour-acquisition
```

Open the PR against `main` with `gh pr create`: summary, the six acceptance lines, the meta counts, the bundle size from Task 5 Step 5, the user's table review, and the gate results. Merging deploys the api-worker; the web-app ignores the new field until PR 2.

---

### Task 7: The web-app export (PR 2, stacked on #206)

> **Superseded 2026-09-27.** The web-app half is now the Glamour Reader's export sheet (design 2c) — see [`2026-09-27-glamour-reader.md`](2026-09-27-glamour-reader.md), Task B6. The steps below are kept as the record.

**Files:**
- Modify: `apps/web-app/src/services/chara-resolve-service.ts` (`CharaResolvedItem`)
- Modify: `apps/web-app/src/shared/glamour-markdown.ts` (`GlamourMarkdownPiece`, `groups()`, header comment)
- Modify: `apps/web-app/src/components/glamour-list-actions.ts` (`glamourMarkdownInput()`)
- Test: `apps/web-app/src/shared/__tests__/glamour-markdown.test.ts`, create `apps/web-app/src/components/__tests__/glamour-list-actions.test.ts`
- Modify: `apps/web-app/package.json` (→ 5.13.0), `apps/web-app/CHANGELOG.md`, `apps/web-app/CHANGELOG-laymans.md`, root `CHANGELOG-laymans.md` (product → 5.10.0, its own commit), `docs/versions.md`, `README.md`

**Interfaces:**
- Consumes: `acquisition?: string` on each `/v1/chara/resolve` item (Task 5).
- Produces: `GlamourMarkdownPiece.acquisition?: string | null`.

- [ ] **Step 1: Worktree**

From the main checkout (if #206 has merged, use `origin/main` as the base instead):

```bash
git fetch origin claude/zen-dijkstra-llw78l
git worktree add .claude/worktrees/glamour-acquisition-web -b feat/glamour-acquisition-web origin/claude/zen-dijkstra-llw78l
cd .claude/worktrees/glamour-acquisition-web && pnpm install --frozen-lockfile && pnpm turbo run build --filter=xivdyetools-web-app...
```

- [ ] **Step 2: Write the failing tests**

In `apps/web-app/src/shared/__tests__/glamour-markdown.test.ts`, inside `describe('buildGlamourMarkdown', …)`:

```ts
  it('writes the Acquisition value when the piece has one, trimmed, in every rendering', () => {
    const input: GlamourMarkdownInput = {
      Head: { name: 'Mountain Linen Field Dressing of Aiming', dye1: 'Loam Brown', acquisition: '  Crafted (WVR Lvl. 92)  ' },
    };
    expect(buildGlamourMarkdown(input)).toContain('Dye 1: Loam Brown\nAcquisition: Crafted (WVR Lvl. 92)\n');
    expect(buildGlamourPlainText(input)).toContain('Acquisition: Crafted (WVR Lvl. 92)');
    expect(buildGlamourHtml(input)).toContain('Acquisition: Crafted (WVR Lvl. 92)');
  });
```

Create `apps/web-app/src/components/__tests__/glamour-list-actions.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@services/index', () => ({
  LanguageService: { getCurrentLocale: () => 'en' },
  ToastService: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@shared/dye-name', () => ({ localizedDyeName: (dye: { name: string }) => dye.name }));

import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import type { CharaResolveResult } from '@services/chara-resolve-service';
import { glamourMarkdownInput } from '../glamour-list-actions';

const resolved = {
  gearModels: [
    { slot: 'Legs', base: 1, variant: 1 },
    { slot: 'Feet', base: 2, variant: 1 },
  ],
  gearDyes: [],
  glassesId: null,
} as unknown as ResolvedCharaCharacter;

function item(itemId: number, en: string, acquisition?: string): Record<string, unknown> {
  return {
    itemId,
    names: { en, ja: en, de: en, fr: en },
    iconId: null,
    familySize: 1,
    alternates: [],
    viaMainHand: false,
    ...(acquisition ? { acquisition } : {}),
  };
}

describe('glamourMarkdownInput', () => {
  it('carries the resolved acquisition line onto the piece, and nothing when there is none', () => {
    const equipment = {
      version: 'test',
      items: {
        Legs: item(47252, 'Critical Hit C-1 Tour Cargo Trousers', "Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)"),
        Feet: item(1, 'Plain Shoes'),
      },
    } as unknown as CharaResolveResult;
    const input = glamourMarkdownInput({ resolved, equipment });
    expect(input.Legs?.acquisition).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
    expect(input.Feet?.acquisition).toBeUndefined();
  });
});
```

Run: `pnpm --filter xivdyetools-web-app exec vitest run src/shared/__tests__/glamour-markdown.test.ts src/components/__tests__/glamour-list-actions.test.ts --coverage.enabled=false`
Expected: FAIL — the markdown case writes a bare `Acquisition:`; `input.Legs.acquisition` is undefined.

- [ ] **Step 3: Implement**

In `apps/web-app/src/services/chara-resolve-service.ts`, inside `interface CharaResolvedItem`:

```ts
  /**
   * Where the piece comes from, as one English line in the GPOSERS submission
   * format (api-worker ≥ 0.15.0). Absent when unknown; the glamour export then
   * leaves its Acquisition line for the player.
   */
  acquisition?: string;
```

In `apps/web-app/src/shared/glamour-markdown.ts`:
- in `interface GlamourMarkdownPiece` add:

```ts
  /** The api-worker's GPOSERS acquisition line (English); the label stays bare without it */
  acquisition?: string | null;
```

- in `groups()` replace `group.push({ label: 'Acquisition:', value: '', bold: false });` with:

```ts
    group.push({ label: 'Acquisition:', value: text(piece.acquisition), bold: false });
```

- in the header comment, replace "and an `Acquisition:` line the submitter fills in by hand" with "and an `Acquisition:` line — filled from the api-worker's build-time table when it knows the piece, left for the submitter otherwise", and "the player adds the acquisition notes and anything the file cannot carry" with "the player adds anything the file and the table cannot carry".

In `apps/web-app/src/components/glamour-list-actions.ts`, in `glamourMarkdownInput()`'s first loop, after the `piece.name` line:

```ts
    if (item?.acquisition && !piece.acquisition) piece.acquisition = item.acquisition;
```

Update the function's doc comment: after "Names are the same `itemNameFor` the rows show;" add "the Acquisition line is the resolve's own English line when it has one;".

- [ ] **Step 4: Run the tests to verify they pass**

Run the Step 2 command again — expected PASS; then `pnpm --filter xivdyetools-web-app exec vitest run src/shared src/components --coverage.enabled=false` — expected PASS, including the unchanged "blank Acquisition" template test.

- [ ] **Step 5: Versions, changelogs, docs**

- `apps/web-app/package.json` → `5.13.0`; `docs/versions.md` and root `README.md` web-app rows → `5.13.0`.
- `apps/web-app/CHANGELOG.md`, at the top (date = the commit's, `YYYY-MM-DD`):

```md
## [5.13.0] - YYYY-MM-DD

### Added

- **The glamour export fills its `Acquisition:` line** (Export .md and Copy list, all three
  renderings) from the `acquisition` field api-worker 0.15.0 adds to `POST /v1/chara/resolve`
  items: one English line in the GPOSERS format, for the named item. `GlamourMarkdownPiece` gains
  `acquisition`; `glamourMarkdownInput()` copies it from the resolve. A piece without one keeps
  the bare label, as before. Design: `docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md`.
```

- `apps/web-app/CHANGELOG-laymans.md` (What's New, machine-parsed), above the 5.12.5 entry, dated like the entries below it ("September 27, 2026"):

```md
## Web-App Version 5.13.0 — Month D, YYYY

### Your glamour list says where each piece comes from
- **Export .md and Copy list now fill in the Acquisition line.** In the Swatch Matcher, each piece's line follows the GPOSERS format: crafted, sold by, dropped in, the Online Store and more.
- **Anything it can't be sure of stays blank,** for you to fill in as before.
- The lines are in English, like the rest of the GPOSERS form.
```

- Root `CHANGELOG-laymans.md` (product; the Discord announcement's strict grammar), above the newest entry — **its own commit** (`docs(changelog): player notes for 5.10.0`):

```md
## [5.10.0] - YYYY-MM-DD

### 🧥 Glamour lists say where each piece comes from
- The Swatch Matcher's Export .md and Copy list now fill in each piece's Acquisition line in the GPOSERS format — crafted, sold by, dropped in, the Online Store and more.
- Anything the tool can't be sure of stays blank for you to fill in.
```

- `grep -rn "Acquisition" docs/projects/web-app docs/user-guides` — update each description of the export to say the line is filled when the data knows the piece.

- [ ] **Step 6: Gates**

```bash
pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app
pnpm --filter xivdyetools-web-app run build:check
pnpm dead-code:check
pnpm docs:check-versions
pnpm docs:check-links
```

Expected: all exit 0 (the web-app and discord-worker changelog-parser suites run inside `test`).

- [ ] **Step 7: Commit, push, open PR 2**

Commit the code + web-app docs, then the root player changelog separately, each with `git commit --only -- <paths>` and the Co-Authored-By trailer. Push `feat/glamour-acquisition-web` and open the PR with base `claude/zen-dijkstra-llw78l` (retarget to `main` once #206 merges), linking PR 1 and noting it needs api-worker 0.15.0 deployed to show lines (it is harmless without it). Merging it deploys the web-app and posts the 5.10.0 announcement.

After both PRs merge: set the spec's and this plan's `**Status:**` and the README row to `Shipped — PR <1>, PR <2>`.

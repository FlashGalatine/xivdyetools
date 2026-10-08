/**
 * Build the GPOSERS "Acquisition" table for `POST /v1/chara/resolve`.
 *
 * A BUILD-TIME step, run by hand after each patch (after build-item-names.mjs),
 * from the repository root:
 *
 *   pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts
 *   pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts --fixture 47878,42027
 *   pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts --pinned
 *
 * Inputs: Teamcraft's data files at ONE pinned commit (MIT) and XIVAPI v2 at one
 * game version. Output: src/chara/data/acquisition.en.json
 * ({ "<itemId>": "<line>" } for equipment and facewear unlock items that have a line),
 * facewear-unlocks.json (Glasses row → unlock Item), and acquisition.meta.json.
 * `--fixture` writes the normalized inputs for the given
 * items to tests/acquisition/fixtures/inputs.json instead of the table.
 * `--pinned` reuses the Teamcraft commit and XIVAPI version the current
 * acquisition.meta.json records instead of pinning the newest ones — for a rule
 * change, so the table diff shows the rule and nothing else.
 * Design: docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatEntries } from './acquisition/format.js';
import { facewearUnlocks, type FacewearStyle, type FacewearUnlock } from './acquisition/facewear.js';
import { buildInputs, fateZoneLevels, tablesFrom, type RawFiles, type RelicRule, type TableFiles, type XivapiExtras } from './acquisition/inputs.js';
import { markerCoordinate, nearestSettlement, type MapLabel } from './acquisition/labels.js';
import type { Inputs, Tables } from './acquisition/model.js';
import { overrideLine, selectEntries } from './acquisition/select.js';
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

/** Equippable item → UI category name, plus its English name. */
async function equippableItems(): Promise<{ categories: Map<number, string>; names: Map<number, string> }> {
  type Page = {
    results: Array<{ row_id: number; fields: { Name?: string; ItemUICategory?: { fields?: { Name?: string } } } }>;
    next?: string;
  };
  const out = { categories: new Map<number, string>(), names: new Map<number, string>() };
  // A cursor page answers with default fields unless `fields` is sent again.
  const fields = 'Name,ItemUICategory.Name';
  let page = await xivapi<Page>('search', { sheets: 'Item', query: 'EquipSlotCategory>0', fields, limit: '500' });
  for (;;) {
    for (const r of page.results) {
      out.categories.set(r.row_id, r.fields.ItemUICategory?.fields?.Name ?? '');
      out.names.set(r.row_id, r.fields.Name ?? '');
    }
    if (!page.next) return out;
    page = await xivapi<Page>('search', { cursor: page.next, fields, limit: '500' }, false);
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
  type Marker = {
    row_id: number;
    fields: { X: number; Y: number; Icon?: { id?: number }; DataType?: number; PlaceNameSubtext?: { fields?: { Name?: string } } };
  };
  const page = await xivapi<{ rows: Marker[] }>('sheet/MapMarker', {
    after: String(range - 1),
    limit: '500',
    fields: 'X,Y,Icon,DataType,PlaceNameSubtext.Name',
  });
  const labels: MapLabel[] = [];
  for (const { row_id, fields } of page.rows) {
    const name = fields.PlaceNameSubtext?.fields?.Name;
    if (row_id !== range || !name) continue;
    labels.push({
      name,
      x: markerCoordinate(fields.X, sizeFactor),
      y: markerCoordinate(fields.Y, sizeFactor),
      icon: fields.Icon?.id ?? 0,
      dataType: fields.DataType ?? 0,
    });
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
      const label = position ? nearestSettlement(labels, position.x, position.y) : null;
      if (label) out.set(id, label);
    }
  }
  return out;
}

/**
 * FATE location → zone name. `Fate.Location` is not a `Level` row for most
 * FATEs (XIVAPI answers 404), so the zone comes from Teamcraft's FATE database
 * pages instead: each FATE's map, and that map's place name.
 */
async function fateLocationZones(sha: string, raw: RawFiles): Promise<{ levelZones: Map<number, string>; overworld: Set<string> }> {
  const pages = await getJson<Record<string, { map?: number }>>(
    `https://raw.githubusercontent.com/${TEAMCRAFT_REPO}/${sha}/${TEAMCRAFT_DIR}/db/fates-database-pages.json`
  );
  const placed = Object.values(pages).find((p) => typeof p.map === 'number');
  if (!placed) throw new Error('Teamcraft db/fates-database-pages.json changed shape — expected { map }; update fateLocationZones');
  const levelZones = new Map<number, string>();
  const territories = new Map<number, string>();
  for (const [id, fate] of Object.entries(raw.fates)) {
    const mapId = pages[id]?.map;
    const map = mapId !== undefined ? raw.maps[mapId] : undefined;
    const zone = map ? raw.places[map.placename_id]?.en : undefined;
    if (!map || !zone || fate.location <= 0) continue;
    levelZones.set(fate.location, zone);
    territories.set(map.territory_id, zone);
  }
  const uses = await rows<{ TerritoryIntendedUse?: Link }>('TerritoryType', territories.keys(), 'TerritoryIntendedUse.value');
  const overworld = new Set([...uses].filter(([, row]) => row.TerritoryIntendedUse?.value === 1).map(([id]) => territories.get(id) ?? ''));
  return { levelZones, overworld };
}

/** The `n` largest counts, largest first — a meta diff shows a new vendor or currency taking over. */
function top(counts: Record<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n));
}

function readTable<T>(file: string): T {
  return JSON.parse(readFileSync(join(TABLES_DIR, file), 'utf8')) as T;
}

/** Spot checks and "every rule still matches something" (spec D11). */
function checkRelics(rules: RelicRule[], inputs: Inputs): void {
  const problems: string[] = [];
  for (const rule of rules) {
    const count = [...inputs.relics.values()].filter((saga) => saga === rule.saga).length;
    const hasRules = rule.sheets.length + rule.shops.length + rule.zones.length + rule.names.length + rule.toolNames.length + rule.include.length > 0;
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
    unmappedTokens: [...inputs.unmappedTokens].filter((id) => keep.has(id)),
    highEndDuties: [...inputs.highEndDuties].filter((id) => dutyIds.has(id)),
    deepDungeons: [...inputs.deepDungeons].filter((id) => dutyIds.has(id)),
    towns: [...inputs.towns],
    zoneOrder: [...inputs.zoneOrder],
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
  // Exchanges paid only in Miscellany items with no duty behind them: raid and
  // trial tokens Teamcraft has no drop data for belong in duty-tokens.json.
  const relicLike = /Replica|Zenith|Zeta|Animus|Anima|Awoken|Hyperconductive|Anemos|Pagos|Elemental|Pyros|Hydatos|Law's Order|Blade's|Manderville|Skysteel|Dragonsung|Skysung|Splendorous|Crystalline|Unfinished|Phantom/;
  const equippedNames = await rows<{ Name: string }>(
    'Item',
    [...inputs.offers.keys()].filter((id) => !inputs.relics.has(id)),
    'Name'
  );
  const misses = [...equippedNames].filter(([, row]) => relicLike.test(row.Name)).map(([, row]) => row.Name);
  console.log(`
Relic-looking names in NO saga (review — a miss here is a wrong or blank line): ${misses.length}`);
  console.log(`  ${misses.sort().join('; ')}`);

  const tokenish = new Map<number, number>();
  for (const offers of inputs.offers.values()) {
    for (const { costs } of offers) {
      const pure =
        costs.length > 0 &&
        costs.every((c) => inputs.items.get(c.itemId)?.uiCategory === 61 && !inputs.duties.has(c.itemId));
      if (pure) for (const c of costs) tokenish.set(c.itemId, (tokenish.get(c.itemId) ?? 0) + 1);
    }
  }
  console.log('\nMiscellany-only exchanges with no duty data (review for duty-tokens.json):');
  for (const [id, n] of [...tokenish].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id} ${inputs.items.get(id)?.name} — ${n} offers`);
  }

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
  const pinned = process.argv.includes('--pinned')
    ? (JSON.parse(readFileSync(join(DATA_DIR, 'acquisition.meta.json'), 'utf8')) as { teamcraftCommit: string; xivapiVersion: string })
    : null;
  if (pinned) gameVersion = pinned.xivapiVersion;

  const sha = pinned?.teamcraftCommit ?? (await pinTeamcraft());
  console.log(pinned ? `Teamcraft ${sha} and XIVAPI ${gameVersion}, as acquisition.meta.json records` : `Teamcraft staging pinned at ${sha}`);
  const raw = await loadTeamcraft(sha);
  const rules = readTable<RelicRule[]>('relic-sagas.json');
  const tableFiles: TableFiles = {
    gacha: readTable('gacha-containers.json'),
    eurekaLockboxes: readTable('eureka-lockboxes.json'),
    ishgardDistricts: readTable('ishgard-districts.json'),
  };

  const { categories: equippable, names: equippableNames } = await equippableItems();
  console.log(`XIVAPI ${gameVersion}: ${equippable.size} equippable items`);
  const equippableCount = equippable.size;
  const unlocks = await xivapi<{ results: FacewearUnlock[]; next?: string }>('search', {
    sheets: 'Item', query: 'Name~"The Faces We Wear - "', fields: 'Name,AdditionalData.value', limit: '500',
  });
  const styles = await xivapi<{ rows: FacewearStyle[]; next?: unknown }>('sheet/GlassesStyle', {
    fields: 'Name,Glasses[].value,Glasses[].Name', limit: '500',
  });
  if (unlocks.next || styles.next) throw new Error('Facewear sheet exceeded one page; add pagination before regenerating');
  const facewear = facewearUnlocks(unlocks.results, styles.rows);
  for (const unlock of unlocks.results) {
    equippable.set(unlock.row_id, 'Miscellany');
    equippableNames.set(unlock.row_id, unlock.fields.Name);
  }
  console.log(`${unlocks.results.length} facewear unlock items for ${Object.keys(facewear).length} Glasses rows`);
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
  const territoryIds = npcIds.flatMap((id) => {
    const map = raw.npcs[id]?.position?.map;
    const territory = map !== undefined ? raw.maps[map]?.territory_id : undefined;
    return territory !== undefined ? [territory] : [];
  });
  const territoryRows = await rows<{ ExVersion?: Link; TerritoryIntendedUse?: Link }>(
    'TerritoryType',
    territoryIds,
    'ExVersion.value,TerritoryIntendedUse.value'
  );
  const specialIds = sellers.filter((s) => s.type === 'SpecialShop').map((s) => s.id);
  const specialRows = await rows<{ RequiredFestival?: Link; UseCurrencyType?: number }>(
    'SpecialShop',
    specialIds,
    'RequiredFestival.value,UseCurrencyType'
  );

  const { levelZones, overworld } = await fateLocationZones(sha, raw);
  const ishgard = new Set(tableFiles.ishgardDistricts);
  const wilderness = new Set([...fateZoneLevels(raw, levelZones, overworld).keys()].filter((zone) => !ishgard.has(zone)));

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
    overworld,
    expansions: new Map([...territoryRows].map(([id, row]) => [id, row.ExVersion?.value ?? 0])),
    territoryUses: new Map([...territoryRows].map(([id, row]) => [id, row.TerritoryIntendedUse?.value ?? -1])),
    festivalShops: new Set([...specialRows].filter(([, row]) => (row.RequiredFestival?.value ?? 0) > 0).map(([id]) => id)),
    // In UseCurrencyType 16 shops Teamcraft reads a tomestone price (CostType 2)
    // as a retired Red scrip; inputs.ts marks those offers' costs unknown.
    unknownCostShops: new Set([...specialRows].filter(([, row]) => row.UseCurrencyType === 16).map(([id]) => id)),
    dutyTokens: new Map(
      Object.entries(readTable<Record<string, { name: string; duties: string[] }>>('duty-tokens.json'))
        .filter(([id]) => /^\d+$/.test(id))
        .map(([id, token]) => [Number(id), token.duties])
    ),
    outposts: await outpostsFor(npcIds, raw, wilderness),
    relicSheetItems: await relicSheetItems(rules),
    names: equippableNames,
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
  const costCurrencies: Record<string, number> = {};
  const vendorNpcs: Record<string, number> = {};
  const dropped: Record<string, number> = {};
  let sourcesButNoLine = 0;
  for (const itemId of [...equippable.keys()].sort((a, b) => a - b)) {
    const fixed = overrideLine(equippableNames.get(itemId) ?? '');
    if (fixed) {
      table[itemId] = fixed;
      entryCounts['override'] = (entryCounts['override'] ?? 0) + 1;
      continue;
    }
    const sources = collectSources(itemId, inputs);
    const selection = selectEntries(sources, inputs, tables);
    for (const reason of selection.dropped) dropped[reason] = (dropped[reason] ?? 0) + 1;
    const line = formatEntries(selection.entries, inputs, tables);
    if (line) {
      table[itemId] = line;
      for (const kind of new Set(selection.entries.map((e) => e.kind))) entryCounts[kind] = (entryCounts[kind] ?? 0) + 1;
      for (const entry of selection.entries) {
        if (entry.kind !== 'vendor' && entry.kind !== 'scrip') continue;
        const costs = entry.kind === 'vendor' ? entry.costs : [entry.cost];
        for (const c of costs) {
          const name = c.itemId === 1 ? 'Gil' : (inputs.items.get(c.itemId)?.name ?? String(c.itemId));
          costCurrencies[name] = (costCurrencies[name] ?? 0) + 1;
        }
        if (entry.kind === 'vendor') vendorNpcs[entry.npc.name] = (vendorNpcs[entry.npc.name] ?? 0) + 1;
      }
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
    equippable: equippableCount,
    facewearUnlockItems: unlocks.results.length,
    facewearVariants: Object.keys(facewear).length,
    lines: Object.keys(table).length,
    sourcesButNoLine,
    bytes: Buffer.byteLength(json),
    itemsPerRoute: entryCounts,
    dropped,
    relicSagas: sagas,
    topCostCurrencies: top(costCurrencies, 25),
    topVendorNpcs: top(vendorNpcs, 25),
    unleveledVendorZones: [...new Set([...inputs.npcs.values()].map((n) => n.zone).filter((z): z is string => z !== null && !inputs.zoneLevels.has(z)))].sort(),
  };
  writeFileSync(join(DATA_DIR, 'acquisition.en.json'), json);
  writeFileSync(join(DATA_DIR, 'facewear-unlocks.json'), `${JSON.stringify(facewear)}\n`);
  writeFileSync(join(DATA_DIR, 'acquisition.meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`wrote ${meta.lines} lines (${meta.bytes} bytes) to src/chara/data/acquisition.en.json`);
  await printReview(inputs, tables, raw);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

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
  /** `contentType`: 4 trials, 5 raids, 21 Deep Dungeons, 28 Ultimate, 30 Variant & Criterion */
  instances: Record<string, { en: string; contentType?: number }>;
  instanceSources: Record<string, number[]>;
  lootSources: Record<string, number[]>;
  mogstationSources: Record<string, unknown>;
  recipesPerItem: Record<string, Array<{ job: number; lvl: number }>>;
  questSources: Record<string, number[]>;
  quests: Record<string, { name: { en: string }; rewards?: Array<{ id: number; amount: number }> }>;
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
  /**
   * Zones whose territory is overworld (`TerritoryIntendedUse` 1). Only their
   * FATEs level a zone or make it wilderness: seasonal events also run FATEs in
   * towns (Hatching-tide in Old Gridania) and Cosmic Exploration on the moon.
   */
  overworld: Set<string>;
  /** TerritoryType → ExVersion (0 A Realm Reborn … 5 Dawntrail) */
  expansions: Map<number, number>;
  /** SpecialShops that open only during a seasonal event */
  festivalShops: Set<number>;
  /** SpecialShops with `UseCurrencyType` 16, whose tomestone prices Teamcraft misreads */
  unknownCostShops: Set<number>;
  /** TerritoryType → TerritoryIntendedUse (0 town, 1 overworld, 60 Cosmic Exploration…) */
  territoryUses: Map<number, number>;
  /**
   * Hand-kept duty tokens Teamcraft has no drop data for (`tables/duty-tokens.json`):
   * token item → Duty Finder names. An empty list = a token whose duty is not known yet.
   */
  dutyTokens: Map<number, string[]>;
  /** Wilderness NPC → nearest settlement label on its map (`labels.ts`) */
  outposts: Map<number, string>;
  /** Relic sheet name → the item ids it lists */
  relicSheetItems: Map<string, number[]>;
  /** Equippable item → English name (for `RelicRule.toolNames`) */
  names: Map<number, string>;
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
  /** Item-name patterns, any category ("^Anemos " for Eureka armor). */
  names: string[];
  /**
   * Item-name patterns that count only DoH/DoL tools — for a saga no shop sells,
   * like the Cosmic tools, which Cosmic Exploration missions hand out.
   */
  toolNames: string[];
  /** Item-name patterns that count only weapons and shields ("^Unfinished " for the Zodiac line). */
  weaponNames: string[];
  include: number[];
  exclude: number[];
  /** Known answers: the build fails when one of these is not in the saga. */
  spotChecks: number[];
}

/** The hand-kept table files, parsed. */
export interface TableFiles {
  gacha: Array<{ id: number; name: string }>;
  cofferSources: Record<string, { name: string; line: string; random?: boolean }>;
  /** Container name → the guide's line */
  eurekaLockboxes: Record<string, string>;
  ishgardDistricts: string[];
}

/** Starting level of each expansion, by ExVersion. */
const EXPANSION_LEVEL = [1, 50, 60, 70, 80, 90];
const TOOL_CATEGORY = /(Primary|Secondary) Tool$/;
const WEAPON_CATEGORY = /(Arm|Arms|Grimoire|Shield)$/;
/**
 * Red Crafters' / Gatherers' Scrip: retired currencies that appear only where
 * Teamcraft misreads a `UseCurrencyType` 16 tomestone price (CostType 2).
 */
const MISREAD_TOMESTONE = new Set([10309, 10311]);
const CONTENT_DEEP_DUNGEON = 21;
const CONTENT_ULTIMATE = 28;
const CONTENT_VARIANT_CRITERION = 30;
const TOWN = 0;
const VOYAGE: Record<number, 'airship' | 'submarine'> = { 0: 'airship', 1: 'submarine' };

type RawShop = RawFiles['shops'][number];

/** The pinned Commendation Crystal exchange omits its placed NPC attachment. */
export function shopNpcIds(shop: Pick<RawShop, 'id' | 'npcs'>): number[] {
  if (shop.npcs.length > 0) return shop.npcs;
  return shop.id === 1770684 ? [1043099] : [];
}

/** Fixed quest rewards include coffers omitted by Teamcraft's quest-sources index. */
export function cofferQuestSources(raw: RawFiles, cofferIds: Set<number>): Record<string, number[]> {
  const sources = Object.fromEntries(Object.entries(raw.questSources).map(([id, quests]) => [id, [...quests]]));
  for (const [questId, quest] of Object.entries(raw.quests)) {
    for (const reward of quest.rewards ?? []) {
      if (!cofferIds.has(reward.id) || reward.amount <= 0) continue;
      const list = sources[reward.id] ?? [];
      if (!list.includes(Number(questId))) list.push(Number(questId));
      sources[reward.id] = list;
    }
  }
  return sources;
}

/** Reviewed missing/abbreviated NPC positions; keyed by resident, never by shared name. */
const NPC_LOCATIONS = new Map<number, { zone: string; outpost: string | null }>([
  [1054944, { zone: 'Il Mheg', outpost: 'Wolekdorf' }],
  [1059408, { zone: 'Central Shroud', outpost: 'Bentbranch Meadows' }],
  [1059485, { zone: 'The Occult Crescent: North Horn', outpost: null }],
  [1053614, { zone: 'The Occult Crescent: South Horn', outpost: null }],
]);

/** Overworld zone → its lowest FATE level. The zones listed are the wilderness (spec D10). */
export function fateZoneLevels(raw: RawFiles, levelZones: Map<number, string>, overworld: Set<string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const fate of Object.values(raw.fates)) {
    const zone = levelZones.get(fate.location);
    if (!zone || !overworld.has(zone) || fate.level <= 0) continue;
    out.set(zone, Math.min(fate.level, out.get(zone) ?? Number.MAX_SAFE_INTEGER));
  }
  return out;
}

export function buildInputs(raw: RawFiles, extras: XivapiExtras, rules: RelicRule[]): Inputs {
  const cofferIds = new Set([...extras.items].filter(([, item]) => /\bCoffer\b/.test(item.name)).map(([id]) => id));
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
    const shop: Shop = {
      id: s.id,
      name: shopName(s),
      npcIds: shopNpcIds(s),
      festival: extras.festivalShops.has(s.id),
    };
    const misreads = extras.unknownCostShops.has(s.id);
    for (const trade of s.trades) {
      const costs = trade.currencies.filter((c) => c.amount > 0).map((c) => ({ itemId: c.id, amount: c.amount }));
      for (const product of trade.items) {
        if (!extras.equippable.has(product.id) && !cofferIds.has(product.id)) continue;
        const unknownCosts = misreads && costs.some((c) => MISREAD_TOMESTONE.has(c.itemId));
        push(offers, product.id, { shop, costs, unknownCosts });
        shop.npcIds.forEach((id) => npcIds.add(id));
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
      zone: NPC_LOCATIONS.get(id)?.zone ?? zoneOfNpc(id),
      outpost: NPC_LOCATIONS.has(id) ? NPC_LOCATIONS.get(id)!.outpost : extras.outposts.get(id) ?? null,
      unreachable: map ? map.dungeon || map.housing : false,
    });
  }

  const zoneLevels = fateZoneLevels(raw, extras.levelZones, extras.overworld);
  const towns = new Set<string>();
  const zoneOrder = new Map<string, number>();
  for (const map of Object.values(raw.maps)) {
    const zone = raw.places[map.placename_id]?.en;
    if (!zone) continue;
    const expansion = extras.expansions.get(map.territory_id);
    if (expansion !== undefined && !zoneLevels.has(zone)) zoneLevels.set(zone, EXPANSION_LEVEL[expansion] ?? 1);
    if (extras.territoryUses.get(map.territory_id) === TOWN) towns.add(zone);
    if (map.territory_id > 0) zoneOrder.set(zone, Math.min(map.territory_id, zoneOrder.get(zone) ?? Number.MAX_SAFE_INTEGER));
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
  const unmappedTokens = new Set<number>();
  const dutyByName = new Map(Object.entries(raw.instances).map(([id, d]) => [dutyName(d.en), Number(id)]));
  for (const [token, names] of extras.dutyTokens) {
    if (names.length === 0) {
      unmappedTokens.add(token);
      continue;
    }
    const ids = names.map((name) => {
      const id = dutyByName.get(dutyName(name));
      if (id === undefined) throw new Error(`duty-tokens.json: token ${token} names "${name}", which is not a Teamcraft instance`);
      return id;
    });
    duties.set(token, [...new Set([...(duties.get(token) ?? []), ...ids])]);
  }
  const dutyNames = new Map<number, string>();
  const highEndDuties = new Set<number>();
  const deepDungeons = new Set<number>();
  for (const list of duties.values()) {
    for (const id of list) {
      const instance = raw.instances[id];
      if (!instance?.en) continue;
      const name = dutyName(instance.en);
      dutyNames.set(id, name);
      if (instance.contentType === CONTENT_DEEP_DUNGEON) deepDungeons.add(id);
      else if (isHighEnd(name, instance.contentType)) highEndDuties.add(id);
    }
  }

  const quests = numberLists(cofferQuestSources(raw, cofferIds));
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
    unmappedTokens,
    highEndDuties,
    deepDungeons,
    towns,
    zoneOrder,
  };
}

/**
 * Savage, Extreme, Ultimate, Variant and Criterion duties (Mar 2026 reminders:
 * their token gear lists the duty, not the vendor). The Minstrel's Ballad
 * trials are Extreme without the suffix.
 */
function isHighEnd(name: string, contentType: number | undefined): boolean {
  if (contentType === CONTENT_ULTIMATE || contentType === CONTENT_VARIANT_CRITERION) return true;
  return /\((Savage|Extreme|Ultimate)\)$/.test(name) || /^The Minstrel's Ballad: /.test(name);
}

/** The Duty Finder name: game text markup stripped, spaces collapsed, a leading "the" capitalized. */
function dutyName(raw: string): string {
  const name = raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function tablesFrom(files: TableFiles, inputs: Inputs): Tables {
  const eurekaLockboxes = new Map<number, string>();
  for (const [id, item] of inputs.items) {
    const line = files.eurekaLockboxes[item.name];
    if (line) eurekaLockboxes.set(id, line);
  }
  return {
    gachaContainers: new Set(files.gacha.map((g) => g.id)),
    cofferSources: new Map(Object.entries(files.cofferSources).map(([id, source]) => [Number(id), source])),
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
    for (const s of raw.shops) {
      const name = shopName(s);
      const byName = shopPatterns.some((re) => re.test(name));
      const byZone = rule.zones.length > 0 && s.npcs.some((id) => rule.zones.includes(zoneOfNpc(id) ?? ''));
      if (!byName && !byZone) continue;
      for (const trade of s.trades) for (const { id } of trade.items) if (extras.equippable.has(id)) members.add(id);
    }
    const byName: Array<[RegExp, RegExp]> = [
      ...rule.names.map((p): [RegExp, RegExp] => [new RegExp(p), /(?:)/]),
      ...rule.toolNames.map((p): [RegExp, RegExp] => [new RegExp(p), TOOL_CATEGORY]),
      ...rule.weaponNames.map((p): [RegExp, RegExp] => [new RegExp(p), WEAPON_CATEGORY]),
    ];
    if (byName.length > 0) {
      for (const [id, category] of extras.equippable) {
        const name = extras.names.get(id) ?? '';
        if (byName.some(([re, kind]) => kind.test(category) && re.test(name))) members.add(id);
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

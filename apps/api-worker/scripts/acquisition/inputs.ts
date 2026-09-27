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
  /** Wilderness NPC → nearest map area label */
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
  /**
   * Item-name patterns that count only DoH/DoL tools — for a saga no shop sells,
   * like the Cosmic tools, which Cosmic Exploration missions hand out.
   */
  toolNames: string[];
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

  const zoneLevels = fateZoneLevels(raw, extras.levelZones, extras.overworld);
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
    for (const s of raw.shops) {
      const name = shopName(s);
      const byName = shopPatterns.some((re) => re.test(name));
      const byZone = rule.zones.length > 0 && s.npcs.some((id) => rule.zones.includes(zoneOfNpc(id) ?? ''));
      if (!byName && !byZone) continue;
      for (const trade of s.trades) for (const { id } of trade.items) if (extras.equippable.has(id)) members.add(id);
    }
    const toolPatterns = rule.toolNames.map((p) => new RegExp(p));
    if (toolPatterns.length > 0) {
      for (const [id, category] of extras.equippable) {
        const name = extras.names.get(id) ?? '';
        if (TOOL_CATEGORY.test(category) && toolPatterns.some((re) => re.test(name))) members.add(id);
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

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
  /** Nearest settlement on the map, wilderness NPCs only ("Worlar's Echo"); null when none is within 3 map units. */
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
  /**
   * The data can't state the price: in `UseCurrencyType` 16 shops Teamcraft
   * reads a tomestone price (CostType 2) as a retired Red scrip.
   */
  unknownCosts: boolean;
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
  /** Duty tokens whose duty is not known yet (`tables/duty-tokens.json` entries with no duty) */
  unmappedTokens: Set<number>;
  /** Savage, Extreme, Ultimate, Variant and Criterion duties: their tokens list the duty, not the exchange */
  highEndDuties: Set<number>;
  /** Deep Dungeon floor sets: listed only when they are an item's only source */
  deepDungeons: Set<number>;
  /** Zones that are towns (`TerritoryIntendedUse` 0): vendors there are always favored */
  towns: Set<string>;
  /** Zone → its TerritoryType id, the order the game added it in (earliest Cosmic Exploration zone first) */
  zoneOrder: Map<string, number>;
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

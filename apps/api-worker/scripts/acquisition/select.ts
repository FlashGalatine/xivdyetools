/**
 * Stage 2 of the acquisition build: which of an item's raw sources the line
 * shows, and in what form — spec D5–D12 plus the guide's own "only if"
 * clauses. Nothing here formats text.
 */

import type { Cost, Entry, Inputs, Npc, Offer, Source, Tables } from './model.js';

/** ItemUICategory rows of general currencies: 63 "Other" (gil, seals, marks, tomestones, MGP) and 100 "Currency". */
const CURRENCY_CATEGORIES = new Set([63, 100]);

const GRIDANIA = new Set(['New Gridania', 'Old Gridania']);
/** The ARR city-states: favored over every later city (Mar 2026 reminders). */
const MAIN_CITIES = new Set([
  'Limsa Lominsa Upper Decks',
  'Limsa Lominsa Lower Decks',
  'Ul\'dah - Steps of Nald',
  'Ul\'dah - Steps of Thal',
  'New Gridania',
  'Old Gridania',
]);

/** Emperor's New items: always this vendor (Mar 2026 reminders). */
const EMPEROR_LINE = 'Goberin - Western Thanalan - Vesper Bay';

/** A fixed line that replaces whatever the data says, or null. */
export function overrideLine(itemName: string, category?: string): string | null {
  if (/^(The )?Emperor's New /.test(itemName)) return EMPEROR_LINE;
  if (/^Templar's (Chain Coif|Haubergeon|Vambraces|Skirt|Sollerets)$/.test(itemName))
    return 'Dzemael Darkhold';
  if (/^(Great )?Shin-Zantetsuken$/.test(itemName)) return 'Baldesion Arsenal';
  const weapon = category !== undefined && /(?:Arm|Grimoire|Shield)$/.test(category);
  if (
    weapon &&
    (/First Light|Sacramental/.test(itemName) || /^Word of the (Blest|Radiant)$/.test(itemName))
  ) {
    return "Pilgrim's Traverse";
  }
  return null;
}

const SCRIP = / (Crafters'|Gatherers') Scrip$/;
const IRREGULAR_TOMESTONE = /^Irregular Tomestone of /;

/**
 * NPCs whose shops only sell back what a player once earned (spec D8,
 * widened): the Calamity and journeyman salvagers (quest, achievement, event,
 * ceremony and old-gear repurchases) and the recompense officers (past
 * seasonal events). The MGF trader ran a limited-time collaboration.
 */
const REPURCHASE_NPC = /^(Calamity salvager|journeyman salvager|recompense officer|MGF trader)$/i;

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
  const desynths: Entry[] = [];
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
    const reviewed = tables.cofferSources.get(containerId);
    if (reviewed) {
      (reviewed.random ? gacha : rest).push({ kind: 'container', containerId });
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
    else {
      const offers = inputs.offers.get(containerId) ?? [];
      if (offers.length > 0) offers.forEach(addOffer);
      else rest.push({ kind: 'container', containerId });
    }
  }

  function addOffer(offer: Offer): void {
    const repurchaseNpcs =
      offer.shop.npcIds.length > 0 &&
      offer.shop.npcIds.every((id) => REPURCHASE_NPC.test(inputs.npcs.get(id)?.name ?? ''));
    if (/^Repurchase\b/.test(offer.shop.name) || repurchaseNpcs) {
      dropped.push('repurchaseShop');
      return;
    }
    if (offer.shop.festival) {
      dropped.push('seasonalShop');
      return;
    }
    if (offer.unknownCosts) {
      dropped.push('unknownCost');
      return;
    }
    if (offer.costs.some((c) => inputs.unmappedTokens.has(c.itemId))) {
      dropped.push('tokenWithoutDuty');
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
      case 'desynth':
        desynths.push(source);
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

  const dutyEntries = (ids: number[]): Entry[] => ids.sort((a, b) => a - b).map((dutyId): Entry => ({ kind: 'duty', dutyId }));
  const deep = [...duties].filter((d) => inputs.deepDungeons.has(d));
  const entries: Entry[] = [...dutyEntries([...duties].filter((d) => !inputs.deepDungeons.has(d))), ...rest];
  // "Only if it is the only source" (guide + Mar 2026 reminders), judged against
  // the complete source set: a quest beside a random container is not the only
  // source, and neither is the container, so both drop.
  const onlySource: Array<[Entry[], string]> = [
    [[...quests].map((questId): Entry => ({ kind: 'quest', questId })), 'questNotOnlySource'],
    [dutyEntries(deep), 'deepDungeonNotOnlySource'],
    [desynths, 'desynthNotOnlySource'],
    [gacha, 'gachaNotOnlySource'],
  ];
  const present = onlySource.filter(([candidates]) => candidates.length > 0);
  const [only] = present;
  if (entries.length === 0 && only && present.length === 1) entries.push(...only[0]);
  else for (const [, reason] of present) dropped.push(reason);
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
  // Mar 2026 reminders: only Savage, Extreme, Ultimate, Variant and Criterion
  // token gear lists the duty; any other token keeps its vendor and currency.
  if (!duties.every((d) => inputs.highEndDuties.has(d))) return null;
  return duties;
}

/**
 * Spec D9 as the Mar 2026 reminders refine it: Gridania; else a main (ARR)
 * city; else any city; else the field — each by the lowest zone level, then
 * the earliest zone (the first Cosmic Exploration zone), then the lowest NPC
 * id. Unreachable or unplaced NPCs never.
 */
function chooseNpc(npcIds: number[], inputs: Inputs): Npc | null {
  const rank = (npc: Npc): number[] => {
    const zone = npc.zone ?? '';
    return [
      GRIDANIA.has(zone) ? 0 : 1,
      MAIN_CITIES.has(zone) ? 0 : 1,
      inputs.towns.has(zone) ? 0 : 1,
      inputs.zoneLevels.get(zone) ?? Number.MAX_SAFE_INTEGER,
      inputs.zoneOrder.get(zone) ?? Number.MAX_SAFE_INTEGER,
      npc.id,
    ];
  };
  const compare = (a: number[], b: number[]): number => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  };
  const candidates = [...new Set(npcIds)]
    .map((id) => inputs.npcs.get(id))
    .filter((npc): npc is Npc => npc !== undefined && npc.zone !== null && !npc.unreachable);
  candidates.sort((a, b) => compare(rank(a), rank(b)));
  return candidates[0] ?? null;
}

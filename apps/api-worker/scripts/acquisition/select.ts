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

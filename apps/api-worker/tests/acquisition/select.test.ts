import { describe, expect, it } from 'vitest';
import type { Cost, Entry, Inputs, Offer, Shop, Tables } from '../../scripts/acquisition/model.js';
import { overrideLine, selectEntries, type Selection } from '../../scripts/acquisition/select.js';
import { collectSources } from '../../scripts/acquisition/sources.js';
import { emptyInputs, emptyTables, npc } from './helpers.js';

const ITEM = 100;

function shop(id: number, npcIds: number[], extra: Partial<Shop> = {}): Shop {
  return { id, name: '', npcIds, festival: false, ...extra };
}

function offer(s: Shop, costs: Cost[], unknownCosts = false): Offer {
  return { shop: s, costs, unknownCosts };
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
    i.highEndDuties.add(30100).add(30102);
    i.containers.set(ITEM, [32147]);
    i.offers.set(ITEM, [offer(shop(1770331, [1030123]), [{ itemId: 32141, amount: 6 }])]);
    i.npcs.set(1030123, npc(1030123, 'Ghul Gul', 'Amh Araeng'));
    expect(select(i).entries).toEqual([
      { kind: 'duty', dutyId: 30100 },
      { kind: 'duty', dutyId: 30102 },
    ]);
  });

  it('a normal raid token keeps the vendor and currency; only Savage, Extreme, Ultimate, Variant and Criterion list the duty', () => {
    const i = emptyInputs();
    i.items.set(12680, { name: 'Tarnished Gordian Bolt', plural: 'Tarnished Gordian Bolts', uiCategory: 61 });
    i.duties.set(12680, [30010]);
    i.offers.set(ITEM, [offer(shop(1, [10]), [{ itemId: 12680, amount: 1 }])]);
    i.npcs.set(10, npc(10, 'Sabina', 'Idyllshire'));
    expect(kinds(select(i).entries)).toEqual(['vendor']);
  });

  it('a Deep Dungeon appears only when it is the only source', () => {
    const only = emptyInputs();
    only.duties.set(ITEM, [60030]);
    only.deepDungeons.add(60030);
    expect(select(only).entries).toEqual([{ kind: 'duty', dutyId: 60030 }]);
    const crafted = emptyInputs();
    crafted.duties.set(ITEM, [60030]);
    crafted.deepDungeons.add(60030);
    crafted.recipes.set(ITEM, [{ job: 13, level: 50 }]);
    const result = select(crafted);
    expect(result.entries).toEqual([{ kind: 'craft', job: 13, level: 50 }]);
    expect(result.dropped).toContain('deepDungeonNotOnlySource');
  });

  it('desynthesis appears only when it is the only source', () => {
    const only = emptyInputs();
    only.desynth.set(ITEM, [{ sourceItemId: 5000, job: 15 }]);
    expect(kinds(select(only).entries)).toEqual(['desynth']);
    const crafted = emptyInputs();
    crafted.desynth.set(ITEM, [{ sourceItemId: 5000, job: 15 }]);
    crafted.recipes.set(ITEM, [{ job: 15, level: 90 }]);
    const result = select(crafted);
    expect(kinds(result.entries)).toEqual(['craft']);
    expect(result.dropped).toContain('desynthNotOnlySource');
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

  it('ignores every salvager and recompense officer shop, whatever it is named (they sell back what a player once owned)', () => {
    const i = emptyInputs();
    i.offers.set(ITEM, [
      offer(shop(262000, [1006004], { name: 'Purchase Achievement Rewards II' }), [{ itemId: 1, amount: 100 }]),
      offer(shop(262001, [1017613], { name: 'Purchase Moonfire Faire Items I' }), [{ itemId: 1, amount: 59 }]),
      offer(shop(262002, [1025913], { name: 'Ceremony Attire Exchange' }), [{ itemId: ITEM, amount: 1 }]),
    ]);
    i.npcs.set(1006004, npc(1006004, 'Calamity salvager', 'Old Gridania'));
    i.npcs.set(1017613, npc(1017613, 'recompense officer', 'Old Gridania'));
    i.npcs.set(1025913, npc(1025913, 'journeyman salvager', "Mor Dhona"));
    const result = select(i);
    expect(result.entries).toEqual([]);
    expect(result.dropped).toEqual(['repurchaseShop', 'repurchaseShop', 'repurchaseShop']);
  });

  it('drops an offer whose costs the data gets wrong rather than print them', () => {
    const i = emptyInputs();
    i.items.set(10309, { name: "Red Crafters' Scrip", plural: "Red Crafters' Scrips", uiCategory: 100 });
    i.offers.set(ITEM, [offer(shop(1770095, [10]), [{ itemId: 10309, amount: 600 }], true)]);
    i.npcs.set(10, npc(10, 'Agora merchant', 'Radz-at-Han'));
    const result = select(i);
    expect(result.entries).toEqual([]);
    expect(result.dropped).toEqual(['unknownCost']);
  });

  it('drops an exchange paid in a duty token whose duty is not known yet', () => {
    const i = emptyInputs();
    i.items.set(52321, { name: "Mad Harlequin's Totem", plural: "Mad Harlequin's Totems", uiCategory: 61 });
    i.unmappedTokens.add(52321);
    i.offers.set(ITEM, [offer(shop(1, [10]), [{ itemId: 52321, amount: 10 }])]);
    i.npcs.set(10, npc(10, "Uah'shepya", 'Solution Nine'));
    const result = select(i);
    expect(result.entries).toEqual([]);
    expect(result.dropped).toEqual(['tokenWithoutDuty']);
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
    i.zoneLevels
      .set('Urqopacha', 90)
      .set("Kozama'uka", 91)
      .set('Old Gridania', 1)
      .set('Central Shroud', 1)
      .set('Tuliyollal', 90)
      .set('Radz-at-Han', 80)
      .set('Limsa Lominsa Lower Decks', 1)
      .set('Sinus Ardorum', 90)
      .set('Phaenna', 90);
    for (const town of ['Old Gridania', 'Tuliyollal', 'Radz-at-Han', 'Limsa Lominsa Lower Decks']) i.towns.add(town);
    i.zoneOrder.set('Sinus Ardorum', 1237).set('Phaenna', 1291);
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

  it('always favors a city over the field (Mar 2026 reminders)', () => {
    expect(chosen(vendors([[3, 'Central Shroud'], [4, 'Tuliyollal']]))).toBe(4);
  });

  it('favors a main city over an end-game city', () => {
    expect(chosen(vendors([[5, 'Tuliyollal'], [6, 'Radz-at-Han'], [7, 'Limsa Lominsa Lower Decks']]))).toBe(7);
  });

  it('favors the earliest Cosmic Exploration zone', () => {
    expect(chosen(vendors([[9, 'Phaenna'], [8, 'Sinus Ardorum']]))).toBe(8);
    expect(chosen(vendors([[8, 'Phaenna'], [9, 'Sinus Ardorum']]))).toBe(9);
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

describe('overrideLine', () => {
  it("writes every Emperor's New item as Goberin in Vesper Bay (Mar 2026 reminders)", () => {
    expect(overrideLine("Emperor's New Robe")).toBe('Goberin - Western Thanalan - Vesper Bay');
    expect(overrideLine("Emperor's New Gloves")).toBe('Goberin - Western Thanalan - Vesper Bay');
    // The game's own names carry the article
    expect(overrideLine("The Emperor's New Robe")).toBe('Goberin - Western Thanalan - Vesper Bay');
    expect(overrideLine('Hempen Coif')).toBeNull();
  });
});

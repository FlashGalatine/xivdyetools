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
  it('keeps other costume coffers named as coffers', () => {
    const i = inputs();
    i.items.set(60000, { name: "Peacelover's Attire Coffer", plural: '', uiCategory: 61 });
    expect(formatEntries([{ kind: 'container', containerId: 60000 }], i, emptyTables())).toBe(
      "Peacelover's Attire Coffer"
    );
  });

  it.each([
    'Mill', 'Forge', 'Hammer', 'Gem', 'Hide', 'Bolt', 'Cauldron', 'Galley',
    'Mine', 'Field', 'Tackle',
  ])('lists Enie for the %sfiend costume coffer', (prefix) => {
    const i = inputs();
    i.items.set(60000, { name: `${prefix}fiend's Costume Coffer`, plural: '', uiCategory: 61 });
    expect(formatEntries([{ kind: 'container', containerId: 60000 }], i, emptyTables())).toBe(
      "Enie - Ishgard - The Firmament (3,000 Skybuilders' Scrips)"
    );
  });

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

  it.each([
    { costs: [{ itemId: 1, amount: 2 }] },
    { costs: [{ itemId: 25, amount: 500 }] },
    { costs: [] },
  ])('omits Varsarudh costs in Old Sharlayan: %j', ({ costs }) => {
    expect(line([{ kind: 'vendor', npc: npc(4, 'Varsarudh', 'Old Sharlayan'), costs }])).toBe(
      'Varsarudh - Old Sharlayan'
    );
  });

  it('keeps costs for other vendors and locations', () => {
    expect(line([{ kind: 'vendor', npc: npc(4, 'Merchant', 'Old Sharlayan'), costs: [{ itemId: 1, amount: 2 }] }])).toBe(
      'Merchant - Old Sharlayan (2 Gil)'
    );
    expect(line([{ kind: 'vendor', npc: npc(4, 'Varsarudh', 'Old Gridania'), costs: [{ itemId: 1, amount: 2 }] }])).toBe(
      'Varsarudh - Old Gridania (2 Gil)'
    );
  });

  it('writes a free vendor without parentheses, and a currency in the plural even for one unit (Mar 2026 reminders)', () => {
    expect(line([{ kind: 'vendor', npc: npc(4, 'Varsarudh', 'Old Sharlayan'), costs: [] }])).toBe('Varsarudh - Old Sharlayan');
    expect(line([{ kind: 'vendor', npc: npc(5, 'mark quartermaster', "Wolves' Den Pier"), costs: [{ itemId: 25, amount: 1 }] }])).toBe(
      "Mark Quartermaster - Wolves' Den Pier (1 Wolf Marks)"
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

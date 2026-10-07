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

/** ItemUICategory rows of general currencies: 63 "Other" and 100 "Currency". */
const CURRENCY_CATEGORIES = new Set([63, 100]);

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
    case 'container': {
      const name = inputs.items.get(entry.containerId)?.name;
      // These costume sets list the coffer's purchase source in the glamour export.
      if (name && /^\w+fiend's Costume Coffer$/.test(name)) {
        return "Enie - Ishgard - The Firmament (3,000 Skybuilders' Scrips)";
      }
      return name ?? null;
    }
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
  // Varsarudh's acquisition line names the vendor without a currency amount.
  if (titleCase(npc.name) === 'Varsarudh' && npc.zone === 'Old Sharlayan') return head;
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
    // Mar 2026 reminders: currencies in the plural "as much as possible", even for one.
    const currency = CURRENCY_CATEGORIES.has(item.uiCategory);
    if (amount === 1 && !currency) parts.push(costs.length > 1 ? item.name : `1 ${item.name}`);
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

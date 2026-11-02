/**
 * Glamour list — the Abridged acquisition line.
 *
 * api-worker writes every known source of a piece, joined by ` / `. A social
 * post wants one answer, so Abridged keeps the most useful source and drops
 * the rest: the easiest dungeon, trial or raid; else the craft; else a Gil
 * vendor (price kept); else another vendor with its price taken off; else the
 * line as it is.
 *
 * The rules are the maintainer's (the GPOSERS social-media form), written out
 * in `abridgeAcquisition` below. They read TEXT, not the structured entries
 * api-worker builds the line from, because the resolve answer carries one
 * English line per item and the player's own edits arrive as text too. Pure by
 * design — no DOM, no services — so the rules are unit-testable without a
 * browser.
 *
 * @module shared/glamour-abridged
 */

const SEPARATOR = ' / ';

/** The game's Treasure Hunt content: an instance only when nothing better is on the line. */
const MAP_DUNGEONS: ReadonlySet<string> = new Set([
  'The Aquapolis',
  'The Lost Canals of Uznair',
  'The Hidden Canals of Uznair',
  'The Shifting Altars of Uznair',
  'The Dungeons of Lyhe Ghiah',
  'The Shifting Oubliettes of Lyhe Ghiah',
  'The Excitatron 6000',
  'The Shifting Gymnasion Agonon',
  'Cenote Ja Ja Gural',
  'Vault Oneiron',
]);

const NON_INSTANCE_SUFFIX =
  /\((?:Sidequest|Main Story Quest|FATE|Achievement|IL \d+|\d{4})\)$|(?:Coffer|Container|Map|Sack|Lockboxes|Voyages|Saga|Gear & Weapons)$/;
const NON_INSTANCE_PREFIXES: readonly string[] = [
  'Desynthesis (',
  'Veteran Rewards',
  'PvP Series Rewards',
  'Encyclopaedia Eorzea',
  'Final Fantasy XIV',
  'Hall of the Novice',
  'Ceremony of Eternal Bonding',
];
const NON_INSTANCE_EXACT: ReadonlySet<string> = new Set([
  'Moogle Treasure Trove',
  'FFXIV Online Store',
]);

function isCraft(part: string): boolean {
  return part.startsWith('Crafted (');
}

/** The trailing ` (...)`'s text, when the part ends in one. `start` is the space. */
function trailingBracket(part: string): { start: number; text: string } | null {
  const m = / \(([^()]*)\)$/.exec(part);
  return m ? { start: m.index, text: m[1] } : null;
}

function isPricedVendor(part: string): boolean {
  if (!part.includes(' - ')) return false;
  const bracket = trailingBracket(part);
  return bracket !== null && /[\d,]/.test(bracket.text);
}

function isGilVendor(part: string): boolean {
  if (!isPricedVendor(part)) return false;
  return /^[\d,]+ Gil$/.test(trailingBracket(part)?.text ?? '');
}

function isKnownNonInstance(part: string): boolean {
  return (
    NON_INSTANCE_EXACT.has(part) ||
    NON_INSTANCE_PREFIXES.some((prefix) => part.startsWith(prefix)) ||
    NON_INSTANCE_SUFFIX.test(part)
  );
}

/** Difficulty of an instance, low to high: plain, Hard, Extreme, Savage, Ultimate. */
function tier(part: string): number {
  if (part.includes('(Ultimate)')) return 4;
  if (part.includes('(Savage)')) return 3;
  if (part.includes('(Extreme)') || part.startsWith("The Minstrel's Ballad: ")) return 2;
  if (part.includes('(Hard)')) return 1;
  return 0;
}

/** Remove the trailing price bracket: `Shop - Town (3 Things)` becomes `Shop - Town`. */
function withoutPrice(part: string): string {
  const bracket = trailingBracket(part);
  return bracket ? part.slice(0, bracket.start).trimEnd() : part;
}

/**
 * One part as a source: the player's stray whitespace off, and a separator left
 * dangling at its edge. `Shop - Town (1 A) /` has no ` / ` to split on. Blank
 * when nothing is left. Generated lines have none of this, so they pass as they are.
 */
function cleanPart(raw: string): string {
  let part = raw.trim();
  if (part.startsWith('/ ')) part = part.slice(2).trimStart();
  if (part.endsWith(' /')) part = part.slice(0, -2).trimEnd();
  return part === '/' ? '' : part;
}

/**
 * Abridge one acquisition line (English, sources joined by ` / `) to the one
 * source worth posting. The first rule that applies decides:
 *
 * 1. Instances (dungeon, trial, raid) lead the line: keep every one at the
 *    lowest difficulty present. A map dungeon counts only when the line has
 *    no craft and no priced vendor; otherwise it is passed over.
 * 2. A craft: the first one.
 * 3. A Gil vendor: the first one, price kept.
 * 4. Any other priced vendor: the first one, price removed.
 * 5. Otherwise the line unchanged (sidequests, free vendors, the store).
 *
 * An empty part (a stray separator in a player's edit) is no source at all, and
 * whitespace around a part does not change what it is. Every part kept is
 * non-blank, and a price comes off only after a name, so a non-empty source
 * never abridges to nothing.
 */
export function abridgeAcquisition(line: string): string {
  if (line === '') return line;
  const parts = line
    .split(SEPARATOR)
    .map(cleanPart)
    .filter((part) => part !== '');
  const hasCraftOrPrice = parts.some((p) => isCraft(p) || isPricedVendor(p));

  // Instances are the leading parts, up to the first craft, priced vendor or
  // known non-instance. An excluded map dungeon does not count, and does not stop the run.
  const instances: string[] = [];
  for (const part of parts) {
    if (isCraft(part) || isPricedVendor(part) || isKnownNonInstance(part)) break;
    if (hasCraftOrPrice && MAP_DUNGEONS.has(part)) continue;
    instances.push(part);
  }
  if (instances.length > 0) {
    // Not Math.min(...): a pasted line has no length limit, and a spread overflows the stack
    const lowest = instances.reduce((low, p) => Math.min(low, tier(p)), Infinity);
    return instances.filter((p) => tier(p) === lowest).join(SEPARATOR);
  }

  const craft = parts.find(isCraft);
  if (craft !== undefined) return craft;

  const gil = parts.find(isGilVendor);
  if (gil !== undefined) return gil;

  const priced = parts.find(isPricedVendor);
  if (priced !== undefined) return withoutPrice(priced);

  return line;
}

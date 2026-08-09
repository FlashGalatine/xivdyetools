/**
 * Dye emoji sync — GENERATED from dyes.json (5.0, confirmed 1a).
 *
 * Every application emoji is rendered at run time: a 128×128 rounded-square
 * bare chip (r 28 ≈ 22%) of the dye hex with the suite's hairline inset ring
 * (6 px, rgba(127,127,127,0.45) — visible on Discord dark #313338 and light
 * #FFFFFF both, invisible against mid-tones where it is not needed). No
 * source image folder, no external repo, our own provenance. Keyed by
 * **stainID** end to end; Facewear stays out (it is not in dyes.json).
 *
 * Sync semantics (5.0 — no longer skip-only):
 * - upload any dye missing from the application set
 * - when ARTWORK_VERSION differs from the mapping's recorded tag, delete and
 *   re-upload the whole set (artwork change = full regeneration)
 * - delete application emojis whose names no longer correspond to a dye
 * - two dye names normalising to the same emoji name FAIL the run loudly —
 *   a silent skip would leave one dye wearing the other's chip
 *
 * Usage:
 *   $env:DISCORD_TOKEN = "..."; $env:DISCORD_CLIENT_ID = "..."
 *   npm run upload-emojis
 *
 * Capacity: ~125 emojis vs Discord's 2,000-per-application cap.
 *
 * ⚠️ READ BEFORE RUNNING THIS AGAINST PRODUCTION (app 1447108133020369048).
 *
 * Production's slot still records `artwork: "legacy-icons"` while
 * ARTWORK_VERSION above is `chip-1`. Running this with production credentials
 * will therefore DELETE and RE-UPLOAD all 125 production emoji, replacing the
 * legacy icons with the 5.0 flat chips — a visible change to the live bot,
 * triggered as a side effect of a routine sync rather than as a deliberate
 * act.
 *
 * That regeneration is intentionally DEFERRED until the 2026-08-09 pre-release
 * remediation sprints are complete (decision 2026-08-09). Until then, run this
 * only against the beta application (1536085517270261771), whose slot is
 * already on `chip-1`.
 *
 * Each application's slot carries its own artwork tag precisely so this
 * divergence is visible and survivable — see the EmojiMappingFile comment.
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const DYE_DATA_PATH = resolve(here, '../../../packages/core/src/data/dyes.json');
const MAPPING_PATH = resolve(here, '../src/data/emoji-mapping.json');

/** Bump when the chip artwork generation changes — forces a full re-upload. */
const ARTWORK_VERSION = 'chip-1';

interface DyeEntry {
  stainID: number;
  name: string;
  hex: string;
}

interface ApplicationEmojiSet {
  /** Artwork generation for THIS application's set (regeneration is per-app). */
  artwork: string;
  byStainId: Record<string, string>;
}

interface EmojiMappingFile {
  /**
   * Discord application ID -> (stainID -> `<:name:id>`).
   *
   * Application emoji are owned by the application that uploaded them: a bot
   * can only render its OWN application's emoji, and Discord degrades any
   * others to literal `:name:` text. So each application gets its own slot and
   * this script writes ONLY the slot for the DISCORD_CLIENT_ID it uploaded to,
   * leaving every sibling application's IDs untouched.
   */
  byApplication: Record<string, ApplicationEmojiSet>;
}

interface DiscordEmoji {
  id: string;
  name: string;
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  console.error('Error: DISCORD_TOKEN and DISCORD_CLIENT_ID environment variables are required');
  process.exit(1);
}

/**
 * The guard above exits when this is unset, but TypeScript's narrowing does not
 * reach into the async function bodies below — so re-bind it as a plain string.
 */
const APPLICATION_ID: string = clientId;

const API = `https://discord.com/api/v10/applications/${clientId}/emojis`;
const HEADERS = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };

/**
 * Lowercase, non-alphanumeric → _, collapse, trim, ≤32 chars — kept
 * human-readable in the emoji picker. Collisions fail the run (below).
 */
function dyeNameToEmojiName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

/** The 1a chip: rounded square of the dye hex + 6 px hairline inset ring. */
function chipSvg(hex: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">` +
    `<rect x="0" y="0" width="128" height="128" rx="28" fill="${hex}"/>` +
    `<rect x="3" y="3" width="122" height="122" rx="25" fill="none" stroke="rgba(127,127,127,0.45)" stroke-width="6"/>` +
    `</svg>`
  );
}

async function renderChipPng(hex: string): Promise<Buffer> {
  // resvg-wasm is already a worker dependency; in Node we init it from the
  // bundled wasm file.
  const { initWasm, Resvg } = await import('@resvg/resvg-wasm');
  if (!(renderChipPng as { initialized?: boolean }).initialized) {
    const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
    await initWasm(readFileSync(wasmPath));
    (renderChipPng as { initialized?: boolean }).initialized = true;
  }
  const resvg = new Resvg(chipSvg(hex));
  return Buffer.from(resvg.render().asPng());
}

async function listApplicationEmojis(): Promise<DiscordEmoji[]> {
  const res = await fetch(API, { headers: HEADERS });
  if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { items: DiscordEmoji[] };
  return body.items;
}

async function uploadEmoji(name: string, png: Buffer): Promise<DiscordEmoji> {
  const res = await fetch(API, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ name, image: `data:image/png;base64,${png.toString('base64')}` }),
  });
  if (res.status === 429) {
    const retry = ((await res.json()) as { retry_after?: number }).retry_after ?? 30;
    console.log(`  Rate limited, waiting ${retry}s...`);
    await new Promise((r) => setTimeout(r, retry * 1000));
    return uploadEmoji(name, png);
  }
  if (!res.ok) throw new Error(`Upload ${name} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as DiscordEmoji;
}

async function deleteEmoji(emoji: DiscordEmoji): Promise<void> {
  const res = await fetch(`${API}/${emoji.id}`, { method: 'DELETE', headers: HEADERS });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete ${emoji.name} failed: ${res.status} ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  const dyes: DyeEntry[] = JSON.parse(readFileSync(DYE_DATA_PATH, 'utf8'));
  const mapping: EmojiMappingFile = JSON.parse(readFileSync(MAPPING_PATH, 'utf8'));

  // Collision check: two names normalising identically must FAIL the run.
  const byEmojiName = new Map<string, DyeEntry>();
  for (const dye of dyes) {
    const name = dyeNameToEmojiName(dye.name);
    const clash = byEmojiName.get(name);
    if (clash) {
      console.error(
        `FATAL: "${dye.name}" and "${clash.name}" both normalise to emoji name "${name}".`
      );
      process.exit(1);
    }
    byEmojiName.set(name, dye);
  }

  const existing = await listApplicationEmojis();
  const existingByName = new Map(existing.map((e) => [e.name, e]));
  const currentSet = mapping.byApplication?.[APPLICATION_ID];
  const artworkChanged = currentSet?.artwork !== ARTWORK_VERSION;
  if (artworkChanged) {
    console.log(
      `Artwork generation changed for application ${APPLICATION_ID} (${currentSet?.artwork ?? 'none'} -> ${ARTWORK_VERSION}) — regenerating its full set.`
    );
  }

  // Only this application's slot is rewritten; siblings are carried over.
  const slot: Record<string, string> = {};
  const newMapping: EmojiMappingFile = {
    byApplication: { ...(mapping.byApplication ?? {}) },
  };
  let uploaded = 0;
  let replaced = 0;

  for (const dye of dyes) {
    const name = dyeNameToEmojiName(dye.name);
    let emoji = existingByName.get(name);

    if (emoji && artworkChanged) {
      await deleteEmoji(emoji);
      existingByName.delete(name);
      emoji = undefined;
      replaced++;
    }

    if (!emoji) {
      const png = await renderChipPng(dye.hex);
      emoji = await uploadEmoji(name, png);
      uploaded++;
      console.log(`  Uploaded :${name}: for ${dye.name} (stainID ${dye.stainID})`);
      await new Promise((r) => setTimeout(r, 150));
    }

    slot[String(dye.stainID)] = `<:${emoji.name}:${emoji.id}>`;
    existingByName.delete(name);
  }

  // Anything left in the application set no longer corresponds to a dye.
  let deleted = 0;
  for (const orphan of existingByName.values()) {
    await deleteEmoji(orphan);
    deleted++;
    console.log(`  Deleted orphan :${orphan.name}:`);
  }

  newMapping.byApplication[APPLICATION_ID] = {
    artwork: ARTWORK_VERSION,
    byStainId: Object.fromEntries(
      Object.entries(slot).sort(([a], [b]) => Number(a) - Number(b))
    ),
  };
  writeFileSync(MAPPING_PATH, `${JSON.stringify(newMapping, null, 2)}\n`);

  console.log(
    `Done. ${dyes.length} dyes → uploaded ${uploaded} (replaced ${replaced}), deleted ${deleted} orphans. Mapping written.`
  );
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});

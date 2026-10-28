/**
 * Equipment identity for a loaded `.chara` — the client side of api-worker's
 * `POST /v1/chara/resolve` (Swatch Matcher 11a/11c "Dyes on this glamour").
 *
 * The request carries the file's model keys — twelve small integers plus the
 * facewear row — and nothing else (no name, no appearance, never the
 * screenshot). The SPA never talks to XIVAPI: api-worker resolves, caches per
 * key, merges ko/zh, and proxies icons, so the CSP's connect-src stays closed
 * to `*.xivdyetools.app`.
 *
 * Dyes never wait on this call. The glamour block renders stains from the
 * file first; names land on the round-trip. Any failure surfaces as
 * CharaResolveUnavailableError and the block falls back to slot-only rows —
 * labels lost, data intact.
 *
 * @module services/chara-resolve-service
 */

import type { CharaGearModel, CharaGearSlotId, CharaTwinRules } from '@xivdyetools/core';
import { logger } from '@shared/logger';
import { getApiWorkerBase } from './api-worker-origin';

export interface CharaItemNames {
  en: string;
  ja: string;
  de: string;
  fr: string;
  /** Present only when the regional tables know the item — fall back to `en` */
  ko?: string;
  zh?: string;
}

export interface CharaResolvedItem {
  /**
   * Item sheet row the same-model family is named by: its lowest eligible row
   * that has an acquisition line, else its lowest row. The family's lowest row
   * is therefore the smaller of this and the `alternates` (api-worker always
   * lists it when it is not this row).
   */
  itemId: number;
  names: CharaItemNames;
  iconId: number | null;
  /** Rows sharing this (slot, model key); 1 = unique */
  familySize: number;
  /** Each alternate carries its own acquisition line (api-worker ≥ 0.15.0) */
  alternates: Array<{ itemId: number; names: CharaItemNames; acquisition?: string }>;
  /** OffHand only: the off-hand model is the main weapon's own ModelSub (quiver, focus, fist pair) */
  viaMainHand: boolean;
  /**
   * The family's in-game rules (dye channels, glamour flag, race/gender lock,
   * Grand Company), one entry per distinct rule set. Absent from a worker that
   * predates the in-game check; `[]` when XIVAPI did not say.
   */
  rules?: CharaTwinRules[];
  /**
   * Where `itemId` comes from, as one English GPOSERS line ("Crafted (WVR Lvl.
   * 92) / …"). Absent when the worker has none or predates 0.15.0.
   */
  acquisition?: string;
  /**
   * Every row of the family is retired (Aetherial, Deepmist, low-level Dated):
   * nothing obtainable shares the look, but it is still the item the file
   * wears, named as usual. Absent otherwise, and from a worker that predates it.
   */
  retired?: true;
  /**
   * The named item's ItemUICategory row (api-worker ≥ 0.20.0). The list writes
   * an Off Hand only under a main hand whose category takes one. Absent from an
   * older worker, in which case the Off Hand is kept.
   */
  uiCategory?: number;
}

export interface CharaResolvedGlasses {
  id: number;
  names: CharaItemNames;
  iconId: number | null;
  /** Where to obtain the unlock Item for this facewear style, shared by all colors. */
  acquisition?: string;
}

export interface CharaResolveResult {
  /**
   * Requested slots only. `null` = no Item row (NPC / prop model) — show the
   * key, not an error. A retired family is an item with `retired: true`, not null.
   */
  items: Partial<Record<CharaGearSlotId, CharaResolvedItem | null>>;
  glasses: CharaResolvedGlasses | null;
  version: string | null;
}

/** api-worker is down, rate-limited, re-indexing after a patch, or unreachable. */
export class CharaResolveUnavailableError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'CharaResolveUnavailableError';
  }
}

const REQUEST_TIMEOUT_MS = 12_000;
/**
 * Model lanes and Glasses rows are uint16 in the game's own struct; api-worker
 * refuses the whole batch past that (apps/api-worker/src/chara/router.ts LANE_MAX).
 */
const LANE_MAX = 0xffff;

function inLane(value: number, min: number): boolean {
  return Number.isInteger(value) && value >= min && value <= LANE_MAX;
}

/** Every lane the piece carries fits the game's uint16. */
function isSendable(model: CharaGearModel): boolean {
  return (
    inLane(model.base, 0) &&
    inLane(model.variant, 0) &&
    (model.set === undefined || inLane(model.set, 0))
  );
}

/** Icon PNG URL for a resolved item / glasses row (api-worker proxy, edge-cached). */
export function charaIconUrl(iconId: number): string {
  return `${getApiWorkerBase()}/v1/chara/icon/${iconId}`;
}

/** Name in the app language, EN fallback per item (ko/zh can lag a patch). */
export function itemNameFor(names: CharaItemNames, locale: string): string {
  const localized = (names as unknown as Record<string, string | undefined>)[locale];
  return localized && localized.length > 0 ? localized : names.en;
}

/** Same file imported twice in a session is one request. */
const sessionCache = new Map<string, CharaResolveResult>();

function signatureOf(gear: readonly CharaGearModel[], glassesId: number | null): string {
  const sorted = [...gear].sort((a, b) => a.slot.localeCompare(b.slot));
  return JSON.stringify({ gear: sorted, glasses: glassesId ?? 0 });
}

const GEAR_SLOTS: Record<CharaGearSlotId, true> = {
  MainHand: true,
  OffHand: true,
  HeadGear: true,
  Body: true,
  Hands: true,
  Legs: true,
  Feet: true,
  Ears: true,
  Neck: true,
  Wrists: true,
  LeftRing: true,
  RightRing: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownSlot(value: string): value is CharaGearSlotId {
  return Object.prototype.hasOwnProperty.call(GEAR_SLOTS, value);
}

function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function readNames(value: unknown): CharaItemNames | null {
  if (!isRecord(value)) return null;
  const { en, ja, de, fr, ko, zh } = value;
  if (
    typeof en !== 'string' ||
    typeof ja !== 'string' ||
    typeof de !== 'string' ||
    typeof fr !== 'string'
  )
    return null;
  if ((ko !== undefined && typeof ko !== 'string') || (zh !== undefined && typeof zh !== 'string'))
    return null;
  return {
    en,
    ja,
    de,
    fr,
    ...(ko !== undefined ? { ko } : {}),
    ...(zh !== undefined ? { zh } : {}),
  };
}

function readAlternates(value: unknown): CharaResolvedItem['alternates'] | null {
  if (!Array.isArray(value)) return null;
  const alternates: CharaResolvedItem['alternates'] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const { itemId, acquisition } = entry;
    const names = readNames(entry.names);
    if (
      !isPositiveId(itemId) ||
      !names ||
      (acquisition !== undefined && typeof acquisition !== 'string')
    )
      return null;
    alternates.push({ itemId, names, ...(acquisition !== undefined ? { acquisition } : {}) });
  }
  return alternates;
}

function readRules(value: unknown): CharaTwinRules[] | null {
  if (!Array.isArray(value)) return null;
  const rules: CharaTwinRules[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const { dyeCount, glamourable, wearMask, grandCompany, itemIds } = entry;
    // Game contract: 0–2 dye channels, 16 race/gender bits, and company rows 0–3.
    if (
      (dyeCount !== 0 && dyeCount !== 1 && dyeCount !== 2) ||
      typeof glamourable !== 'boolean' ||
      (wearMask !== null && !(isPositiveId(wearMask) && wearMask <= 0xffff)) ||
      (grandCompany !== 0 && grandCompany !== 1 && grandCompany !== 2 && grandCompany !== 3) ||
      !Array.isArray(itemIds) ||
      itemIds.length === 0
    )
      return null;
    const ids: number[] = [];
    for (const id of itemIds) {
      if (!isPositiveId(id)) return null;
      ids.push(id);
    }
    // The API carries every family member here, beyond its capped picker alternates.
    rules.push({ dyeCount, glamourable, wearMask, grandCompany, itemIds: ids });
  }
  return rules;
}

function readItem(value: unknown): CharaResolvedItem | null {
  if (!isRecord(value)) return null;
  const { itemId, iconId, familySize, viaMainHand, acquisition, retired, uiCategory } = value;
  const names = readNames(value.names);
  const alternates = readAlternates(value.alternates);
  const rules = value.rules === undefined ? undefined : readRules(value.rules);
  if (
    !isPositiveId(itemId) ||
    (iconId !== null && !isPositiveId(iconId)) ||
    !names ||
    !isPositiveId(familySize) ||
    !alternates ||
    typeof viaMainHand !== 'boolean' ||
    rules === null ||
    (acquisition !== undefined && typeof acquisition !== 'string') ||
    (retired !== undefined && retired !== true) ||
    (uiCategory !== undefined && !isPositiveId(uiCategory))
  )
    return null;
  return {
    itemId,
    names,
    iconId,
    familySize,
    alternates,
    viaMainHand,
    ...(rules !== undefined ? { rules } : {}),
    ...(acquisition !== undefined ? { acquisition } : {}),
    ...(retired !== undefined ? { retired } : {}),
    ...(uiCategory !== undefined ? { uiCategory } : {}),
  };
}

function readGlasses(value: unknown): CharaResolvedGlasses | null {
  if (!isRecord(value)) return null;
  const { id, iconId, acquisition } = value;
  const names = readNames(value.names);
  if (
    !isPositiveId(id) ||
    (iconId !== null && !isPositiveId(iconId)) ||
    !names ||
    (acquisition !== undefined && typeof acquisition !== 'string')
  )
    return null;
  return { id, names, iconId, ...(acquisition !== undefined ? { acquisition } : {}) };
}

/**
 * Resolve every worn piece (and the facewear row) in one call.
 * Rejects with CharaResolveUnavailableError on any failure; rejects with the
 * caller's AbortError when `signal` aborts.
 */
export async function resolveCharaEquipment(
  gear: readonly CharaGearModel[],
  glassesId: number | null,
  signal?: AbortSignal
): Promise<CharaResolveResult> {
  const signature = signatureOf(gear, glassesId);
  const cached = sessionCache.get(signature);
  if (cached) return cached;

  // BUG-116 (2026-10-04 deep-dive): one lane past uint16 (only a hand-edited
  // or corrupt file has one) made api-worker 400 the whole batch, so every
  // piece lost its name and the note blamed availability. Such a piece is
  // left out and answered here as `null`: no Item row can carry that model.
  const sendable = gear.filter((model) => isKnownSlot(model.slot) && isSendable(model));
  const outOfRange: CharaResolveResult['items'] = {};
  for (const model of gear) {
    if (isKnownSlot(model.slot) && !sendable.includes(model)) outOfRange[model.slot] = null;
  }
  const glasses = glassesId !== null && inLane(glassesId, 1) ? glassesId : null;
  if (sendable.length === 0 && glasses === null) {
    return { items: outOfRange, glasses: null, version: null };
  }

  const body: { gear: readonly CharaGearModel[]; glasses?: number } = { gear: sendable };
  if (glasses !== null) body.glasses = glasses;

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(`${getApiWorkerBase()}/v1/chara/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CharaResolveUnavailableError(
      error instanceof Error ? error.message : 'Network error reaching api-worker'
    );
  }

  if (!response.ok) {
    logger.warn(`[CharaResolve] api-worker answered ${response.status}`);
    throw new CharaResolveUnavailableError(
      `api-worker answered ${response.status}`,
      response.status
    );
  }

  let envelope: unknown;
  try {
    envelope = await response.json();
  } catch {
    envelope = null;
  }
  if (
    !isRecord(envelope) ||
    envelope.success !== true ||
    !isRecord(envelope.data) ||
    !isRecord(envelope.data.items) ||
    (envelope.data.version !== undefined &&
      envelope.data.version !== null &&
      typeof envelope.data.version !== 'string')
  ) {
    throw new CharaResolveUnavailableError('Malformed resolve envelope');
  }

  const items: CharaResolveResult['items'] = { ...outOfRange };
  for (const model of sendable) {
    items[model.slot] = readItem(envelope.data.items[model.slot]);
  }
  const result: CharaResolveResult = {
    items,
    glasses: glasses === null ? null : readGlasses(envelope.data.glasses),
    version: envelope.data.version ?? null,
  };
  sessionCache.set(signature, result);
  return result;
}

/**
 * Drop the per-session resolve cache.
 *
 * Test-isolation hook: `beforeEach` calls it so one test's cached resolve
 * cannot answer the next one's request. Kept for that reason rather than pruned
 * as test-only (2026-09-01 dead-code audit, DEAD-005).
 *
 * @testonly beforeEach isolation — one test's cached resolve must not answer the next one's request.
 */
export function clearCharaResolveCache(): void {
  sessionCache.clear();
}

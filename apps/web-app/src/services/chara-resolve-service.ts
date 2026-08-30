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

import type { CharaGearModel, CharaGearSlotId } from '@xivdyetools/core';
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
  /** Item sheet row — the lowest row_id of the same-model family */
  itemId: number;
  names: CharaItemNames;
  iconId: number | null;
  /** Rows sharing this (slot, model key); 1 = unique */
  familySize: number;
  alternates: Array<{ itemId: number; names: CharaItemNames }>;
  /** OffHand only: the off-hand model is the main weapon's own ModelSub (quiver, focus, fist pair) */
  viaMainHand: boolean;
}

export interface CharaResolvedGlasses {
  id: number;
  names: CharaItemNames;
  iconId: number | null;
}

export interface CharaResolveResult {
  /** Requested slots only. `null` = no Item row (NPC / prop model) — show the key, not an error. */
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

interface ResolveEnvelope {
  success?: boolean;
  data?: {
    items?: CharaResolveResult['items'];
    glasses?: CharaResolvedGlasses | null;
    version?: string | null;
  };
  error?: string;
  message?: string;
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

  const body: { gear: readonly CharaGearModel[]; glasses?: number } = { gear };
  if (glassesId && glassesId > 0) body.glasses = glassesId;

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

  let envelope: ResolveEnvelope | null;
  try {
    envelope = (await response.json()) as ResolveEnvelope;
  } catch {
    envelope = null;
  }
  if (
    !envelope ||
    envelope.success !== true ||
    !envelope.data ||
    typeof envelope.data.items !== 'object' ||
    envelope.data.items === null
  ) {
    throw new CharaResolveUnavailableError('Malformed resolve envelope');
  }

  const result: CharaResolveResult = {
    items: envelope.data.items,
    glasses: envelope.data.glasses ?? null,
    version: envelope.data.version ?? null,
  };
  sessionCache.set(signature, result);
  return result;
}

/** Test hook — the session cache is module state. */
export function clearCharaResolveCache(): void {
  sessionCache.clear();
}

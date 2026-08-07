/**
 * Component Context Storage (5.0 — KV-backed)
 *
 * Stores interaction context in KV for Discord message components.
 * Since Discord custom_id is limited to 100 characters, full context data is
 * stored under a short hash referenced from the custom_id.
 *
 * Custom ID Format: {action}_{command}_{shortHash}
 * Example: algo_mixer_a1b2c3d4
 *
 * KV key: ctx:v2:{hash} · TTL 15 minutes (Discord interaction tokens die at
 * 15 minutes, so anything longer guaranteed dead tokens on edit).
 *
 * This replaces the BUG-075 Cache API design: `caches.default` is
 * per-datacenter, so a component interaction routed via a different CF colo
 * could never find its context. KV with `expirationTtl` is globally visible
 * (eventual consistency ~60s is fine — the first interaction on a fresh
 * message is always slower than that).
 *
 * Notes carried from the audit:
 *  - interaction tokens are NOT stored — every component interaction arrives
 *    with its own fresh token.
 *  - Consumers of getContext MUST verify `context.userId` against the
 *    interacting user (the 32-bit hash can collide, and contexts are not
 *    per-user secrets) — use `verifyContextUser`.
 *
 * @module services/component-context
 */

import type { ExtendedLogger } from '@xivdyetools/logger';

// ============================================================================
// Constants
// ============================================================================

/** KV key prefix — bump the version segment to invalidate all contexts */
const KV_PREFIX = 'ctx:v2:';

/** TTL in seconds */
export const CONTEXT_TTL = {
  /**
   * Standard interactions.
   * BUG-075 (2026-07-18 audit): capped at 15 minutes — Discord interaction
   * tokens die after 15 minutes, so a longer TTL guaranteed that contexts
   * retrieved in minutes 15-60 carried a token that 404s on edit.
   */
  STANDARD: 900,
  /** Pagination contexts: 15 minutes */
  PAGINATION: 900,
} as const;

/** Maximum custom_id length (Discord limit) */
const MAX_CUSTOM_ID_LENGTH = 100;

// ============================================================================
// Types
// ============================================================================

/**
 * Actions that can be performed via component interactions
 */
export type ComponentAction =
  | 'algo'      // Change algorithm (blending/matching)
  | 'market'    // Toggle market data
  | 'page'      // Change page (pagination)
  | 'refresh'   // Refresh with current settings
  | 'copy'      // Copy value to clipboard (via modal)
  | 'vote'      // Vote on preset
  | 'moderate'; // Moderation action

/**
 * Context data stored in cache
 */
export interface ComponentContext {
  /** Original command name */
  command: string;
  /** Original user ID (to verify authorization) */
  userId: string;
  /** Command-specific data */
  data: Record<string, unknown>;
  /** When this context expires */
  expiresAt: number;
}

/**
 * Parsed custom_id structure
 */
export interface ParsedCustomId {
  /** Action type */
  action: ComponentAction;
  /** Command name */
  command: string;
  /** Context hash (for cache lookup) */
  hash: string;
  /** Additional value (e.g., selected option) */
  value?: string;
}

// ============================================================================
// KV Key Utilities
// ============================================================================

function buildContextKey(hash: string): string {
  return `${KV_PREFIX}${hash}`;
}

// ============================================================================
// Custom ID Generation
// ============================================================================

/**
 * Generate a short hash for context storage
 * Uses first 8 characters of SHA-256
 */
async function generateShortHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build a custom_id string for a component
 *
 * Format: {action}_{command}_{hash}[_{value}]
 *
 * @param action - Component action type
 * @param command - Command name
 * @param hash - Context hash
 * @param value - Optional value (e.g., selected option)
 * @returns Custom ID string (max 100 chars)
 */
export function buildCustomId(
  action: ComponentAction,
  command: string,
  hash: string,
  value?: string
): string {
  const parts = [action, command, hash];
  if (value !== undefined) {
    parts.push(value);
  }

  const customId = parts.join('_');

  if (customId.length > MAX_CUSTOM_ID_LENGTH) {
    throw new Error(`Custom ID exceeds ${MAX_CUSTOM_ID_LENGTH} characters: ${customId.length}`);
  }

  return customId;
}

/**
 * Parse a custom_id string back into its parts
 *
 * @param customId - Custom ID string
 * @returns Parsed structure or null if invalid
 */
export function parseCustomId(customId: string): ParsedCustomId | null {
  const parts = customId.split('_');

  if (parts.length < 3) {
    return null;
  }

  const [action, command, hash, ...rest] = parts;

  // Validate action
  const validActions: ComponentAction[] = ['algo', 'market', 'page', 'refresh', 'copy', 'vote', 'moderate'];
  if (!validActions.includes(action as ComponentAction)) {
    return null;
  }

  return {
    action: action as ComponentAction,
    command,
    hash,
    value: rest.length > 0 ? rest.join('_') : undefined,
  };
}

// ============================================================================
// Context Storage
// ============================================================================

/**
 * Store context data in KV and return the hash
 *
 * @param kv - The worker's KV namespace binding
 * @param context - Context data to store
 * @param ttlSeconds - TTL in seconds (default: STANDARD)
 * @param logger - Optional logger
 * @returns Short hash for the stored context
 */
export async function storeContext(
  kv: KVNamespace,
  context: Omit<ComponentContext, 'expiresAt'>,
  ttlSeconds: number = CONTEXT_TTL.STANDARD,
  logger?: ExtendedLogger
): Promise<string> {
  try {
    // Generate a unique hash based on context data
    const hashInput = `${context.userId}:${context.command}:${Date.now()}:${Math.random()}`;
    const hash = await generateShortHash(hashInput);

    const fullContext: ComponentContext = {
      ...context,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    // KV enforces a 60s minimum expirationTtl
    await kv.put(buildContextKey(hash), JSON.stringify(fullContext), {
      expirationTtl: Math.max(60, ttlSeconds),
    });

    if (logger) {
      logger.debug('Stored component context', { hash, command: context.command, ttl: ttlSeconds });
    }

    return hash;
  } catch (error) {
    if (logger) {
      logger.error('Failed to store component context', error instanceof Error ? error : undefined);
    }
    throw error;
  }
}

/**
 * Retrieve context data from KV
 *
 * @param kv - The worker's KV namespace binding
 * @param hash - Context hash
 * @param logger - Optional logger
 * @returns Context data or null if not found/expired
 */
export async function getContext(
  kv: KVNamespace,
  hash: string,
  logger?: ExtendedLogger
): Promise<ComponentContext | null> {
  try {
    const raw = await kv.get(buildContextKey(hash));

    if (!raw) {
      if (logger) {
        logger.debug('Component context not found', { hash });
      }
      return null;
    }

    const context: ComponentContext = JSON.parse(raw);

    // Double-check expiration (expirationTtl should handle this, but be safe)
    if (context.expiresAt < Date.now()) {
      if (logger) {
        logger.debug('Component context expired', { hash });
      }
      return null;
    }

    return context;
  } catch (error) {
    if (logger) {
      logger.error('Failed to get component context', error instanceof Error ? error : undefined, { hash });
    }
    return null;
  }
}

/**
 * Verify a retrieved context belongs to the interacting user. The 32-bit
 * hash can collide, so every consumer must gate on this before acting.
 */
export function verifyContextUser(context: ComponentContext, userId: string): boolean {
  return context.userId === userId;
}

/**
 * Update context data in KV (extends TTL)
 *
 * @param hash - Context hash
 * @param updates - Partial updates to apply
 * @param ttlSeconds - New TTL in seconds
 * @param logger - Optional logger
 * @returns Updated context or null if not found
 */
export async function updateContext(
  kv: KVNamespace,
  hash: string,
  updates: Partial<Pick<ComponentContext, 'data'>>,
  ttlSeconds: number = CONTEXT_TTL.STANDARD,
  logger?: ExtendedLogger
): Promise<ComponentContext | null> {
  try {
    const existing = await getContext(kv, hash, logger);

    if (!existing) {
      return null;
    }

    const updated: ComponentContext = {
      ...existing,
      data: { ...existing.data, ...updates.data },
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    await kv.put(buildContextKey(hash), JSON.stringify(updated), {
      expirationTtl: Math.max(60, ttlSeconds),
    });

    if (logger) {
      logger.debug('Updated component context', { hash });
    }

    return updated;
  } catch (error) {
    if (logger) {
      logger.error('Failed to update component context', error instanceof Error ? error : undefined, { hash });
    }
    return null;
  }
}



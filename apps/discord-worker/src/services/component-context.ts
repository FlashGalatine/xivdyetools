/**
 * Component Context Storage (V4)
 *
 * Stores interaction context via the Cache API for Discord message components.
 * Since Discord custom_id is limited to 100 characters, we store
 * full context data in the Cache API and reference it via a short hash.
 *
 * Custom ID Format: {action}_{command}_{shortHash}
 * Example: algo_mixer_a1b2c3d4
 *
 * Cache Key: https://cache.xivdyetools.internal/ctx/v1/{hash}
 * TTL: 1 hour (15 minutes for pagination)
 *
 * @module services/component-context
 */

import type { ExtendedLogger } from '@xivdyetools/logger';

// ============================================================================
// Constants
// ============================================================================

/** Base URL for synthetic cache keys (not actually fetched) */
const CACHE_BASE_URL = 'https://cache.xivdyetools.internal/ctx';

/** Cache schema version - bump to invalidate all cached contexts */
const CACHE_SCHEMA_VERSION = 'v1';

/** TTL in seconds */
export const CONTEXT_TTL = {
  /** Standard interactions: 1 hour */
  STANDARD: 3600,
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
  /** Original interaction token (for edits) */
  interactionToken: string;
  /** Application ID for webhook URL */
  applicationId: string;
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
// Cache Key Utilities
// ============================================================================

/**
 * Build a synthetic URL cache key for a context entry
 */
function buildContextCacheUrl(hash: string): string {
  return `${CACHE_BASE_URL}/${CACHE_SCHEMA_VERSION}/${hash}`;
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
 * Store context data in the Cache API and return the hash
 *
 * @param context - Context data to store
 * @param ttlSeconds - TTL in seconds (default: STANDARD)
 * @param logger - Optional logger
 * @returns Short hash for the stored context
 */
export async function storeContext(
  context: Omit<ComponentContext, 'expiresAt'>,
  ttlSeconds: number = CONTEXT_TTL.STANDARD,
  logger?: ExtendedLogger
): Promise<string> {
  try {
    // Generate a unique hash based on context data
    const hashInput = `${context.userId}:${context.command}:${Date.now()}:${Math.random()}`;
    const hash = await generateShortHash(hashInput);

    // Add expiration timestamp
    const fullContext: ComponentContext = {
      ...context,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    // Store in Cache API with TTL
    const url = buildContextCacheUrl(hash);
    const cache = caches.default;
    const response = new Response(JSON.stringify(fullContext), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${ttlSeconds}`,
      },
    });

    await cache.put(url, response);

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
 * Retrieve context data from the Cache API
 *
 * @param hash - Context hash
 * @param logger - Optional logger
 * @returns Context data or null if not found/expired
 */
export async function getContext(
  hash: string,
  logger?: ExtendedLogger
): Promise<ComponentContext | null> {
  try {
    const url = buildContextCacheUrl(hash);
    const cache = caches.default;
    const response = await cache.match(url);

    if (!response) {
      if (logger) {
        logger.debug('Component context not found', { hash });
      }
      return null;
    }

    const context: ComponentContext = await response.json();

    // Double-check expiration (Cache-Control should handle this, but be safe)
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
 * Delete context data from the Cache API
 *
 * @param hash - Context hash
 * @param logger - Optional logger
 */
export async function deleteContext(
  hash: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const url = buildContextCacheUrl(hash);
    const cache = caches.default;
    await cache.delete(url);

    if (logger) {
      logger.debug('Deleted component context', { hash });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to delete component context', error instanceof Error ? error : undefined, { hash });
    }
  }
}

/**
 * Update context data in the Cache API (extends TTL)
 *
 * @param hash - Context hash
 * @param updates - Partial updates to apply
 * @param ttlSeconds - New TTL in seconds
 * @param logger - Optional logger
 * @returns Updated context or null if not found
 */
export async function updateContext(
  hash: string,
  updates: Partial<Pick<ComponentContext, 'data'>>,
  ttlSeconds: number = CONTEXT_TTL.STANDARD,
  logger?: ExtendedLogger
): Promise<ComponentContext | null> {
  try {
    const existing = await getContext(hash, logger);

    if (!existing) {
      return null;
    }

    const updated: ComponentContext = {
      ...existing,
      data: { ...existing.data, ...updates.data },
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    const url = buildContextCacheUrl(hash);
    const cache = caches.default;
    const response = new Response(JSON.stringify(updated), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${ttlSeconds}`,
      },
    });

    await cache.put(url, response);

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

// ============================================================================
// Authorization
// ============================================================================

/**
 * Check if a user is authorized to interact with a component
 *
 * Only the original user who triggered the command should be able
 * to interact with the components (except for public actions like voting).
 *
 * @param context - Component context
 * @param userId - User attempting the interaction
 * @param action - Action being attempted
 * @returns Whether the user is authorized
 */
export function isAuthorized(
  context: ComponentContext,
  userId: string,
  action: ComponentAction
): boolean {
  // Public actions anyone can use
  const publicActions: ComponentAction[] = ['vote'];

  if (publicActions.includes(action)) {
    return true;
  }

  // All other actions require being the original user
  return context.userId === userId;
}

// ============================================================================
// Component Builders
// ============================================================================

/**
 * Discord Select Menu Option
 */
export interface SelectMenuOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { name: string; id?: string };
  default?: boolean;
}

/**
 * Build a blending mode select menu
 */
export function buildBlendingModeSelect(
  hash: string,
  currentMode: string
): {
  type: 3; // Select menu
  custom_id: string;
  options: SelectMenuOption[];
  placeholder: string;
} {
  const modes: SelectMenuOption[] = [
    { label: 'RGB', value: 'rgb', description: 'Additive channel averaging' },
    { label: 'LAB', value: 'lab', description: 'Perceptually uniform CIELAB' },
    { label: 'OKLAB', value: 'oklab', description: 'Modern perceptual blending' },
    { label: 'RYB', value: 'ryb', description: "Artist's color wheel" },
    { label: 'HSL', value: 'hsl', description: 'Hue-Saturation-Lightness' },
    { label: 'Spectral', value: 'spectral', description: 'Physics-based mixing' },
  ];

  // Mark current as default
  const options = modes.map((m) => ({
    ...m,
    default: m.value === currentMode,
  }));

  return {
    type: 3,
    custom_id: buildCustomId('algo', 'blending', hash),
    options,
    placeholder: 'Select blending mode',
  };
}

/**
 * Build a matching method select menu
 */
export function buildMatchingMethodSelect(
  hash: string,
  currentMethod: string
): {
  type: 3;
  custom_id: string;
  options: SelectMenuOption[];
  placeholder: string;
} {
  const methods: SelectMenuOption[] = [
    { label: 'RGB', value: 'rgb', description: 'Euclidean RGB distance' },
    { label: 'CIE76', value: 'cie76', description: 'CIELAB Euclidean' },
    { label: 'CIEDE2000', value: 'ciede2000', description: 'Industry standard' },
    { label: 'OKLAB', value: 'oklab', description: 'Modern perceptual' },
    { label: 'HyAB', value: 'hyab', description: 'Hybrid distance' },
    { label: 'OKLCH Weighted', value: 'oklch-weighted', description: 'L/C/H weighted' },
  ];

  const options = methods.map((m) => ({
    ...m,
    default: m.value === currentMethod,
  }));

  return {
    type: 3,
    custom_id: buildCustomId('algo', 'matching', hash),
    options,
    placeholder: 'Select matching method',
  };
}

/**
 * Build a market data toggle button
 */
export function buildMarketToggleButton(
  hash: string,
  showingMarket: boolean
): {
  type: 2; // Button
  style: 1 | 2; // Primary or Secondary
  custom_id: string;
  label: string;
  emoji: { name: string };
} {
  return {
    type: 2,
    style: showingMarket ? 1 : 2, // Primary when active, Secondary when inactive
    custom_id: buildCustomId('market', 'toggle', hash, showingMarket ? 'off' : 'on'),
    label: showingMarket ? 'Hide Prices' : 'Show Prices',
    emoji: { name: showingMarket ? '💰' : '📊' },
  };
}

/**
 * Build a refresh button
 */
export function buildRefreshButton(hash: string): {
  type: 2;
  style: 2;
  custom_id: string;
  label: string;
  emoji: { name: string };
} {
  return {
    type: 2,
    style: 2, // Secondary
    custom_id: buildCustomId('refresh', 'result', hash),
    label: 'Refresh',
    emoji: { name: '🔄' },
  };
}

/**
 * Preset Service
 * Handles preset CRUD operations with duplicate detection
 */

import type {
  AuthContext,
  CommunityPreset,
  PresetRow,
  PresetFilters,
  PresetListResponse,
  PresetSubmission,
  PresetPreviousValues,
  PresetEditRequest,
} from '../types.js';

/**
 * BUG-002 FIX: Minimal logger interface for structured corruption logging.
 * Accepts the request-scoped logger from @xivdyetools/worker-middleware.
 */
export interface PresetServiceLogger {
  error(message: string, ...args: unknown[]): void;
}

/** R2 custom domain serving approved preview images. */
export const PREVIEW_IMAGE_PUBLIC_BASE = 'https://shots.xivdyetools.app';

/**
 * Escape special LIKE pattern characters in user input
 * Prevents SQL injection via wildcard characters (%, _, \)
 */
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Generate a dye signature for duplicate detection
 * Sorts dye IDs and returns a JSON string
 */
export function generateDyeSignature(dyes: number[]): string {
  const sorted = [...dyes].sort((a, b) => a - b);
  return JSON.stringify(sorted);
}

/**
 * Convert database row to CommunityPreset
 *
 * BUG-012 FIX: Each JSON.parse is wrapped in try-catch. 'dyes' and 'tags'
 * throw on corruption (callers must handle). 'previous_values' degrades to
 * null since it is audit trail data, not core preset content.
 */
export function rowToPreset(row: PresetRow, logger?: PresetServiceLogger): CommunityPreset {
  let dyes: CommunityPreset['dyes'];
  let tags: CommunityPreset['tags'];

  try {
    dyes = JSON.parse(row.dyes) as CommunityPreset['dyes'];
  } catch {
    throw new Error(`[BUG-012] Preset ${row.id}: invalid JSON in 'dyes' column`);
  }

  try {
    tags = JSON.parse(row.tags) as CommunityPreset['tags'];
  } catch {
    throw new Error(`[BUG-012] Preset ${row.id}: invalid JSON in 'tags' column`);
  }

  let previous_values: CommunityPreset['previous_values'] = null;
  if (row.previous_values) {
    try {
      previous_values = JSON.parse(row.previous_values) as CommunityPreset['previous_values'];
    } catch {
      // previous_values is audit trail data — safe to default to null on corruption
      // BUG-002 FIX: Use structured logger when available for request ID correlation
      (logger ?? console).error(`[BUG-012] Preset ${row.id}: invalid JSON in 'previous_values', defaulting to null`);
    }
  }

  // Supplementary metadata, like previous_values — degrade to [] rather than
  // throw. A corrupt list must not make the preset disappear from the gallery.
  let secondary_categories: CommunityPreset['secondary_categories'] = [];
  if (row.secondary_categories) {
    try {
      const parsed = JSON.parse(row.secondary_categories) as unknown;
      if (Array.isArray(parsed)) {
        secondary_categories = parsed as CommunityPreset['secondary_categories'];
      } else {
        (logger ?? console).error(
          `[BUG-012] Preset ${row.id}: 'secondary_categories' is not an array, defaulting to []`
        );
      }
    } catch {
      (logger ?? console).error(
        `[BUG-012] Preset ${row.id}: invalid JSON in 'secondary_categories', defaulting to []`
      );
    }
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.category_id as CommunityPreset['category_id'],
    secondary_categories,
    dyes,
    tags,
    author_discord_id: row.author_discord_id,
    author_name: row.author_name,
    vote_count: row.vote_count,
    status: row.status as CommunityPreset['status'],
    is_curated: row.is_curated === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    dye_signature: row.dye_signature || undefined,
    previous_values,
    example_link: row.example_link ?? null,
    // THE MODERATION GATE. An unapproved image must never be reachable from
    // the API, so the URL is built only for 'approved'. Do not move this
    // condition into a caller — one place, one rule.
    preview_image_url:
      row.preview_image_status === 'approved' && row.preview_image_key
        ? `${PREVIEW_IMAGE_PUBLIC_BASE}/${row.preview_image_key}`
        : null,
    // The STATUS is safe to expose everywhere — it is a label, not a URL, and
    // it is what lets an author's own view say "under review".
    preview_image_status: (row.preview_image_status ??
      'none') as CommunityPreset['preview_image_status'],
    rejection_reason: row.rejection_reason ?? null,
  };
}

/**
 * A preset as it leaves this Worker over HTTP.
 *
 * `author_discord_id` becomes optional (it is present only for the viewers
 * entitled to it) and `is_owner` is added for signed-in web callers, which is
 * what a client actually needs the id for.
 */
export type PublicPreset<T extends CommunityPreset = CommunityPreset> = Omit<
  T,
  'author_discord_id'
> & {
  author_discord_id?: string | null;
  is_owner?: boolean;
};

/**
 * THE author-identity rule (FINDING-016, 2026-08-29 audit), in one place.
 *
 * `rowToPreset` puts the author's Discord snowflake on every preset because the
 * moderation, notification and ownership paths need it — but the listing,
 * featured, search and detail routes are anonymous, so before this every
 * visitor of the gallery received every author's Discord id and could
 * cross-reference or DM them. The privacy guide promises the display name, not
 * the id.
 *
 *  - anonymous  → no `author_discord_id` at all; `author_name` is the identity
 *                 the gallery shows and it stays;
 *  - web (JWT)  → `is_owner`, plus the id when it is the viewer's own preset or
 *                 the viewer is a moderator (they act on the author);
 *  - bot (HMAC) → untouched. discord-worker and moderation-worker do their own
 *                 owner checks on the id, and their responses never reach a
 *                 browser. Moderator-only routes (`handlers/moderation.ts`) are
 *                 likewise unchanged: `isModerator` keeps the id there anyway.
 *
 * Returns a copy — the caller's preset object is also what feeds
 * `notifyDiscordBot`, which must keep the id.
 */
export function toPublicPreset<T extends CommunityPreset>(
  preset: T,
  viewer: AuthContext
): PublicPreset<T> {
  if (viewer.authSource === 'bot') {
    return preset;
  }

  const { author_discord_id, ...rest } = preset;

  // Anonymous callers learn nothing about the author beyond the display name,
  // not even whether they are looking at their own preset.
  if (!viewer.isAuthenticated) {
    return rest;
  }

  const isOwner =
    viewer.userDiscordId !== undefined && author_discord_id === viewer.userDiscordId;

  return {
    ...rest,
    ...(isOwner || viewer.isModerator ? { author_discord_id } : {}),
    is_owner: isOwner,
  };
}

/**
 * BUG-002 FIX: Safely convert database rows to presets, skipping corrupted rows.
 * Uses structured logger when available for request ID correlation.
 */
function rowsToPresets(rows: PresetRow[], logger?: PresetServiceLogger): CommunityPreset[] {
  return rows.flatMap((row) => {
    try {
      return [rowToPreset(row, logger)];
    } catch (error) {
      (logger ?? console).error(`[BUG-012] Skipping corrupted preset row id=${row.id}:`, error);
      return [];
    }
  });
}

/**
 * Get presets with filtering and pagination
 *
 * SECURITY NOTE: Hidden presets are always excluded from public listings,
 * regardless of the status filter. This prevents bypassing the ban system
 * by passing ?status=hidden to the API.
 */
export async function getPresets(
  db: D1Database,
  filters: PresetFilters,
  logger?: PresetServiceLogger,
): Promise<PresetListResponse> {
  const {
    category,
    search,
    status = 'approved',
    sort = 'popular',
    page = 1,
    limit = 20,
    is_curated,
  } = filters;

  // Prevent querying hidden presets - they're only visible to owners via /mine
  const safeStatus = status === 'hidden' ? 'approved' : status;

  // Build WHERE clause
  // Always exclude 'hidden' status to prevent ban bypass
  const conditions: string[] = ["status = ? AND status != 'hidden'"];
  const params: (string | number)[] = [safeStatus];

  if (category) {
    // A preset is "in" a category if it is the primary OR appears in the
    // secondary list. Bound twice rather than as ?1: this query builds its
    // params positionally, and mixing ? with ?1 is a trap for the next editor.
    conditions.push(
      '(category_id = ? OR EXISTS (SELECT 1 FROM json_each(presets.secondary_categories) WHERE value = ?))'
    );
    params.push(category, category);
  }

  if (search) {
    // Escape SQL LIKE wildcards to prevent pattern injection
    conditions.push("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')");
    const searchPattern = `%${escapeLikePattern(search)}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (is_curated !== undefined) {
    conditions.push('is_curated = ?');
    params.push(is_curated ? 1 : 0);
  }

  const whereClause = conditions.join(' AND ');

  // Build ORDER BY clause
  let orderBy: string;
  switch (sort) {
    case 'recent':
      orderBy = 'created_at DESC';
      break;
    case 'name':
      orderBy = 'name ASC';
      break;
    case 'popular':
    default:
      orderBy = 'vote_count DESC, created_at DESC';
      break;
  }

  // PERFORMANCE: Use window function to get total count in same query
  // This reduces database round-trips from 2 to 1 for paginated requests
  // SQLite 3.25+ (supported by D1) supports COUNT(*) OVER()
  const offset = (page - 1) * limit;
  const query = `
    SELECT *, COUNT(*) OVER() as _total
    FROM presets
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const result = await db
    .prepare(query)
    .bind(...params, limit, offset)
    .all<PresetRow & { _total: number }>();

  const rows = result.results || [];
  // Extract total from first row (all rows have same total via window function)
  let total = rows.length > 0 ? rows[0]._total : 0;

  // OPT-017 (2026-07-18 audit): the window function has no row to ride on for
  // out-of-range pages, so fall back to a real COUNT there — otherwise clients
  // paginating past the end see the collection "shrink" to zero
  if (rows.length === 0 && page > 1) {
    const countRow = await db
      .prepare(`SELECT COUNT(*) as total FROM presets WHERE ${whereClause}`)
      .bind(...params)
      .first<{ total: number }>();
    total = countRow?.total ?? 0;
  }

  const presets = rowsToPresets(rows, logger);

  return {
    presets,
    total,
    page,
    limit,
    has_more: offset + presets.length < total,
  };
}

/**
 * Get featured presets (top 10 by votes)
 *
 * SECURITY NOTE: Explicitly excludes hidden presets for defense-in-depth,
 * even though we already filter for 'approved' status.
 */
export async function getFeaturedPresets(db: D1Database, logger?: PresetServiceLogger): Promise<CommunityPreset[]> {
  const query = `
    SELECT * FROM presets
    WHERE status = 'approved' AND status != 'hidden'
    ORDER BY vote_count DESC, created_at DESC
    LIMIT 10
  `;
  const result = await db.prepare(query).all<PresetRow>();
  return rowsToPresets(result.results || [], logger);
}

/**
 * Get a single preset by ID
 */
export async function getPresetById(
  db: D1Database,
  id: string
): Promise<CommunityPreset | null> {
  const query = 'SELECT * FROM presets WHERE id = ?';
  const row = await db.prepare(query).bind(id).first<PresetRow>();
  return row ? rowToPreset(row) : null;
}

/**
 * Check for duplicate preset by dye signature
 */
export async function findDuplicatePreset(
  db: D1Database,
  dyes: number[]
): Promise<CommunityPreset | null> {
  const signature = generateDyeSignature(dyes);
  const query = `
    SELECT * FROM presets
    WHERE dye_signature = ? AND status IN ('approved', 'pending')
    LIMIT 1
  `;
  const row = await db.prepare(query).bind(signature).first<PresetRow>();
  return row ? rowToPreset(row) : null;
}

/**
 * Create a new preset
 */
export async function createPreset(
  db: D1Database,
  submission: PresetSubmission,
  authorDiscordId: string,
  authorName: string,
  status: 'approved' | 'pending' = 'approved'
): Promise<CommunityPreset> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dyeSignature = generateDyeSignature(submission.dyes);

  const query = `
    INSERT INTO presets (
      id, name, description, category_id, dyes, tags,
      author_discord_id, author_name, vote_count, status, is_curated,
      created_at, updated_at, dye_signature, example_link, secondary_categories
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?, ?)
  `;

  await db
    .prepare(query)
    .bind(
      id,
      submission.name,
      submission.description,
      submission.category_id,
      JSON.stringify(submission.dyes),
      JSON.stringify(submission.tags),
      authorDiscordId,
      authorName,
      status,
      now,
      now,
      dyeSignature,
      submission.example_link ?? null,
      JSON.stringify(submission.secondary_categories ?? [])
    )
    .run();

  return {
    id,
    name: submission.name,
    description: submission.description,
    category_id: submission.category_id,
    secondary_categories: submission.secondary_categories ?? [],
    dyes: submission.dyes,
    tags: submission.tags,
    author_discord_id: authorDiscordId,
    author_name: authorName,
    vote_count: 0,
    status,
    is_curated: false,
    created_at: now,
    updated_at: now,
    dye_signature: dyeSignature,
    example_link: submission.example_link ?? null,
    preview_image_status: 'none',
  };
}

/**
 * Build the conditional status-update statement used by the moderation handler.
 *
 * BUG-020/OPT-013 (2026-07-18 audit): the update is conditional on the status
 * the moderator observed (concurrent moderation is detectable as "no row
 * returned") and uses RETURNING * so the caller gets exactly this write's
 * result without a re-read. Batched with the moderation_log insert by the
 * caller so the pair is atomic.
 */
export function prepareStatusUpdate(
  db: D1Database,
  id: string,
  status: CommunityPreset['status'],
  expectedStatus: CommunityPreset['status'],
  now: string
): D1PreparedStatement {
  const query = `
    UPDATE presets
    SET status = ?, updated_at = ?
    WHERE id = ? AND status = ?
    RETURNING *
  `;
  return db.prepare(query).bind(status, now, id, expectedStatus);
}

/**
 * Build the revert statement used by the moderation handler.
 * Restores previous_values content and clears the snapshot column.
 * Batched with the moderation_log insert by the caller (BUG-020).
 */
export function prepareRevert(
  db: D1Database,
  id: string,
  previous: PresetPreviousValues,
  now: string
): D1PreparedStatement {
  const query = `
    UPDATE presets
    SET name = ?, description = ?, dyes = ?, tags = ?, dye_signature = ?,
        status = 'approved', previous_values = NULL, updated_at = ?
    WHERE id = ?
    RETURNING *
  `;
  return db
    .prepare(query)
    .bind(
      previous.name,
      previous.description,
      JSON.stringify(previous.dyes),
      JSON.stringify(previous.tags),
      generateDyeSignature(previous.dyes),
      now,
      id
    );
}

/**
 * A moderation-queue row: the preset plus the unapproved image URL.
 *
 * The pending URL is built HERE and not in rowToPreset, so the gate in
 * rowToPreset — `preview_image_url` only when status is 'approved' — remains
 * the single rule governing every public path. This field only ever reaches a
 * moderator-guarded route. The R2 object is already publicly readable and the
 * discord-worker embed links it directly; the gate is about not advertising
 * an unreviewed image, not about secrecy.
 */
export type ModerationQueueEntry = CommunityPreset & {
  pending_preview_image_url: string | null;
};

/**
 * Get the moderation queue.
 *
 * Two reasons a preset needs a moderator: its own content is pending, or it
 * carries an image awaiting review. Before this widened, an uploaded image
 * NEVER appeared here — the only signal was a fire-and-forget Discord embed,
 * so a dropped notification meant an image nobody would ever review.
 */
export async function getPendingPresets(
  db: D1Database,
  logger?: PresetServiceLogger
): Promise<ModerationQueueEntry[]> {
  const query = `
    SELECT * FROM presets
    WHERE status = 'pending' OR preview_image_status = 'pending'
    ORDER BY created_at ASC
  `;
  const result = await db.prepare(query).all<PresetRow>();
  return (result.results || []).flatMap((row) => {
    try {
      return [
        {
          ...rowToPreset(row, logger),
          pending_preview_image_url:
            row.preview_image_status === 'pending' && row.preview_image_key
              ? `${PREVIEW_IMAGE_PUBLIC_BASE}/${row.preview_image_key}`
              : null,
        },
      ];
    } catch (error) {
      (logger ?? console).error(`[BUG-012] Skipping corrupted preset row id=${row.id}:`, error);
      return [];
    }
  });
}

/**
 * Get all presets submitted by a specific user
 * Returns presets in all statuses (pending, approved, rejected)
 * Sorted by creation date (newest first)
 */
export async function getPresetsByUser(
  db: D1Database,
  authorDiscordId: string,
  logger?: PresetServiceLogger,
): Promise<CommunityPreset[]> {
  // 8S My Submissions: surface the latest reject reason to the author —
  // previously it lived only in moderation_log, and a rejected submission
  // just failed to appear.
  const query = `
    SELECT p.*, (
      SELECT m.reason FROM moderation_log m
      WHERE m.preset_id = p.id AND m.action = 'reject'
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS rejection_reason
    FROM presets p
    WHERE p.author_discord_id = ?
    ORDER BY p.created_at DESC
  `;
  const result = await db.prepare(query).bind(authorDiscordId).all<PresetRow>();
  return rowsToPresets(result.results || [], logger);
}

/**
 * Check for duplicate preset by dye signature, excluding a specific preset ID
 * Used when editing to allow keeping the same dye combination
 */
export async function findDuplicatePresetExcluding(
  db: D1Database,
  dyes: number[],
  excludePresetId: string
): Promise<CommunityPreset | null> {
  const signature = generateDyeSignature(dyes);
  const query = `
    SELECT * FROM presets
    WHERE dye_signature = ? AND status IN ('approved', 'pending') AND id != ?
    LIMIT 1
  `;
  const row = await db.prepare(query).bind(signature, excludePresetId).first<PresetRow>();
  return row ? rowToPreset(row) : null;
}

/**
 * Update a preset with new values
 * Optionally stores previous values for moderation revert
 */
export async function updatePreset(
  db: D1Database,
  id: string,
  updates: PresetEditRequest,
  previousValues?: PresetPreviousValues | null,
  newStatus?: 'approved' | 'pending'
): Promise<CommunityPreset | null> {
  const now = new Date().toISOString();

  // Build dynamic UPDATE query based on provided fields
  const setClauses: string[] = ['updated_at = ?'];
  const params: (string | number | null)[] = [now];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }

  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    params.push(updates.description);
  }

  if (updates.dyes !== undefined) {
    setClauses.push('dyes = ?');
    params.push(JSON.stringify(updates.dyes));
    // Regenerate dye signature
    setClauses.push('dye_signature = ?');
    params.push(generateDyeSignature(updates.dyes));
  }

  if (updates.tags !== undefined) {
    setClauses.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }

  if (updates.example_link !== undefined) {
    setClauses.push('example_link = ?');
    params.push(updates.example_link);
  }

  if (updates.category_id !== undefined) {
    setClauses.push('category_id = ?');
    params.push(updates.category_id);
  }

  if (updates.secondary_categories !== undefined) {
    setClauses.push('secondary_categories = ?');
    params.push(JSON.stringify(updates.secondary_categories));
  }

  if (previousValues !== undefined) {
    setClauses.push('previous_values = ?');
    params.push(previousValues ? JSON.stringify(previousValues) : null);
  }

  if (newStatus !== undefined) {
    setClauses.push('status = ?');
    params.push(newStatus);
  }

  // Add WHERE clause
  params.push(id);

  // OPT-013 (2026-07-18 audit): RETURNING * instead of a re-read — halves the
  // D1 round trips and guarantees the returned entity reflects exactly this
  // request's write rather than a concurrent writer's
  const query = `
    UPDATE presets
    SET ${setClauses.join(', ')}
    WHERE id = ?
    RETURNING *
  `;

  const row = await db.prepare(query).bind(...params).first<PresetRow>();
  return row ? rowToPreset(row) : null;
}

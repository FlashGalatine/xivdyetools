/**
 * Preset Service
 * Handles preset CRUD operations with duplicate detection
 */

import type {
  Env,
  CommunityPreset,
  PresetRow,
  PresetFilters,
  PresetListResponse,
  PresetSubmission,
  PresetPreviousValues,
  PresetEditRequest,
} from '../types.js';

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
 */
export function rowToPreset(row: PresetRow): CommunityPreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_id: row.category_id as CommunityPreset['category_id'],
    dyes: JSON.parse(row.dyes),
    tags: JSON.parse(row.tags),
    author_discord_id: row.author_discord_id,
    author_name: row.author_name,
    vote_count: row.vote_count,
    status: row.status as CommunityPreset['status'],
    is_curated: row.is_curated === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    dye_signature: row.dye_signature || undefined,
    previous_values: row.previous_values ? JSON.parse(row.previous_values) : null,
  };
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
  filters: PresetFilters
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
    conditions.push('category_id = ?');
    params.push(category);
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
  const total = rows.length > 0 ? rows[0]._total : 0;
  const presets = rows.map(rowToPreset);

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
export async function getFeaturedPresets(db: D1Database): Promise<CommunityPreset[]> {
  const query = `
    SELECT * FROM presets
    WHERE status = 'approved' AND status != 'hidden'
    ORDER BY vote_count DESC, created_at DESC
    LIMIT 10
  `;
  const result = await db.prepare(query).all<PresetRow>();
  return (result.results || []).map(rowToPreset);
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
      created_at, updated_at, dye_signature
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)
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
      dyeSignature
    )
    .run();

  return {
    id,
    name: submission.name,
    description: submission.description,
    category_id: submission.category_id,
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
  };
}

/**
 * Update preset status
 */
export async function updatePresetStatus(
  db: D1Database,
  id: string,
  status: CommunityPreset['status']
): Promise<CommunityPreset | null> {
  const now = new Date().toISOString();
  const query = `
    UPDATE presets
    SET status = ?, updated_at = ?
    WHERE id = ?
  `;
  await db.prepare(query).bind(status, now, id).run();
  return getPresetById(db, id);
}

/**
 * Get pending presets for moderation
 */
export async function getPendingPresets(db: D1Database): Promise<CommunityPreset[]> {
  const query = `
    SELECT * FROM presets
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `;
  const result = await db.prepare(query).all<PresetRow>();
  return (result.results || []).map(rowToPreset);
}

/**
 * Get all presets submitted by a specific user
 * Returns presets in all statuses (pending, approved, rejected)
 * Sorted by creation date (newest first)
 */
export async function getPresetsByUser(
  db: D1Database,
  authorDiscordId: string
): Promise<CommunityPreset[]> {
  const query = `
    SELECT * FROM presets
    WHERE author_discord_id = ?
    ORDER BY created_at DESC
  `;
  const result = await db.prepare(query).bind(authorDiscordId).all<PresetRow>();
  return (result.results || []).map(rowToPreset);
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

  const query = `
    UPDATE presets
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `;

  await db.prepare(query).bind(...params).run();
  return getPresetById(db, id);
}

/**
 * Revert a preset to its previous values
 * Restores from previous_values and clears that column
 */
export async function revertPreset(
  db: D1Database,
  id: string
): Promise<CommunityPreset | null> {
  // First get the current preset to retrieve previous_values
  const current = await getPresetById(db, id);
  if (!current || !current.previous_values) {
    return null;
  }

  const previous = current.previous_values;
  const now = new Date().toISOString();
  const dyeSignature = generateDyeSignature(previous.dyes);

  const query = `
    UPDATE presets
    SET name = ?, description = ?, dyes = ?, tags = ?, dye_signature = ?,
        status = 'approved', previous_values = NULL, updated_at = ?
    WHERE id = ?
  `;

  await db
    .prepare(query)
    .bind(
      previous.name,
      previous.description,
      JSON.stringify(previous.dyes),
      JSON.stringify(previous.tags),
      dyeSignature,
      now,
      id
    )
    .run();

  return getPresetById(db, id);
}

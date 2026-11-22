import type { CommunityPreset } from '../types.js';
import { PRESET_VALIDATION_RULES } from './validation-service.js';

type OwnerSuggestion = Pick<CommunityPreset, 'id' | 'name' | 'status'>;

/** Match simple one-to-one case pairs while treating the query as literal text. */
function nameGlob(query: string): string {
  let pattern = '*';
  for (const character of query) {
    if ('*?['.includes(character)) {
      pattern += `[${character}]`;
      continue;
    }

    const lower = character.toLowerCase();
    // JavaScript uppercases ß to SS. Use its single-character counterpart.
    const upper = lower === 'ß' ? 'ẞ' : lower.toUpperCase();
    const isCasePair = lower !== upper && upper.toLowerCase() === lower &&
      (character === lower || character === upper) &&
      [...lower].length === 1 && [...upper].length === 1;
    pattern += isCasePair ? `[${lower}${upper}]` : character;
  }
  return `${pattern}*`;
}

/** Read the latest matching choices for the authenticated owner. */
export async function getOwnerSuggestions(
  db: D1Database,
  authorDiscordId: string,
  query: string,
): Promise<OwnerSuggestion[]> {
  // Neither can occur in a valid name. SQLite GLOB can stop at an embedded NUL.
  if (query.length > PRESET_VALIDATION_RULES.name.maxLength || query.includes('\0')) return [];

  const { results } = await db.prepare(`
    SELECT id, name, status
    FROM presets
    WHERE author_discord_id = ?1
      AND (?2 IS NULL OR name GLOB ?2)
    ORDER BY created_at DESC, id ASC
    LIMIT 25
  `).bind(authorDiscordId, query === '' ? null : nameGlob(query)).all<OwnerSuggestion>();
  return results;
}

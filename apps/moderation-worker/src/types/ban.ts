/**
 * Ban System Types
 *
 * Type definitions for the user ban feature in Preset Palettes.
 * Supports banning users from submitting, voting, and editing presets.
 */

/**
 * Database row for banned_users table
 */
export interface BannedUserRow {
  id: string;
  discord_id: string | null;
  xivauth_id: string | null;
  username: string;
  moderator_discord_id: string;
  reason: string;
  banned_at: string;
  unbanned_at: string | null;
  unban_moderator_discord_id: string | null;
}

/**
 * Banned user record
 */
export interface BannedUser {
  id: string;
  discordId: string | null;
  xivAuthId: string | null;
  username: string;
  moderatorDiscordId: string;
  reason: string;
  bannedAt: string;
  unbannedAt: string | null;
  unbanModeratorDiscordId: string | null;
}

/**
 * User search result for autocomplete
 */
export interface UserSearchResult {
  /** Discord user ID (used as primary identifier) */
  discordId: string;
  /** Display username from their preset submissions */
  username: string;
  /** Number of presets they have submitted */
  presetCount: number;
}

/**
 * Banned user search result for unban autocomplete
 */
export interface BannedUserSearchResult {
  /** Discord user ID */
  discordId: string | null;
  /** XIVAuth user ID */
  xivAuthId: string | null;
  /** Display username */
  username: string;
  /** When they were banned */
  bannedAt: string;
}

/**
 * Recent preset summary for ban confirmation
 */
export interface RecentPresetSummary {
  /** Preset ID */
  id: string;
  /** Preset name */
  name: string;
  /** Share URL for the preset */
  shareUrl: string;
}

/**
 * Data for the ban confirmation embed
 */
export interface BanConfirmationData {
  /** User being banned */
  user: UserSearchResult;
  /** Last 3 presets with share links */
  recentPresets: RecentPresetSummary[];
}

/**
 * Result of a ban operation
 */
export interface BanResult {
  /** Whether the ban was successful */
  success: boolean;
  /** Number of presets hidden */
  presetsHidden: number;
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Result of an unban operation
 */
export interface UnbanResult {
  /** Whether the unban was successful */
  success: boolean;
  /** Number of presets restored */
  presetsRestored: number;
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Convert database row to BannedUser object
 */
export function toBannedUser(row: BannedUserRow): BannedUser {
  return {
    id: row.id,
    discordId: row.discord_id,
    xivAuthId: row.xivauth_id,
    username: row.username,
    moderatorDiscordId: row.moderator_discord_id,
    reason: row.reason,
    bannedAt: row.banned_at,
    unbannedAt: row.unbanned_at,
    unbanModeratorDiscordId: row.unban_moderator_discord_id,
  };
}

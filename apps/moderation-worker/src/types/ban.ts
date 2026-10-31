/**
 * Ban System Types
 *
 * Type definitions for the user ban feature in Preset Palettes.
 * Supports banning users from submitting, voting, and editing presets.
 */

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
 * Result of a ban operation
 */
export interface BanResult {
  /** Whether the ban was successful */
  success: boolean;
  /** Number of presets hidden */
  presetsHidden: number;
  /** Channel-safe error message if unsuccessful (MOD-8: never a raw D1 message) */
  error?: string;
  /** The underlying error, for logging only — never shown to Discord */
  cause?: unknown;
}

/**
 * Result of an unban operation
 */
export interface UnbanResult {
  /** Whether the unban was successful */
  success: boolean;
  /** Number of presets restored */
  presetsRestored: number;
  /**
   * FINDING-021: hidden presets the restore skipped because their dye
   * combination is now held by another approved or pending preset. Absent on
   * failures.
   */
  presetsStillHidden?: number;
  /** Channel-safe error message if unsuccessful (MOD-8: never a raw D1 message) */
  error?: string;
  /** The underlying error, for logging only — never shown to Discord */
  cause?: unknown;
}

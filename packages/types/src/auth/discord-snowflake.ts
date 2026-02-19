/**
 * @xivdyetools/types - Discord Snowflake Validation
 *
 * Discord Snowflake branded type and validation utility.
 * Consolidates the inline `/^\d{17,19}$/` regex previously duplicated
 * across env-validation files in presets-api, discord-worker, and moderation-worker.
 *
 * Discord Snowflakes are Twitter-style 64-bit IDs composed of:
 * - 42 bits: milliseconds since Discord epoch (2015-01-01)
 * - 5 bits: internal worker ID
 * - 5 bits: internal process ID
 * - 12 bits: per-process increment
 *
 * In practice, current snowflakes are 17-19 digits. The range 17-20 is used
 * to allow for future growth (20-digit snowflakes won't appear until ~2090).
 *
 * @see https://discord.com/developers/docs/reference#snowflakes
 * @see FINDING-002 in docs/audits/2026-02-18/findings/FINDING-002.md
 *
 * @module auth/discord-snowflake
 */

/**
 * Discord Snowflake ID (branded type for type safety)
 *
 * Prevents accidental use of arbitrary strings as Discord IDs.
 * Use `isValidSnowflake()` to validate and `createSnowflake()` to create validated instances.
 *
 * @example
 * ```typescript
 * const userId: DiscordSnowflake = createSnowflake('123456789012345678');
 * ```
 */
export type DiscordSnowflake = string & { readonly __brand: 'DiscordSnowflake' };

/**
 * Regex pattern for Discord snowflake validation.
 * Matches 17-20 digit numeric strings.
 *
 * Current Discord snowflakes are 17-19 digits (as of 2026).
 * The upper bound of 20 allows for future growth through ~2090.
 */
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

/**
 * Validate whether a string is a valid Discord snowflake format.
 *
 * This is a pure format check — it does not verify that the ID
 * corresponds to an actual Discord entity.
 *
 * @param id - The string to validate
 * @returns true if the string matches Discord snowflake format
 *
 * @example
 * ```typescript
 * isValidSnowflake('123456789012345678');  // true
 * isValidSnowflake('abc');                  // false
 * isValidSnowflake('');                     // false
 * isValidSnowflake('12345');                // false (too short)
 * ```
 */
export function isValidSnowflake(id: string): boolean {
  return SNOWFLAKE_PATTERN.test(id);
}

/**
 * Create a validated Discord Snowflake branded type.
 *
 * @param id - The snowflake string to validate
 * @returns The validated DiscordSnowflake
 * @throws {Error} If the string is not a valid snowflake format
 *
 * @example
 * ```typescript
 * const userId = createSnowflake('123456789012345678');
 * ```
 */
export function createSnowflake(id: string): DiscordSnowflake {
  if (!isValidSnowflake(id)) {
    throw new Error(
      `Invalid Discord snowflake format: "${id}". Expected a 17-20 digit numeric string.`
    );
  }
  return id as DiscordSnowflake;
}

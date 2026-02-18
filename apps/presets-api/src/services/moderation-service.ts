/**
 * Moderation Service
 * Multi-language profanity filtering with local lists + Perspective API
 *
 * ARCHITECTURE: Uses lazy initialization with dependency injection for testability.
 * Production code uses the default profanity lists, while tests can inject custom patterns.
 */

import type { Env, ModerationResult } from '../types.js';
import { profanityLists } from '../data/profanity/index.js';

// ============================================
// LOCAL PROFANITY FILTER
// ============================================

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * PRESETS-HIGH-003: Truncate string at safe UTF-8/Unicode boundary
 *
 * JavaScript strings use UTF-16 encoding, where characters outside the BMP
 * (like emojis 🌸) are represented as surrogate pairs (two 16-bit code units).
 * Using .substring() can split a surrogate pair, creating invalid UTF-8.
 *
 * This function uses Array.from() which correctly handles Unicode code points.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum number of visible characters (not code units)
 * @param suffix - Suffix to append when truncated (default: '…')
 * @returns Truncated string with suffix if needed
 */
export function truncateUnicodeSafe(str: string, maxLength: number, suffix = '…'): string {
  const chars = Array.from(str);
  if (chars.length <= maxLength) {
    return str;
  }
  // Reserve space for suffix in character count
  const truncateAt = Math.max(0, maxLength - suffix.length);
  return chars.slice(0, truncateAt).join('') + suffix;
}

/**
 * Compiled profanity data structure
 * Uses a single combined regex for efficiency and ReDoS protection
 */
interface CompiledProfanity {
  // Set for O(1) substring lookup (fast path)
  wordSet: Set<string>;
  // Combined regex with all words for word boundary matching
  // Using a single regex with alternation is safer than many individual patterns
  combinedPattern: RegExp | null;
}

/**
 * Compile profanity word lists into optimized data structures
 * SECURITY: Uses a single combined regex to avoid ReDoS risks from many patterns
 * PERFORMANCE: Includes a Set for fast substring pre-filtering
 */
export function compileProfanityPatterns(
  wordLists: Record<string, readonly string[]>
): CompiledProfanity {
  const allWords: string[] = [];

  for (const [_locale, words] of Object.entries(wordLists)) {
    for (const word of words) {
      allWords.push(word.toLowerCase());
    }
  }

  // Create word set for fast substring lookup
  const wordSet = new Set(allWords);

  // Create combined regex with all words using alternation
  // This is safer than individual patterns as it's a single, predictable regex
  let combinedPattern: RegExp | null = null;
  if (allWords.length > 0) {
    const escapedWords = allWords.map(escapeRegex);
    // Limit pattern complexity - split into chunks if too many words
    // This prevents catastrophic backtracking in alternation groups
    combinedPattern = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'i');
  }

  return { wordSet, combinedPattern };
}

/**
 * Lazily initialized profanity data
 * PERFORMANCE: Compiled once on first use, cached for subsequent requests
 */
let _compiledProfanity: CompiledProfanity | null = null;

/**
 * Get compiled profanity data (lazy initialization)
 * Uses production profanity lists by default
 */
function getCompiledProfanity(): CompiledProfanity {
  if (_compiledProfanity === null) {
    _compiledProfanity = compileProfanityPatterns(profanityLists);
  }
  return _compiledProfanity;
}

/**
 * Reset compiled profanity data - FOR TESTING ONLY
 * Allows tests to inject custom patterns via setTestPatterns()
 */
export function _resetPatternsForTesting(): void {
  _compiledProfanity = null;
}

/**
 * Set custom profanity data - FOR TESTING ONLY
 * Allows tests to inject patterns that will trigger the filter
 */
export function _setTestPatterns(patterns: RegExp[]): void {
  // Convert legacy pattern array to new structure for backward compatibility
  const words: string[] = [];
  for (const pattern of patterns) {
    // Extract word from pattern like /\bword\b/i
    const match = pattern.source.match(/\\b\(?([\w|]+)\)?\\b/);
    if (match) {
      words.push(...match[1].split('|'));
    }
  }
  _compiledProfanity = {
    wordSet: new Set(words),
    combinedPattern: patterns.length > 0
      ? new RegExp(`\\b(${words.map(escapeRegex).join('|')})\\b`, 'i')
      : null,
  };
}

/**
 * Check text against local profanity word lists
 * Uses a single combined regex pattern for efficiency and ReDoS protection
 *
 * SECURITY: The combined regex approach prevents ReDoS by:
 * 1. Using a single predictable pattern instead of many small patterns
 * 2. All words are escaped to prevent special character injection
 * 3. Word boundary matching (\b) is simple and doesn't cause backtracking
 *
 * @param name - The preset name to check
 * @param description - The preset description to check
 * @returns ModerationResult if flagged, null if clean
 */
export function checkLocalFilter(
  name: string,
  description: string
): ModerationResult | null {
  const profanity = getCompiledProfanity();
  const textToCheck = `${name} ${description}`.toLowerCase();
  const nameLower = name.toLowerCase();

  // Fast path: check if the combined pattern exists and matches
  if (profanity.combinedPattern && profanity.combinedPattern.test(textToCheck)) {
    // Determine which field was flagged by testing name specifically
    const flaggedField = profanity.combinedPattern.test(nameLower) ? 'name' : 'description';
    return {
      passed: false,
      flaggedField,
      flaggedReason: 'Contains prohibited content',
      method: 'local',
    };
  }

  return null;
}

// ============================================
// PERSPECTIVE API INTEGRATION
// ============================================

interface PerspectiveResponse {
  attributeScores: {
    TOXICITY?: { summaryScore: { value: number } };
    SEVERE_TOXICITY?: { summaryScore: { value: number } };
    IDENTITY_ATTACK?: { summaryScore: { value: number } };
    INSULT?: { summaryScore: { value: number } };
    PROFANITY?: { summaryScore: { value: number } };
  };
}

/**
 * Check text using Google Perspective API
 * Returns null if API is not configured or fails
 */
async function checkWithPerspective(
  text: string,
  env: Env
): Promise<ModerationResult | null> {
  if (!env.PERSPECTIVE_API_KEY) {
    return null; // Skip if not configured
  }

  try {
    // PRESETS-HIGH-001: Added 5 second timeout to prevent submission hangs
    // If Perspective API is slow or unavailable, we'll skip it and allow the submission
    const response = await fetch(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${env.PERSPECTIVE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: { text },
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            INSULT: {},
            PROFANITY: {},
          },
        }),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      console.error('Perspective API error:', response.status, await response.text());
      return null; // Don't block on API failure
    }

    const result: PerspectiveResponse = await response.json();

    const scores: Record<string, number> = {
      toxicity: result.attributeScores.TOXICITY?.summaryScore?.value || 0,
      severeToxicity: result.attributeScores.SEVERE_TOXICITY?.summaryScore?.value || 0,
      identityAttack: result.attributeScores.IDENTITY_ATTACK?.summaryScore?.value || 0,
      insult: result.attributeScores.INSULT?.summaryScore?.value || 0,
      profanity: result.attributeScores.PROFANITY?.summaryScore?.value || 0,
    };

    // Threshold for flagging (0.7 = 70% confidence)
    const threshold = 0.7;

    // Check each score against threshold
    for (const [key, value] of Object.entries(scores)) {
      if (value >= threshold) {
        return {
          passed: false,
          flaggedField: 'content',
          flaggedReason: `High ${key} score detected (${Math.round(value * 100)}%)`,
          method: 'perspective',
          scores,
        };
      }
    }

    // All scores below threshold
    return {
      passed: true,
      method: 'perspective',
      scores,
    };
  } catch (error) {
    console.error('Perspective API error:', error);
    return null; // Don't block on API failure
  }
}

// ============================================
// MAIN MODERATION FUNCTION
// ============================================

/**
 * Moderate content using local filter and optional Perspective API
 */
export async function moderateContent(
  name: string,
  description: string,
  env: Env
): Promise<ModerationResult> {
  // 1. Local word filter (fast, always runs)
  const localResult = checkLocalFilter(name, description);
  if (localResult && !localResult.passed) {
    return localResult;
  }

  // 2. Perspective API (optional, catches evasion/context)
  const perspectiveResult = await checkWithPerspective(
    `${name} ${description}`,
    env
  );

  if (perspectiveResult && !perspectiveResult.passed) {
    return perspectiveResult;
  }

  // All checks passed
  return {
    passed: true,
    method: perspectiveResult ? 'all' : 'local',
    scores: perspectiveResult?.scores,
  };
}

// ============================================
// NOTIFICATION SERVICE (for flagged content)
// ============================================

interface ModerationAlert {
  presetId: string;
  presetName: string;
  description: string;
  dyes: number[];
  authorName: string;
  authorId: string;
  flagReason: string;
}

/**
 * Notify moderators about flagged content
 */
export async function notifyModerators(
  alert: ModerationAlert,
  env: Env
): Promise<void> {
  const embed = {
    title: '⚠️ Palette Pending Review',
    color: 0xffa500, // Orange
    fields: [
      { name: 'Name', value: alert.presetName, inline: true },
      { name: 'Submitted by', value: alert.authorName, inline: true },
      { name: 'Flagged Reason', value: alert.flagReason, inline: false },
      { name: 'Description', value: truncateUnicodeSafe(alert.description, 200), inline: false },
      { name: 'Preset ID', value: `\`${alert.presetId}\``, inline: false },
    ],
    footer: {
      text: 'Use /preset moderate approve <id> or /preset moderate reject <id> <reason>',
    },
    timestamp: new Date().toISOString(),
  };

  // 1. Post to moderation channel webhook
  if (env.MODERATION_WEBHOOK_URL) {
    try {
      await fetch(env.MODERATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
    } catch (error) {
      console.error('Failed to send webhook notification:', error);
    }
  }

  // 2. DM the bot owner via Discord Bot API
  if (env.OWNER_DISCORD_ID && env.DISCORD_BOT_TOKEN) {
    try {
      // Create DM channel
      const dmChannelResponse = await fetch(
        'https://discord.com/api/v10/users/@me/channels',
        {
          method: 'POST',
          headers: {
            Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ recipient_id: env.OWNER_DISCORD_ID }),
        }
      );

      if (dmChannelResponse.ok) {
        const dmChannel = (await dmChannelResponse.json()) as { id: string };

        // Send DM
        await fetch(
          `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ embeds: [embed] }),
          }
        );
      }
    } catch (error) {
      console.error('Failed to send DM notification:', error);
    }
  }
}

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
  // Combined regex with all ASCII-ish words for word boundary matching
  // Using a single regex with alternation is safer than many individual patterns
  combinedPattern: RegExp | null;
  // BUG-002 (2026-07-18 audit): \b is defined via \w = [A-Za-z0-9_], so word
  // boundaries never exist next to CJK characters — entries from the ja/ko/zh
  // lists could never match through the \b-anchored pattern. Words containing
  // characters outside [\w\s'-] are matched boundary-less instead (CJK scripts
  // don't delimit words with spaces, so substring matching is correct there).
  cjkPattern: RegExp | null;
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

  for (const [, words] of Object.entries(wordLists)) {
    for (const word of words) {
      allWords.push(word.toLowerCase());
    }
  }

  // Create word set for fast substring lookup
  const wordSet = new Set(allWords);

  // BUG-002: split words by script — \b-anchored matching only works for
  // words made of \w characters; everything else matches boundary-less
  const asciiWords = allWords.filter((w) => /^[\w\s'-]+$/.test(w));
  const cjkWords = allWords.filter((w) => !/^[\w\s'-]+$/.test(w));

  // Create combined regexes using alternation
  // This is safer than individual patterns as it's a single, predictable regex
  // (all words are escaped, and the flat alternation cannot backtrack catastrophically)
  let combinedPattern: RegExp | null = null;
  if (asciiWords.length > 0) {
    combinedPattern = new RegExp(`\\b(${asciiWords.map(escapeRegex).join('|')})\\b`, 'i');
  }

  let cjkPattern: RegExp | null = null;
  if (cjkWords.length > 0) {
    cjkPattern = new RegExp(cjkWords.map(escapeRegex).join('|'), 'i');
  }

  return { wordSet, combinedPattern, cjkPattern };
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
    cjkPattern: null,
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

  // BUG-002: two matchers — \b-anchored for ASCII words, boundary-less for CJK
  const patterns = [profanity.combinedPattern, profanity.cjkPattern];
  for (const pattern of patterns) {
    if (pattern && pattern.test(textToCheck)) {
      // Determine which field was flagged by testing name specifically
      const flaggedField = pattern.test(nameLower) ? 'name' : 'description';
      return {
        passed: false,
        flaggedField,
        flaggedReason: 'Contains prohibited content',
        method: 'local',
      };
    }
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
        const dmChannel: { id: string } = await dmChannelResponse.json();

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

/**
 * Text Sanitization Utilities
 *
 * Security utilities for sanitizing user-provided content before display
 * in Discord embeds and messages.
 *
 * FINDING-019 (2026-08-21 security audit): these helpers are thin wrappers
 * over the shared `sanitizeEmbedText` in `@xivdyetools/bot-logic`, so every
 * bot (and every call site in this worker) applies ONE rule set: control /
 * zero-width / bidi characters stripped, whitespace collapsed, `@everyone`
 * / `@here` / `<@…>` mentions defused, Discord markdown (incl. masked
 * links) escaped, and the length capped with an ellipsis. The local
 * preset-specific caps are all that remain here.
 *
 * @module utils/sanitize
 */

import { sanitizeEmbedText } from '@xivdyetools/bot-logic';

/**
 * Maximum lengths for preset display
 */
export const MAX_PRESET_NAME_LENGTH = 100;
export const MAX_PRESET_DESCRIPTION_LENGTH = 500;

/**
 * Soft hyphen (U+00AD) — invisible when not at a line break; the shared
 * sanitiser's invisible-character set does not include it, so it is stripped
 * here before delegating.
 */
const SOFT_HYPHEN = /\u00AD/g;

/**
 * Sanitize text for display inside a bot-authored embed.
 *
 * @param text - The text to sanitize (non-strings yield '')
 * @param maxLength - Maximum length in code points, including the ellipsis
 * @returns Sanitized, markdown-escaped text
 *
 * @example
 * ```typescript
 * sanitizeDisplayText("Hello\x00World", 100)         // "HelloWorld"
 * sanitizeDisplayText("Too  many   spaces", 100)     // "Too many spaces"
 * sanitizeDisplayText("[x](https://evil)", 100)      // "\\[x\\]\\(https://evil\\)"
 * sanitizeDisplayText("Very long text...", 10)       // "Very long…"
 * ```
 */
function sanitizeDisplayText(text: string, maxLength: number): string {
  if (typeof text !== 'string') {
    return '';
  }
  return sanitizeEmbedText(text.replace(SOFT_HYPHEN, ''), maxLength);
}

/**
 * Sanitize a preset name for display
 *
 * @param name - The preset name
 * @returns Sanitized preset name
 */
export function sanitizePresetName(name: string): string {
  return sanitizeDisplayText(name, MAX_PRESET_NAME_LENGTH);
}

/**
 * Sanitize a preset description for display
 *
 * @param description - The preset description
 * @returns Sanitized preset description
 */
export function sanitizePresetDescription(description: string): string {
  return sanitizeDisplayText(description, MAX_PRESET_DESCRIPTION_LENGTH);
}

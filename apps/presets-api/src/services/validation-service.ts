/**
 * Validation Service
 * PRESETS-REF-001 FIX: Centralized validation logic for presets and moderation.
 *
 * Provides:
 * - Generic string/array validation helpers
 * - Preset-specific validators (name, description, dyes, tags)
 * - Moderation-specific validators (status, reason)
 * - Validation rule constants for consistent error messaging
 */

// ============================================================================
// Validation Rule Constants
// ============================================================================

/**
 * Preset validation rules - exported for use in error messages and tests
 */
export const PRESET_VALIDATION_RULES = {
  name: {
    minLength: 2,
    maxLength: 50,
  },
  description: {
    minLength: 10,
    maxLength: 200,
  },
  dyes: {
    minLength: 3,
    maxLength: 6,
  },
  tags: {
    maxLength: 10,
    itemMaxLength: 30,
  },
  secondaryCategories: {
    maxLength: 2,
  },
} as const;

/**
 * Moderation validation rules
 */
export const MODERATION_VALIDATION_RULES = {
  reason: {
    minLength: 10,
    maxLength: 200,
  },
  validStatuses: ['approved', 'rejected', 'flagged', 'pending'] as const,
} as const;

// ============================================================================
// Character Rules (FINDING-019 / FINDING-028, 2026-08-21 security audit)
// ============================================================================
//
// Name, description and tags used to be length-checked only. A C0 control
// character in a name made the bot's SVG card fail to render (resvg rejects
// XML-illegal code points), and zero-width / bidi-override characters let a
// name or tag read as something it is not in Discord embeds and the gallery.
// Everything user-visible that this worker stores is checked here, once.

/** C0 controls, DEL and C1 controls — no single-line field may carry any of them. */
// eslint-disable-next-line no-control-regex -- matching control characters (to reject them) is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/u;

/** Same set minus TAB / LF / CR, which a multi-line description legitimately uses. */
// eslint-disable-next-line no-control-regex -- matching control characters (to reject them) is the point
const CONTROL_CHARS_ALLOWING_LINE_BREAKS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

/**
 * Invisible formatting characters: zero-width space / non-joiner, bidi marks,
 * bidi embeddings + overrides (U+202A–U+202E), bidi isolates (U+2066–U+2069),
 * the BOM / zero-width no-break space and the Unicode line & paragraph
 * separators. U+200D (zero-width joiner) is deliberately NOT in this class —
 * see hasInvisibleCharacters.
 */
const INVISIBLE_CHARS = /[\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff\u2028\u2029]/u;

const ZERO_WIDTH_JOINER = '\u200d';

/**
 * Code points a zero-width joiner may legitimately sit between: emoji
 * (Misc Symbols & Pictographs through Symbols Extended-A, plus the BMP
 * Miscellaneous Symbols / Dingbats block) and the emoji presentation selector.
 * Skin-tone modifiers (U+1F3FB–U+1F3FF) fall inside the first range.
 */
const EMOJI_JOINABLE = /^(?:[\u{1F000}-\u{1FAFF}]|[\u2600-\u27BF]|\uFE0F)$/u;

/**
 * True when the string carries an invisible formatting character.
 *
 * The zero-width joiner is the one nuance: it is the glue inside emoji
 * sequences (rainbow flag, family, astronaut with skin tone), which preset
 * names legitimately use — but between ordinary letters it is exactly the
 * hidden-padding trick this rule exists to stop. So a ZWJ is allowed only
 * with emoji on BOTH sides.
 */
function hasInvisibleCharacters(value: string): boolean {
  if (INVISIBLE_CHARS.test(value)) return true;
  if (!value.includes(ZERO_WIDTH_JOINER)) return false;

  const chars = Array.from(value); // code points, not UTF-16 units
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== ZERO_WIDTH_JOINER) continue;
    const prev = chars[i - 1];
    const next = chars[i + 1];
    if (prev === undefined || next === undefined) return true;
    if (!EMOJI_JOINABLE.test(prev) || !EMOJI_JOINABLE.test(next)) return true;
  }
  return false;
}

/**
 * Strip control, bidi and invisible characters from a display name that comes
 * from the auth token (FINDING-016). The user cannot edit that name here, so
 * rejecting it would 400 every create and refresh for them; stripping stores
 * what the rest of the rule set would have accepted. A ZWJ survives only
 * between emoji, exactly as `hasInvisibleCharacters` allows.
 */
export function sanitizeAuthorName(name: string): string {
  const kept = Array.from(name).filter(
    (ch) => ch === ZERO_WIDTH_JOINER || (!CONTROL_CHARS.test(ch) && !INVISIBLE_CHARS.test(ch))
  );
  return kept
    .filter((ch, i) => {
      if (ch !== ZERO_WIDTH_JOINER) return true;
      const prev = kept[i - 1];
      const next = kept[i + 1];
      return (
        prev !== undefined &&
        next !== undefined &&
        EMOJI_JOINABLE.test(prev) &&
        EMOJI_JOINABLE.test(next)
      );
    })
    .join('')
    .trim();
}

/**
 * Shared character rule for a user-visible text field.
 *
 * @param value - the string to check
 * @param allowLineBreaks - whether TAB / LF / CR are acceptable (multi-line fields)
 * @returns true when the value is clean
 */
function hasOnlySupportedCharacters(value: string, allowLineBreaks: boolean): boolean {
  const controls = allowLineBreaks ? CONTROL_CHARS_ALLOWING_LINE_BREAKS : CONTROL_CHARS;
  return !controls.test(value) && !hasInvisibleCharacters(value);
}

/**
 * Tag grammar: starts and ends with a letter, digit (or a mark attached to
 * one), with letters / digits / marks / spaces / hyphens / underscores /
 * apostrophes (both ' and ’) in between. Unicode-aware, so CJK tags work.
 * Markdown, brackets, URLs, hashes and every other punctuation are out — a
 * tag is rendered verbatim in Discord embeds and is never moderated.
 */
const TAG_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{M}\p{N} _'’-]*[\p{L}\p{M}\p{N}])?$/u;

const UNSUPPORTED_CHARACTERS_SUFFIX =
  'contains unsupported characters (control, zero-width or text-direction characters are not allowed)';

// ============================================================================
// Preset-Specific Validators
// ============================================================================

/**
 * Validate a preset name
 *
 * @param name - The name to validate
 * @returns Error message or null if valid
 */
export function validatePresetName(name: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.name;

  // Keep original error message format for backwards compatibility
  if (typeof name !== 'string') {
    return 'Name is required';
  }

  // BUG-068: the minimum ignores surrounding whitespace, or '  ' passes and is
  // stored blank. The maximum stays on the value as sent, which is what is stored.
  if (name.trim().length < rules.minLength || name.length > rules.maxLength) {
    return `Name must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  // FINDING-028: a name is one line of printable text
  if (!hasOnlySupportedCharacters(name, false)) {
    return `Name ${UNSUPPORTED_CHARACTERS_SUFFIX}`;
  }

  return null;
}

/**
 * Validate a preset description
 *
 * @param description - The description to validate
 * @returns Error message or null if valid
 */
export function validatePresetDescription(description: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.description;

  // Keep original error message format for backwards compatibility
  if (typeof description !== 'string') {
    return 'Description is required';
  }

  // BUG-068: same split as the name — minimum on the trimmed text, maximum on
  // the stored value.
  if (description.trim().length < rules.minLength || description.length > rules.maxLength) {
    return `Description must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  // FINDING-028: multi-line, so TAB / LF / CR stay legal; everything else in
  // the control and invisible classes is rejected
  if (!hasOnlySupportedCharacters(description, true)) {
    return `Description ${UNSUPPORTED_CHARACTERS_SUFFIX}`;
  }

  return null;
}

/**
 * Validate preset dyes array
 *
 * @param dyes - The dyes array to validate
 * @returns Error message or null if valid
 */
export function validatePresetDyes(dyes: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.dyes;

  // Check array structure
  if (!Array.isArray(dyes) || dyes.length < rules.minLength || dyes.length > rules.maxLength) {
    return `Must include ${rules.minLength}-${rules.maxLength} dyes`;
  }

  // Check each element is a positive integer
  if (!dyes.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
    return 'Invalid dye IDs';
  }

  // 5.0 range guard: dyes are stainIDs (1-254). Legacy itemIDs (>= 5729) are
  // a disjoint range — without this guard a half-migrated client fails
  // SILENTLY (resolvers return null and palettes render empty). Reject the
  // wrong era loudly instead.
  const legacy = dyes.find((id: number) => id >= 5000);
  if (legacy !== undefined) {
    return `Dye ${legacy} looks like a legacy item ID; expected a stainID (1-254)`;
  }
  if (!dyes.every((id: number) => id <= 254)) {
    return 'Dye IDs must be stainIDs (1-254)';
  }

  // BUG-010: every dye at most once. [7,7,7] is one colour posing as a 3-dye
  // palette, and [1,2,3,3] gets a dye_signature different from [1,2,3], so it
  // slips past the duplicate-combination check. Rejected rather than de-duped:
  // the web app never sends a repeat (its pickers toggle a dye off, and the
  // glamour palette is deduped by stainID), so a repeat comes from the bot's
  // dye1..dye6 options, where silently dropping one would turn [1,2,3,3] into
  // a vote on someone else's [1,2,3] preset instead of telling the author.
  if (new Set(dyes).size !== dyes.length) {
    return 'Each dye may appear only once';
  }

  return null;
}

/**
 * Validate preset tags array
 *
 * @param tags - The tags array to validate
 * @returns Error message or null if valid
 */
export function validatePresetTags(tags: unknown): string | null {
  const rules = PRESET_VALIDATION_RULES.tags;

  // Check array type
  if (!Array.isArray(tags)) {
    return 'Tags must be an array';
  }

  // Check array length
  if (tags.length > rules.maxLength) {
    return `Maximum ${rules.maxLength} tags allowed`;
  }

  // Check each tag
  if (tags.some((tag) => typeof tag !== 'string' || tag.length > rules.itemMaxLength)) {
    return `Each tag must be a string of max ${rules.itemMaxLength} characters`;
  }

  // FINDING-019 (PAPI-6): tags are rendered verbatim in Discord embeds and the
  // gallery and never pass content moderation, so their charset is narrow.
  // TAG_PATTERN already excludes control and invisible characters (none of
  // them are letters, marks, digits or the four allowed separators) — the
  // explicit check just keeps the ZWJ-between-emoji nuance out of tags too.
  if (
    (tags as string[]).some(
      (tag) => !TAG_PATTERN.test(tag) || !hasOnlySupportedCharacters(tag, false)
    )
  ) {
    return 'Tags may only contain letters, numbers, spaces, hyphens, underscores and apostrophes, and must start and end with a letter or number';
  }

  return null;
}

/** Cap on additional categories. One primary + this many = three total. */
export const SECONDARY_CATEGORY_MAX = PRESET_VALIDATION_RULES.secondaryCategories.maxLength;

/**
 * Validate the secondary category list.
 *
 * `undefined` is valid — the field is optional on both submit and edit. `[]`
 * is valid and is how a caller clears the list. The primary is passed in
 * because a category may not occupy both slots: it would double-count in the
 * gallery rail and read as a data error to anyone looking at the row.
 *
 * @param value - candidate list
 * @param primary - the preset's category_id after this request applies
 * @param validCategories - ids from getValidCategories(db)
 * @returns Error message or null if valid
 */
export function validateSecondaryCategories(
  value: unknown,
  primary: string,
  validCategories: readonly string[]
): string | null {
  if (value === undefined) return null;

  if (!Array.isArray(value)) {
    return 'Secondary categories must be an array';
  }

  if (value.length > SECONDARY_CATEGORY_MAX) {
    return `at most ${SECONDARY_CATEGORY_MAX} secondary categories allowed`;
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || !validCategories.includes(entry)) {
      return 'Invalid secondary category';
    }
    if (entry === primary) {
      return 'A secondary category cannot repeat the primary category';
    }
  }

  if (new Set(value as string[]).size !== value.length) {
    return 'Secondary categories contain a duplicate';
  }

  return null;
}

// ============================================================================
// Moderation-Specific Validators
// ============================================================================

/**
 * Validate a moderation status
 *
 * @param status - The status to validate
 * @returns Error message or null if valid
 */
export function validateModerationStatus(status: unknown): string | null {
  const validStatuses = MODERATION_VALIDATION_RULES.validStatuses;

  if (!status || typeof status !== 'string' || !(validStatuses as readonly string[]).includes(status)) {
    return `Status must be one of: ${validStatuses.join(', ')}`;
  }

  return null;
}

/**
 * Validate a moderation reason
 *
 * @param reason - The reason to validate
 * @returns Error message or null if valid
 */
export function validateModerationReason(reason: unknown): string | null {
  const rules = MODERATION_VALIDATION_RULES.reason;

  if (!reason || typeof reason !== 'string') {
    return `Reason must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  if (reason.length < rules.minLength || reason.length > rules.maxLength) {
    return `Reason must be ${rules.minLength}-${rules.maxLength} characters`;
  }

  return null;
}

/**
 * Example-link host allowlist.
 *
 * This list is not "hosts we can fetch from" — the link is never fetched. It
 * is "where we are willing to send our users", which makes it a spam and
 * phishing control. Entries are destinations that carry a glamour's
 * information (gear list, credit, comments), not image hosts: a raw image is
 * exactly what this field is not for.
 *
 * Exact hosts plus their subdomains (www.eorzeacollection.com, old.reddit.com).
 * The client mirrors this list in apps/web-app/src/shared/example-link.ts.
 */
export const EXAMPLE_LINK_HOSTS = [
  'eorzeacollection.com',
  'mirapri.com',
  'reddit.com',
  'redd.it',
  'x.com',
  'twitter.com',
  'bsky.app',
  'instagram.com',
  'pixiv.net',
  'finalfantasyxiv.com',
  'misskey.io',
] as const;

const EXAMPLE_LINK_MAX_LENGTH = 300;

/**
 * Validate an 8A example link: https, allowlisted host, bounded length.
 * `null`/`undefined`/`''` are valid (the field is optional; empty clears it),
 * and so is a whitespace-only string, which normalizeExampleLink also clears.
 *
 * @param link - The link to validate
 * @returns Error message or null if valid
 */
export function validateExampleLink(link: unknown): string | null {
  if (link === undefined || link === null || link === '') {
    return null;
  }
  if (typeof link !== 'string') {
    return 'Example link must be a URL string';
  }
  if (link.length > EXAMPLE_LINK_MAX_LENGTH) {
    return `Example link must be at most ${EXAMPLE_LINK_MAX_LENGTH} characters`;
  }

  // FINDING-016: the raw string is what a naive reader would see, so it gets
  // the same character rule as name / description / tags. `new URL()` below
  // silently strips tabs, newlines and spaces, which would hide them.
  if (!hasOnlySupportedCharacters(link, false)) {
    return `Example link ${UNSUPPORTED_CHARACTERS_SUFFIX}`;
  }

  // BUG-069: judge exactly what normalizeExampleLink will store — it trims. A
  // leading space used to fail the scheme test below, get `https://` prefixed
  // onto a full URL and 400 as "not a valid URL"; whitespace alone is empty
  // there, so it clears the field here too. The two checks above stay on the
  // raw string on purpose (FINDING-016).
  const trimmed = link.trim();
  if (trimmed === '') {
    return null;
  }

  let url: URL;
  try {
    // Accept links pasted without a scheme ("eorzeacollection.com/…")
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return 'Example link is not a valid URL';
  }

  if (url.protocol !== 'https:') {
    return 'Example link must use https';
  }

  const host = url.hostname.toLowerCase();
  const allowed = EXAMPLE_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!allowed) {
    return `Example link host must be one of: ${EXAMPLE_LINK_HOSTS.join(', ')}`;
  }

  return null;
}

/**
 * Normalize a validated example link for storage (adds https:// when the
 * author pasted a bare host, trims whitespace). Returns null for empty input.
 */
export function normalizeExampleLink(link: string | null | undefined): string | null {
  if (link === undefined || link === null) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  // FINDING-016: store the canonical form (percent-encoded, whitespace and
  // controls stripped), not the pasted text. An unparsable value never reaches
  // here after validateExampleLink; fall back to the trimmed input regardless.
  try {
    return new URL(withScheme).href;
  } catch {
    return withScheme;
  }
}

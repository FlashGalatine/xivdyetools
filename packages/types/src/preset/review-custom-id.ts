/**
 * @xivdyetools/types - Review custom_ids
 *
 * The one copy of the moderation-review `custom_id` grammar and the status
 * list it carries. discord-worker builds these ids for new moderation embeds,
 * moderation-worker builds them for refreshed embeds / confirmations / modals
 * and parses every click, and presets-api accepts the same status words as
 * `expected_status`. REFACTOR-001 (2026-10-04 deep-dive): those were three
 * hand-copied lists and two hand-copied grammars with no parity check.
 *
 * FINDING-017 (2026-10-03 audit): a moderator's click must name the text they
 * reviewed. The button (and the modal it opens) therefore carries the preset's
 * `content_revision` and the status the moderator saw; presets-api refuses the
 * change with a 409 when either no longer matches what is stored.
 *
 * Formats (every id is at most 100 characters, Discord's cap):
 *
 *   preset_approve_<uuid>:<revision>:<status>        approve button
 *   preset_reject_<uuid>:<revision>:<status>         reject button  (opens the modal)
 *   preset_revert_<uuid>:<revision>:<status>         revert button  (opens the modal)
 *   preset_reject_modal_<uuid>:<revision>:<status>   rejection reason modal
 *   preset_revert_modal_<uuid>:<revision>:<status>   revert reason modal
 *
 * - `<uuid>`     a UUID v4 (the preset id), lowercase or uppercase hex.
 * - `<revision>` a non-negative decimal integer with no sign, no leading zeros
 *                and no whitespace, within Number.MAX_SAFE_INTEGER.
 * - `<status>`   the full status word: pending | approved | rejected | flagged | hidden.
 *
 * Legacy ids (no `:<revision>:<status>` suffix) are what messages posted before
 * FINDING-017 still carry, and what discord-worker emits when it has no valid
 * revision to bind:
 *
 *   preset_approve_<uuid>   preset_reject_<uuid>   preset_revert_<uuid>
 *   preset_reject_modal_<uuid>   preset_revert_modal_<uuid>
 *
 * They still parse, with `binding: null` ("no reviewed revision"). A handler
 * must never act on a legacy id: it refreshes the message and asks for a new
 * click instead.
 *
 * This is a wire format: ids already posted in Discord channels must keep
 * parsing, so the grammar here changes only together with a migration story.
 *
 * @module preset/review-custom-id
 */

import type { PresetStatus } from './core.js';

/** Discord's custom_id cap. */
const CUSTOM_ID_MAX = 100;

/**
 * Every status a preset can be in — what a moderator may have been looking at,
 * and therefore every status presets-api accepts as `expected_status` and a
 * review custom_id may carry. Pinned to {@link PresetStatus} in both directions
 * by this module's test. Frozen: presets-api checks it with `.includes()` while
 * the parser reads a Set built from it, so a widened array would split them.
 */
export const REVIEW_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'flagged',
  'hidden',
] as const) satisfies readonly PresetStatus[];

const REVIEW_STATUS_SET: ReadonlySet<string> = new Set<string>(REVIEW_STATUSES);

/** `true` when `value` is exactly one of {@link REVIEW_STATUSES} (case-sensitive). */
export function isReviewStatus(value: unknown): value is PresetStatus {
  return typeof value === 'string' && REVIEW_STATUS_SET.has(value);
}

/** A review button's action — the `<action>` in `preset_<action>_…`. */
export type ReviewAction = 'approve' | 'reject' | 'revert';

/** Every review custom_id kind: the three buttons and the two reason modals. */
export type ReviewKind = ReviewAction | 'reject_modal' | 'revert_modal';

/** What the moderator reviewed — mirrors presets-api's `expected_revision` / `expected_status`. */
export interface ReviewBinding {
  revision: number;
  status: PresetStatus;
}

/** A parsed review custom_id. */
export interface ParsedReviewId {
  kind: ReviewKind;
  presetId: string;
  /** `null` for a legacy id that names no reviewed revision. */
  binding: ReviewBinding | null;
}

/**
 * Longest prefixes first: `preset_reject_modal_` also begins with
 * `preset_reject_`, and the shorter one would swallow it.
 */
const PREFIXES: ReadonlyArray<readonly [ReviewKind, string]> = [
  ['reject_modal', 'preset_reject_modal_'],
  ['revert_modal', 'preset_revert_modal_'],
  ['approve', 'preset_approve_'],
  ['reject', 'preset_reject_'],
  ['revert', 'preset_revert_'],
];

const PREFIX_BY_KIND: Readonly<Record<ReviewKind, string>> = {
  approve: 'preset_approve_',
  reject: 'preset_reject_',
  revert: 'preset_revert_',
  reject_modal: 'preset_reject_modal_',
  revert_modal: 'preset_revert_modal_',
};

/**
 * The prefix for `kind`. Throws for a kind outside {@link ReviewKind} (an
 * untyped or cast caller), as moderation-worker's builder did: an id beginning
 * "undefined" would only parse to `null` and fail quietly.
 */
function prefixFor(kind: ReviewKind): string {
  const prefix = PREFIX_BY_KIND[kind] as string | undefined;
  if (prefix === undefined) throw new Error(`unknown review kind: ${String(kind)}`);
  return prefix;
}

/**
 * UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx, y one of 8, 9, a, b; either
 * case. Preset ids are `crypto.randomUUID()` values minted by presets-api.
 */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REVISION_RE = /^(0|[1-9][0-9]*)$/;

/**
 * Parse a review custom_id; `null` for anything that is not exactly one of the
 * formats above (including anything over 100 characters). `presetId` is
 * returned exactly as it appears in the id — an upper-case UUID stays upper
 * case.
 */
export function parseReviewCustomId(customId: string): ParsedReviewId | null {
  if (customId.length > CUSTOM_ID_MAX) return null;

  const entry = PREFIXES.find(([, prefix]) => customId.startsWith(prefix));
  if (!entry) return null;
  const [kind, prefix] = entry;

  const parts = customId.slice(prefix.length).split(':');
  const presetId = parts[0];
  if (!UUID_V4_RE.test(presetId)) return null;

  if (parts.length === 1) return { kind, presetId, binding: null };
  if (parts.length !== 3) return null;

  const [, revisionText, status] = parts;
  if (!REVISION_RE.test(revisionText) || !isReviewStatus(status)) return null;
  const revision = Number(revisionText);
  if (!Number.isSafeInteger(revision)) return null;

  return { kind, presetId, binding: { revision, status } };
}

/**
 * Build a revision-bound custom_id from a binding the caller has already
 * validated (moderation-worker's refreshed embeds, confirmations and modals).
 * Nothing is checked here — not the UUID, the revision, the status or the
 * length; use {@link buildReviewCustomIdOrLegacy} for untrusted input.
 */
export function buildReviewCustomId(
  kind: ReviewKind,
  presetId: string,
  binding: ReviewBinding,
): string {
  return `${prefixFor(kind)}${presetId}:${binding.revision}:${binding.status}`;
}

/**
 * Build a custom_id from a revision and status that come from elsewhere
 * (discord-worker's new moderation embeds, fed by the presets-api webhook):
 * `preset_<kind>_<presetId>:<revision>:<status>` when the revision is a
 * non-negative safe integer, the status is one of {@link REVIEW_STATUSES} and
 * the result fits in 100 characters; otherwise the legacy
 * `preset_<kind>_<presetId>`, which moderation-worker turns into a refresh
 * instead of acting. `presetId` is not validated.
 */
export function buildReviewCustomIdOrLegacy(
  kind: ReviewKind,
  presetId: string,
  revision: number | null | undefined,
  status: string | null | undefined,
): string {
  const legacy = `${prefixFor(kind)}${presetId}`;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    !REVISION_RE.test(String(revision)) ||
    !isReviewStatus(status)
  ) {
    return legacy;
  }
  const bound = `${legacy}:${revision}:${status}`;
  return bound.length <= CUSTOM_ID_MAX ? bound : legacy;
}

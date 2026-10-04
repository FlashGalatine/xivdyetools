/**
 * Review custom_ids: the one strict parser for every approve / reject / revert
 * button and reject / revert modal this worker handles.
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
 * this change still carry:
 *
 *   preset_approve_<uuid>   preset_reject_<uuid>   preset_revert_<uuid>
 *   preset_reject_modal_<uuid>   preset_revert_modal_<uuid>
 *
 * They still parse, with `binding: null` ("no reviewed revision"). A handler
 * must never act on a legacy id: it refreshes the message and asks for a new
 * click instead.
 *
 * discord-worker emits the revision-bound buttons for new moderation embeds
 * (Sprint 5); this worker emits them for refreshed embeds, `/preset moderate`
 * confirmations and the modals. Anything that does not match exactly is `null`.
 */

import type { PresetStatus } from '@xivdyetools/types';
import { isValidUuid } from './response.js';

/** Discord's custom_id cap. */
const CUSTOM_ID_MAX = 100;

export type ReviewKind =
  | 'approve'
  | 'reject'
  | 'revert'
  | 'reject_modal'
  | 'revert_modal';

/** What the moderator reviewed — mirrors presets-api's `expected_revision` / `expected_status`. */
export interface ReviewBinding {
  revision: number;
  status: PresetStatus;
}

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

const STATUSES: ReadonlySet<string> = new Set<PresetStatus>([
  'pending',
  'approved',
  'rejected',
  'flagged',
  'hidden',
]);

const REVISION_RE = /^(0|[1-9][0-9]*)$/;

/** Parse a review custom_id; `null` for anything that is not exactly one of the formats above. */
export function parseReviewCustomId(customId: string): ParsedReviewId | null {
  if (customId.length > CUSTOM_ID_MAX) return null;

  const entry = PREFIXES.find(([, prefix]) => customId.startsWith(prefix));
  if (!entry) return null;
  const [kind, prefix] = entry;

  const parts = customId.slice(prefix.length).split(':');
  const presetId = parts[0];
  if (!isValidUuid(presetId)) return null;

  if (parts.length === 1) return { kind, presetId, binding: null };
  if (parts.length !== 3) return null;

  const [, revisionText, status] = parts;
  if (!REVISION_RE.test(revisionText) || !STATUSES.has(status)) return null;
  const revision = Number(revisionText);
  if (!Number.isSafeInteger(revision)) return null;

  return { kind, presetId, binding: { revision, status: status as PresetStatus } };
}

/** Build a revision-bound custom_id (the format this worker and discord-worker emit). */
export function buildReviewCustomId(
  kind: ReviewKind,
  presetId: string,
  binding: ReviewBinding,
): string {
  const entry = PREFIXES.find(([k]) => k === kind)!;
  return `${entry[1]}${presetId}:${binding.revision}:${binding.status}`;
}

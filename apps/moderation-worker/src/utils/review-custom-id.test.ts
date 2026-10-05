import { describe, it, expect } from 'vitest';
import { parseReviewCustomId, buildReviewCustomId } from './review-custom-id.js';
import type { ReviewKind } from './review-custom-id.js';

const ID = '12345678-1234-4123-8123-123456789abc';

const PREFIX: Record<ReviewKind, string> = {
  approve: 'preset_approve_',
  reject: 'preset_reject_',
  revert: 'preset_revert_',
  reject_modal: 'preset_reject_modal_',
  revert_modal: 'preset_revert_modal_',
};
const KINDS = Object.keys(PREFIX) as ReviewKind[];

describe('parseReviewCustomId', () => {
  describe('revision-bound (new) formats', () => {
    it.each(KINDS)('parses %s with its revision and status', (kind) => {
      expect(parseReviewCustomId(`${PREFIX[kind]}${ID}:7:pending`)).toEqual({
        kind,
        presetId: ID,
        binding: { revision: 7, status: 'pending' },
      });
    });

    it.each(['pending', 'approved', 'rejected', 'flagged', 'hidden'] as const)(
      'accepts the %s status word',
      (status) => {
        expect(parseReviewCustomId(`preset_approve_${ID}:1:${status}`)?.binding).toEqual({
          revision: 1,
          status,
        });
      },
    );

    it('accepts revision 0 and the largest safe integer', () => {
      expect(parseReviewCustomId(`preset_approve_${ID}:0:pending`)?.binding?.revision).toBe(0);
      expect(
        parseReviewCustomId(`preset_approve_${ID}:${Number.MAX_SAFE_INTEGER}:pending`)?.binding
          ?.revision,
      ).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('accepts an upper-case UUID', () => {
      expect(parseReviewCustomId(`preset_approve_${ID.toUpperCase()}:1:pending`)).not.toBeNull();
    });
  });

  describe('legacy formats (no revision)', () => {
    it.each(KINDS)('parses %s as "no revision"', (kind) => {
      expect(parseReviewCustomId(`${PREFIX[kind]}${ID}`)).toEqual({
        kind,
        presetId: ID,
        binding: null,
      });
    });
  });

  describe('prefix precedence', () => {
    it('reads a modal id as the modal, not as a reject / revert button', () => {
      expect(parseReviewCustomId(`preset_reject_modal_${ID}:1:pending`)?.kind).toBe('reject_modal');
      expect(parseReviewCustomId(`preset_revert_modal_${ID}`)?.kind).toBe('revert_modal');
    });

    it('does not read a button id as a modal', () => {
      expect(parseReviewCustomId(`preset_reject_${ID}:1:pending`)?.kind).toBe('reject');
    });
  });

  describe('malformed ids are rejected', () => {
    it.each([
      ['empty', ''],
      ['unknown prefix', `preset_flag_${ID}:1:pending`],
      ['previewimg prefix', `previewimg_approve_${ID}`],
      ['bare prefix', 'preset_approve_'],
      ['bare modal prefix', 'preset_reject_modal_'],
      ['not a uuid', 'preset_approve_not-a-uuid:1:pending'],
      ['uuid v1', 'preset_approve_12345678-1234-1123-8123-123456789abc:1:pending'],
      ['path traversal', 'preset_approve_../../presets/abc'],
      ['modal-shaped rest on a button', `preset_reject_modal_${ID}x`],
      ['trailing colon', `preset_approve_${ID}:`],
      ['revision only', `preset_approve_${ID}:5`],
      ['missing status', `preset_approve_${ID}:5:`],
      ['missing revision', `preset_approve_${ID}::pending`],
      ['extra field', `preset_approve_${ID}:5:pending:extra`],
      ['negative revision', `preset_approve_${ID}:-1:pending`],
      ['signed revision', `preset_approve_${ID}:+1:pending`],
      ['leading zero', `preset_approve_${ID}:01:pending`],
      ['decimal revision', `preset_approve_${ID}:1.5:pending`],
      ['hex revision', `preset_approve_${ID}:0x10:pending`],
      ['exponent revision', `preset_approve_${ID}:1e3:pending`],
      ['whitespace in revision', `preset_approve_${ID}: 5:pending`],
      ['non-numeric revision', `preset_approve_${ID}:abc:pending`],
      ['revision beyond the safe-integer range', `preset_approve_${ID}:9007199254740992:pending`],
      ['unknown status', `preset_approve_${ID}:5:approvedx`],
      ['abbreviated status', `preset_approve_${ID}:5:pend`],
      ['upper-case status', `preset_approve_${ID}:5:PENDING`],
      ['status with whitespace', `preset_approve_${ID}:5: pending`],
    ])('rejects %s', (_label, customId) => {
      expect(parseReviewCustomId(customId)).toBeNull();
    });

    it('rejects anything over 100 characters, even when otherwise well formed', () => {
      // 20 + 36 + 1 + 40 + 1 + 7 = 105
      const long = `preset_reject_modal_${ID}:${'1'.repeat(40)}:pending`;
      expect(long.length).toBeGreaterThan(100);
      expect(parseReviewCustomId(long)).toBeNull();
    });

    it('accepts the longest id this worker can emit (<= 100 characters)', () => {
      const longest = `preset_reject_modal_${ID}:${Number.MAX_SAFE_INTEGER}:approved`;
      expect(longest.length).toBeLessThanOrEqual(100);
      expect(parseReviewCustomId(longest)).not.toBeNull();
    });
  });
});

describe('buildReviewCustomId', () => {
  it.each(KINDS)('builds %s in the documented format', (kind) => {
    expect(buildReviewCustomId(kind, ID, { revision: 12, status: 'flagged' })).toBe(
      `${PREFIX[kind]}${ID}:12:flagged`,
    );
  });

  it.each(KINDS)('round-trips %s through the parser', (kind) => {
    const binding = { revision: 4, status: 'pending' } as const;
    expect(parseReviewCustomId(buildReviewCustomId(kind, ID, binding))).toEqual({
      kind,
      presetId: ID,
      binding,
    });
  });
});

/**
 * @xivdyetools/types - Review custom_id tests (REFACTOR-001)
 *
 * Ported from moderation-worker's `utils/review-custom-id.test.ts` (the parser
 * and its strict builder) and discord-worker's `preset-notifications.test.ts`
 * (the legacy-fallback builder), plus golden strings for both builders so the
 * wire format cannot drift by one byte.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { PresetStatus } from './core.js';
import {
  REVIEW_STATUSES,
  isReviewStatus,
  parseReviewCustomId,
  buildReviewCustomId,
  buildReviewCustomIdOrLegacy,
} from './review-custom-id.js';
import type { ReviewAction, ReviewKind, ReviewBinding } from './review-custom-id.js';

const ID = '12345678-1234-4123-8123-123456789abc';
/** discord-worker's preset-notifications fixture id. */
const DW_ID = '123e4567-e89b-42d3-a456-426614174000';

/** A Record literal must name every key exactly once, so this pins the kind union. */
const PREFIX: Record<ReviewKind, string> = {
  approve: 'preset_approve_',
  reject: 'preset_reject_',
  revert: 'preset_revert_',
  reject_modal: 'preset_reject_modal_',
  revert_modal: 'preset_revert_modal_',
};
const KINDS = Object.keys(PREFIX) as ReviewKind[];

const ACTION_SET: Record<ReviewAction, true> = { approve: true, reject: true, revert: true };
const ACTIONS = Object.keys(ACTION_SET) as ReviewAction[];

/** The five status words, as presets-api's `expected_status` accepts them. */
const STATUS_SET: Record<PresetStatus, true> = {
  pending: true,
  approved: true,
  rejected: true,
  flagged: true,
  hidden: true,
};
const STATUSES = Object.keys(STATUS_SET) as PresetStatus[];

describe('REVIEW_STATUSES', () => {
  it('is exactly the PresetStatus union, in presets-api order', () => {
    expectTypeOf<(typeof REVIEW_STATUSES)[number]>().toEqualTypeOf<PresetStatus>();
    expect(REVIEW_STATUSES).toEqual(['pending', 'approved', 'rejected', 'flagged', 'hidden']);
    expect([...REVIEW_STATUSES].sort()).toEqual([...STATUSES].sort());
  });

  it('has no duplicates', () => {
    expect(new Set(REVIEW_STATUSES).size).toBe(REVIEW_STATUSES.length);
  });

  // presets-api checks expected_status with REVIEW_STATUSES.includes(), while
  // the parser and both builders read a Set built from it once. A consumer
  // that pushed a word onto the array would make the two disagree.
  it('is frozen, so no consumer can widen one side of the check', () => {
    expect(Object.isFrozen(REVIEW_STATUSES)).toBe(true);
  });
});

describe('an unknown kind (an untyped or cast caller)', () => {
  // moderation-worker's old builder threw here; an id beginning "undefined"
  // would parse to null and fail quietly instead.
  it('throws from both builders instead of emitting an unparseable id', () => {
    const bogus = 'approve_all' as ReviewKind;
    expect(() => buildReviewCustomId(bogus, ID, { revision: 1, status: 'pending' })).toThrow(
      /unknown review kind/,
    );
    expect(() => buildReviewCustomIdOrLegacy(bogus, ID, 1, 'pending')).toThrow(/unknown review kind/);
  });
});

describe('isReviewStatus', () => {
  it.each(STATUSES)('accepts %s', (status) => {
    expect(isReviewStatus(status)).toBe(true);
  });

  it.each([
    ['upper case', 'PENDING'],
    ['capitalized', 'Pending'],
    ['leading whitespace', ' pending'],
    ['trailing whitespace', 'pending '],
    ['abbreviation', 'pend'],
    ['suffix', 'approvedx'],
    ['empty', ''],
    ['unknown word', 'deleted'],
    ['prototype key', 'constructor'],
  ])('rejects the string %s', (_label, value) => {
    expect(isReviewStatus(value)).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 1],
    ['boolean', true],
    ['array', ['pending']],
    ['object', { status: 'pending' }],
  ])('rejects the non-string %s', (_label, value) => {
    expect(isReviewStatus(value)).toBe(false);
  });

  it('narrows to PresetStatus', () => {
    const value: unknown = 'flagged';
    if (isReviewStatus(value)) {
      expectTypeOf(value).toEqualTypeOf<PresetStatus>();
    }
  });
});

describe('parseReviewCustomId', () => {
  describe('revision-bound (new) formats', () => {
    it.each(KINDS)('parses %s with its revision and status', (kind) => {
      expect(parseReviewCustomId(`${PREFIX[kind]}${ID}:7:pending`)).toEqual({
        kind,
        presetId: ID,
        binding: { revision: 7, status: 'pending' },
      });
    });

    it.each(STATUSES)('accepts the %s status word', (status) => {
      expect(parseReviewCustomId(`preset_approve_${ID}:1:${status}`)?.binding).toEqual({
        revision: 1,
        status,
      });
    });

    it('accepts revision 0 and the largest safe integer', () => {
      expect(parseReviewCustomId(`preset_approve_${ID}:0:pending`)?.binding?.revision).toBe(0);
      expect(
        parseReviewCustomId(`preset_approve_${ID}:${Number.MAX_SAFE_INTEGER}:pending`)?.binding
          ?.revision,
      ).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('accepts an upper-case UUID and returns it unchanged', () => {
      const upper = ID.toUpperCase();
      expect(parseReviewCustomId(`preset_approve_${upper}:1:pending`)).toEqual({
        kind: 'approve',
        presetId: upper,
        binding: { revision: 1, status: 'pending' },
      });
    });

    it('accepts every UUID v4 variant nibble', () => {
      for (const variant of ['8', '9', 'a', 'b', 'A', 'B']) {
        const id = `12345678-1234-4123-${variant}123-123456789abc`;
        expect(parseReviewCustomId(`preset_approve_${id}:1:pending`)?.presetId).toBe(id);
      }
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
      expect(parseReviewCustomId(`preset_revert_${ID}`)?.kind).toBe('revert');
    });
  });

  describe('malformed ids are rejected', () => {
    it.each([
      ['empty', ''],
      ['unknown prefix', `preset_flag_${ID}:1:pending`],
      ['previewimg prefix', `previewimg_approve_${ID}`],
      ['bare prefix', 'preset_approve_'],
      ['bare modal prefix', 'preset_reject_modal_'],
      ['approve modal (no such kind)', `preset_approve_modal_${ID}:1:pending`],
      ['upper-case prefix', `PRESET_APPROVE_${ID}:1:pending`],
      ['leading whitespace', ` preset_approve_${ID}:1:pending`],
      ['not a uuid', 'preset_approve_not-a-uuid:1:pending'],
      ['uuid v1', 'preset_approve_12345678-1234-1123-8123-123456789abc:1:pending'],
      ['uuid with a bad variant nibble', 'preset_approve_12345678-1234-4123-c123-123456789abc:1:pending'],
      ['uuid without hyphens', 'preset_approve_12345678123441238123123456789abc:1:pending'],
      ['uuid with braces', `preset_approve_{${ID}}:1:pending`],
      ['path traversal', 'preset_approve_../../presets/abc'],
      ['modal-shaped rest on a button', `preset_reject_modal_${ID}x`],
      ['trailing characters after a legacy uuid', `preset_approve_${ID}x`],
      ['trailing colon', `preset_approve_${ID}:`],
      ['revision only', `preset_approve_${ID}:5`],
      ['missing status', `preset_approve_${ID}:5:`],
      ['missing revision', `preset_approve_${ID}::pending`],
      ['extra field', `preset_approve_${ID}:5:pending:extra`],
      ['trailing colon after status', `preset_approve_${ID}:5:pending:`],
      ['negative revision', `preset_approve_${ID}:-1:pending`],
      ['signed revision', `preset_approve_${ID}:+1:pending`],
      ['leading zero', `preset_approve_${ID}:01:pending`],
      ['decimal revision', `preset_approve_${ID}:1.5:pending`],
      ['hex revision', `preset_approve_${ID}:0x10:pending`],
      ['exponent revision', `preset_approve_${ID}:1e3:pending`],
      ['whitespace in revision', `preset_approve_${ID}: 5:pending`],
      ['trailing whitespace in revision', `preset_approve_${ID}:5 :pending`],
      ['non-numeric revision', `preset_approve_${ID}:abc:pending`],
      ['revision beyond the safe-integer range', `preset_approve_${ID}:9007199254740992:pending`],
      ['unknown status', `preset_approve_${ID}:5:approvedx`],
      ['abbreviated status', `preset_approve_${ID}:5:pend`],
      ['upper-case status', `preset_approve_${ID}:5:PENDING`],
      ['status with whitespace', `preset_approve_${ID}:5: pending`],
      ['status with a trailing space', `preset_approve_${ID}:5:pending `],
      ['prototype-key status', `preset_approve_${ID}:5:constructor`],
    ])('rejects %s', (_label, customId) => {
      expect(parseReviewCustomId(customId)).toBeNull();
    });

    it('rejects anything over 100 characters, even when otherwise well formed', () => {
      // 20 + 36 + 1 + 40 + 1 + 7 = 105
      const long = `preset_reject_modal_${ID}:${'1'.repeat(40)}:pending`;
      expect(long.length).toBeGreaterThan(100);
      expect(parseReviewCustomId(long)).toBeNull();
    });

    it('accepts the longest id either worker can emit (<= 100 characters)', () => {
      // 20 + 36 + 1 + 16 + 1 + 8 = 82
      const longest = `preset_reject_modal_${ID}:${Number.MAX_SAFE_INTEGER}:approved`;
      expect(longest).toHaveLength(82);
      expect(parseReviewCustomId(longest)).toEqual({
        kind: 'reject_modal',
        presetId: ID,
        binding: { revision: Number.MAX_SAFE_INTEGER, status: 'approved' },
      });
    });
  });
});

describe('buildReviewCustomId (moderation-worker: caller-validated binding)', () => {
  it.each(KINDS)('builds %s in the documented format', (kind) => {
    expect(buildReviewCustomId(kind, ID, { revision: 12, status: 'flagged' })).toBe(
      `${PREFIX[kind]}${ID}:12:flagged`,
    );
  });

  it('golden strings', () => {
    expect(buildReviewCustomId('approve', ID, { revision: 0, status: 'pending' })).toBe(
      'preset_approve_12345678-1234-4123-8123-123456789abc:0:pending',
    );
    expect(buildReviewCustomId('reject_modal', ID, { revision: 3, status: 'hidden' })).toBe(
      'preset_reject_modal_12345678-1234-4123-8123-123456789abc:3:hidden',
    );
    expect(buildReviewCustomId('revert_modal', ID, { revision: 41, status: 'rejected' })).toBe(
      'preset_revert_modal_12345678-1234-4123-8123-123456789abc:41:rejected',
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

  it('round-trips every kind x status at the largest revision, within 100 characters', () => {
    for (const kind of KINDS) {
      for (const status of STATUSES) {
        const binding: ReviewBinding = { revision: Number.MAX_SAFE_INTEGER, status };
        const id = buildReviewCustomId(kind, ID, binding);
        expect(id.length).toBeLessThanOrEqual(100);
        expect(parseReviewCustomId(id)).toEqual({ kind, presetId: ID, binding });
      }
    }
  });

  it('does not validate (the caller already has): it formats what it is given', () => {
    expect(buildReviewCustomId('approve', 'not-a-uuid', { revision: 1, status: 'pending' })).toBe(
      'preset_approve_not-a-uuid:1:pending',
    );
  });
});

describe('buildReviewCustomIdOrLegacy (discord-worker: untrusted revision / status)', () => {
  it.each(ACTIONS)('builds the bound %s id for every status', (action) => {
    for (const status of STATUSES) {
      const id = buildReviewCustomIdOrLegacy(action, DW_ID, 3, status);
      expect(id).toBe(`preset_${action}_${DW_ID}:3:${status}`);
      expect(parseReviewCustomId(id)).toEqual({
        kind: action,
        presetId: DW_ID,
        binding: { revision: 3, status },
      });
    }
  });

  it.each(KINDS)('builds the bound %s id and its legacy twin', (kind) => {
    expect(buildReviewCustomIdOrLegacy(kind, ID, 7, 'pending')).toBe(
      `${PREFIX[kind]}${ID}:7:pending`,
    );
    const legacy = buildReviewCustomIdOrLegacy(kind, ID, null, 'pending');
    expect(legacy).toBe(`${PREFIX[kind]}${ID}`);
    expect(parseReviewCustomId(legacy)).toEqual({ kind, presetId: ID, binding: null });
  });

  it('golden strings', () => {
    expect(buildReviewCustomIdOrLegacy('approve', DW_ID, 3, 'flagged')).toBe(
      'preset_approve_123e4567-e89b-42d3-a456-426614174000:3:flagged',
    );
    expect(buildReviewCustomIdOrLegacy('reject', DW_ID, 0, 'pending')).toBe(
      'preset_reject_123e4567-e89b-42d3-a456-426614174000:0:pending',
    );
    expect(buildReviewCustomIdOrLegacy('revert', DW_ID, undefined, 'pending')).toBe(
      'preset_revert_123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it('matches buildReviewCustomId whenever the binding is valid', () => {
    for (const kind of KINDS) {
      for (const status of STATUSES) {
        for (const revision of [0, 1, 99, Number.MAX_SAFE_INTEGER]) {
          expect(buildReviewCustomIdOrLegacy(kind, ID, revision, status)).toBe(
            buildReviewCustomId(kind, ID, { revision, status }),
          );
        }
      }
    }
  });

  it('accepts revision 0 and the largest safe integer', () => {
    expect(buildReviewCustomIdOrLegacy('approve', DW_ID, 0, 'pending')).toBe(
      `preset_approve_${DW_ID}:0:pending`,
    );
    const longest = buildReviewCustomIdOrLegacy(
      'approve',
      DW_ID,
      Number.MAX_SAFE_INTEGER,
      'approved',
    );
    // 15 + 36 + 1 + 16 + 1 + 8 = 77
    expect(longest).toBe(`preset_approve_${DW_ID}:${Number.MAX_SAFE_INTEGER}:approved`);
    expect(longest).toHaveLength(77);
  });

  it('writes -0 as 0, as String(-0) does', () => {
    expect(buildReviewCustomIdOrLegacy('approve', DW_ID, -0, 'pending')).toBe(
      `preset_approve_${DW_ID}:0:pending`,
    );
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('falls back to the legacy id when the revision is %s', (_label, revision) => {
    for (const action of ACTIONS) {
      expect(buildReviewCustomIdOrLegacy(action, DW_ID, revision, 'pending')).toBe(
        `preset_${action}_${DW_ID}`,
      );
    }
  });

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['beyond the safe-integer range', Number.MAX_SAFE_INTEGER + 2],
  ])('falls back to the legacy id when the revision is %s', (_label, revision) => {
    expect(buildReviewCustomIdOrLegacy('approve', DW_ID, revision, 'pending')).toBe(
      `preset_approve_${DW_ID}`,
    );
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['unknown', 'bogus'],
    ['upper case', 'PENDING'],
    ['empty', ''],
  ])('falls back to the legacy id when the status is %s', (_label, status) => {
    expect(buildReviewCustomIdOrLegacy('approve', DW_ID, 4, status)).toBe(
      `preset_approve_${DW_ID}`,
    );
  });

  it('falls back to the legacy id when the bound id would exceed 100 characters', () => {
    // presetId is not validated here; a long one is the only way past the cap.
    // 15 + 76 + 1 + 1 + 1 + 7 = 101 bound; the legacy id is 91.
    const longId = 'x'.repeat(76);
    expect(buildReviewCustomIdOrLegacy('approve', longId, 1, 'pending')).toBe(
      `preset_approve_${longId}`,
    );
    // ...and keeps the bound id at exactly 100.
    const fitsId = 'x'.repeat(75);
    const atCap = buildReviewCustomIdOrLegacy('approve', fitsId, 1, 'pending');
    expect(atCap).toBe(`preset_approve_${fitsId}:1:pending`);
    expect(atCap).toHaveLength(100);
  });
});

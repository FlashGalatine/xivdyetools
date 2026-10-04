/**
 * preset-notifications: revision-bound moderation buttons (FINDING-017) and
 * the author mention removal (FINDING-008).
 */

import { describe, it, expect } from 'vitest';
import type { Env } from '../../types/env.js';
import { buildModerationNotification, type ModerationPresetInfo } from './preset-notifications.js';

const PRESET_ID = '123e4567-e89b-42d3-a456-426614174000';

// Copied from moderation-worker's utils/review-custom-id.ts (parseReviewCustomId,
// 1.8.0): prefix + uuid + `:<revision>:<status>`, revision without leading zeros.
const BOUND_ID_RE =
  /^preset_(approve|reject|revert)_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(0|[1-9][0-9]*):(pending|approved|rejected|flagged|hidden)$/i;
const LEGACY_ID_RE = /^preset_(approve|reject|revert)_[0-9a-f-]{36}$/i;

const routableEnv = { MODERATION_BOT_TOKEN: 'mod-token', DISCORD_TOKEN: 'main' } as unknown as Env;
const unroutableEnv = { DISCORD_TOKEN: 'main' } as unknown as Env;

function preset(overrides: Partial<ModerationPresetInfo> = {}): ModerationPresetInfo {
  return {
    id: PRESET_ID,
    name: 'Sunset',
    description: 'Warm tones',
    category_id: 'jobs',
    dyes: [1, 2, 3],
    author_name: 'Alice',
    author_discord_id: '123456789012345678',
    status: 'pending',
    ...overrides,
  };
}

function customIds(result: ReturnType<typeof buildModerationNotification>): string[] {
  return (result.components?.[0].components ?? []).map(
    (c) => (c as { custom_id: string }).custom_id
  );
}

describe('buildModerationNotification buttons (FINDING-017)', () => {
  it('emits revision-bound ids carrying the revision and status for a new submission', () => {
    const ids = customIds(
      buildModerationNotification(routableEnv, {
        kind: 'new',
        preset: preset(),
        contentRevision: 7,
      })
    );

    expect(ids).toEqual([
      `preset_approve_${PRESET_ID}:7:pending`,
      `preset_reject_${PRESET_ID}:7:pending`,
    ]);
    for (const id of ids) {
      expect(id).toMatch(BOUND_ID_RE);
      expect(id.length).toBeLessThanOrEqual(100);
    }
  });

  it('adds a bound revert button for an edit', () => {
    const ids = customIds(
      buildModerationNotification(routableEnv, {
        kind: 'edit',
        preset: preset(),
        original: preset({ name: 'Old' }),
        contentRevision: 0,
      })
    );

    expect(ids).toHaveLength(3);
    expect(ids[2]).toBe(`preset_revert_${PRESET_ID}:0:pending`);
    for (const id of ids) expect(id).toMatch(BOUND_ID_RE);
  });

  it("carries the payload's status, not a hard-coded one", () => {
    const ids = customIds(
      buildModerationNotification(routableEnv, {
        kind: 'new',
        preset: preset({ status: 'flagged' }),
        contentRevision: 3,
      })
    );
    expect(ids[0]).toBe(`preset_approve_${PRESET_ID}:3:flagged`);
  });

  it('falls back to legacy ids when the revision is absent', () => {
    for (const contentRevision of [undefined, null]) {
      const ids = customIds(
        buildModerationNotification(routableEnv, { kind: 'new', preset: preset(), contentRevision })
      );
      expect(ids).toEqual([`preset_approve_${PRESET_ID}`, `preset_reject_${PRESET_ID}`]);
      for (const id of ids) expect(id).toMatch(LEGACY_ID_RE);
    }
  });

  it('falls back to legacy ids when the revision is invalid', () => {
    for (const contentRevision of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      const ids = customIds(
        buildModerationNotification(routableEnv, { kind: 'new', preset: preset(), contentRevision })
      );
      expect(ids[0]).toBe(`preset_approve_${PRESET_ID}`);
    }
  });

  it('falls back to legacy ids when the status is missing or not a known status', () => {
    for (const status of [undefined, 'bogus']) {
      const ids = customIds(
        buildModerationNotification(routableEnv, {
          kind: 'new',
          preset: preset({ status }),
          contentRevision: 4,
        })
      );
      expect(ids[0]).toBe(`preset_approve_${PRESET_ID}`);
    }
  });

  it('posts no buttons at all when the moderation token is not configured', () => {
    const result = buildModerationNotification(unroutableEnv, {
      kind: 'new',
      preset: preset(),
      contentRevision: 7,
    });
    expect(result.components).toBeUndefined();
  });
});

describe('buildModerationNotification author line (FINDING-008)', () => {
  it.each(['new', 'edit'] as const)('names the author without a mention (%s)', (kind) => {
    const result = buildModerationNotification(routableEnv, {
      kind,
      preset: preset({ author_name: '<@999> Mallory' }),
      original: preset({ name: 'Old' }),
    });
    const description = result.embeds[0].description ?? '';

    expect(description).toContain('Mallory');
    expect(description).not.toContain('<@');
    expect(description).not.toContain('123456789012345678');
  });
});

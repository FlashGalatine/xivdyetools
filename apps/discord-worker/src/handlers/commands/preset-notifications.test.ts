/**
 * preset-notifications: revision-bound moderation buttons (FINDING-017) and
 * the author mention removal (FINDING-008).
 */

import { describe, it, expect } from 'vitest';
import {
  parseReviewCustomId,
  REVIEW_STATUSES,
  type ReviewAction,
  type ReviewBinding,
} from '@xivdyetools/types';
import type { Env } from '../../types/env.js';
import { buildModerationNotification, type ModerationPresetInfo } from './preset-notifications.js';

const PRESET_ID = '123e4567-e89b-42d3-a456-426614174000';

/** The button order: approve, reject, then revert when it is offered. */
const BUTTON_ACTIONS: readonly ReviewAction[] = ['approve', 'reject', 'revert'];

/**
 * REFACTOR-001 (2026-10-04 deep-dive): every id is read back with the parser
 * moderation-worker answers the click with — the shared one in
 * @xivdyetools/types, not a regex copied from it — so an id this builder emits
 * that moderation-worker would refuse fails here. `binding: null` is a legacy
 * id, which moderation-worker answers with a refresh instead of acting.
 */
function expectParsedIds(ids: string[], binding: ReviewBinding | null): void {
  ids.forEach((id, i) => {
    expect(parseReviewCustomId(id)).toEqual({
      kind: BUTTON_ACTIONS[i],
      presetId: PRESET_ID,
      binding,
    });
    expect(id.length).toBeLessThanOrEqual(100);
  });
}

const routableEnv = { MODERATION_BOT_TOKEN: 'mod-token', DISCORD_TOKEN: 'main' } as unknown as Env;
const unroutableEnv = { DISCORD_TOKEN: 'main' } as unknown as Env;

/**
 * Callers pass a whole CommunityPreset, which still carries the author's snowflake. The fixture
 * keeps it at runtime, so the FINDING-008 assertion below proves the id is never rendered.
 */
function preset(overrides: Partial<ModerationPresetInfo> = {}): ModerationPresetInfo {
  const whole: ModerationPresetInfo & { author_discord_id: string } = {
    id: PRESET_ID,
    name: 'Sunset',
    description: 'Warm tones',
    category_id: 'jobs',
    dyes: [1, 2, 3],
    author_name: 'Alice',
    author_discord_id: '123456789012345678',
    status: 'pending',
  };
  return { ...whole, ...overrides };
}

/** The four text fields a Revert snapshot (and `edited_from`) carries. */
function snapshotOf(p: ModerationPresetInfo) {
  return { name: p.name, description: p.description, tags: p.tags ?? [], dyes: p.dyes };
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
    expectParsedIds(ids, { revision: 7, status: 'pending' });
  });

  it('binds every review status the shared parser accepts, and it reads each one back', () => {
    for (const status of REVIEW_STATUSES) {
      for (const contentRevision of [0, 1, 42, Number.MAX_SAFE_INTEGER]) {
        const ids = customIds(
          buildModerationNotification(routableEnv, {
            kind: 'edit',
            preset: preset({ status }),
            original: preset({ name: 'Old' }),
            contentRevision,
            revertTo: snapshotOf(preset({ name: 'Old' })),
          })
        );
        expect(ids).toHaveLength(3);
        expectParsedIds(ids, { revision: contentRevision, status });
      }
    }
  });

  it('adds a bound revert button for an edit the caller offers a Revert on', () => {
    const ids = customIds(
      buildModerationNotification(routableEnv, {
        kind: 'edit',
        preset: preset(),
        original: preset({ name: 'Old' }),
        contentRevision: 0,
        revertTo: snapshotOf(preset({ name: 'Old' })),
      })
    );

    expect(ids).toHaveLength(3);
    expect(ids[2]).toBe(`preset_revert_${PRESET_ID}:0:pending`);
    expectParsedIds(ids, { revision: 0, status: 'pending' });
  });

  // BUG-003 (2026-10-04 deep-dive): Revert restores the snapshot AND approves
  // the preset, so being an edit is not enough — the caller has to know the
  // snapshot was live text. The builder never offers it on its own.
  it('offers no revert button on an edit unless the caller asks for one', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit',
      preset: preset(),
      original: preset({ name: 'Old' }),
      contentRevision: 2,
    });
    expect(customIds(result)).toEqual([
      `preset_approve_${PRESET_ID}:2:pending`,
      `preset_reject_${PRESET_ID}:2:pending`,
    ]);
    expectParsedIds(customIds(result), { revision: 2, status: 'pending' });
    expect(result.embeds[0].description).not.toContain('Revert');
  });

  it('offers no revert button on a new submission even if asked', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'new',
      preset: preset(),
      contentRevision: 2,
      revertTo: snapshotOf(preset({ name: 'Old' })),
    });
    expect(customIds(result)).toHaveLength(2);
    expect(result.embeds[0].description).not.toContain('Revert');
  });

  it('renders an edit without an original as the full preset under the edit title', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit',
      preset: preset(),
      contentRevision: 1,
    });
    expect(result.embeds[0].title).toContain('✏️');
    expect(result.embeds[0].description).toContain('Sunset');
    expect(result.embeds[0].description).not.toContain('Changes');
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
    expectParsedIds(ids, { revision: 3, status: 'flagged' });
  });

  it('falls back to legacy ids when the revision is absent', () => {
    for (const contentRevision of [undefined, null]) {
      const ids = customIds(
        buildModerationNotification(routableEnv, { kind: 'new', preset: preset(), contentRevision })
      );
      expect(ids).toEqual([`preset_approve_${PRESET_ID}`, `preset_reject_${PRESET_ID}`]);
      expectParsedIds(ids, null);
    }
  });

  it('falls back to legacy ids when the revision is invalid', () => {
    for (const contentRevision of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      const ids = customIds(
        buildModerationNotification(routableEnv, { kind: 'new', preset: preset(), contentRevision })
      );
      expect(ids[0]).toBe(`preset_approve_${PRESET_ID}`);
      expectParsedIds(ids, null);
    }
  });

  it('falls back to legacy ids when the status is missing or not a known status', () => {
    // 'Pending': the status word is case-sensitive on both sides of the wire
    for (const status of [undefined, 'bogus', 'Pending']) {
      const ids = customIds(
        buildModerationNotification(routableEnv, {
          kind: 'new',
          preset: preset({ status }),
          contentRevision: 4,
        })
      );
      expect(ids[0]).toBe(`preset_approve_${PRESET_ID}`);
      expectParsedIds(ids, null);
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

// Sprint 9 (2026-10-04 remediation): Revert restores the write-once snapshot
// AND approves it. The snapshot can be older than the text this edit replaced
// (approved A → flagged B snapshots A → B approved → flagged C still reverts
// to A), so the embed names what Revert restores and says when that is not
// simply "undo this edit".
describe('buildModerationNotification Revert label (Sprint 9)', () => {
  const dawn = preset({ name: 'Dawn', description: 'First words', dyes: [1, 2, 3] });
  const noon = preset({ name: 'Noon', description: 'Second words', dyes: [1, 2] });
  const dusk = preset({ name: 'Dusk', description: 'Third words', dyes: [1, 2, 3] });

  function describeEdit(opts: Partial<Parameters<typeof buildModerationNotification>[1]>): string {
    return (
      buildModerationNotification(routableEnv, {
        kind: 'edit',
        preset: dusk,
        contentRevision: 4,
        ...opts,
      }).embeds[0].description ?? ''
    );
  }

  it('says Revert undoes this edit when the snapshot is the text the edit replaced', () => {
    const description = describeEdit({ original: noon, revertTo: snapshotOf(noon) });

    expect(description).toContain('**Changes:**');
    expect(description).toContain('"Noon" → "Dusk"');
    expect(description).toContain('**Revert:** restores "Noon", the text this edit replaced, and approves it.');
    expect(description).not.toContain('older than');
  });

  it('says Revert goes further back when the snapshot is older than the text the edit replaced', () => {
    const description = describeEdit({ original: noon, revertTo: snapshotOf(dawn) });

    expect(description).toContain('"Noon" → "Dusk"');
    expect(description).toContain(
      '**Revert:** restores the saved approved version "Dawn" and approves it. It is older than the text this edit replaced (they differ in: name, description, dyes), so Revert does not just undo this edit.'
    );
  });

  it('names a changed tag list among the differences', () => {
    const description = describeEdit({
      original: noon,
      revertTo: { ...snapshotOf(noon), tags: ['cold'] },
    });

    expect(description).toContain('(they differ in: tags)');
  });

  it('says the snapshot may be older when there is no diff base to compare it with', () => {
    const description = describeEdit({ revertTo: snapshotOf(dawn) });

    expect(description).not.toContain('Changes');
    expect(description).toContain(
      '**Revert:** restores the saved approved version "Dawn" and approves it. It may be older than the text this edit replaced.'
    );
  });

  // The fallback for a presets-api that sends no edited_from: the diff is
  // measured from the snapshot itself, so it is headed as such, and nothing
  // can say whether the snapshot is the text this edit replaced.
  it('heads a diff measured from the snapshot as such, and does not claim Revert undoes this edit', () => {
    const description = describeEdit({
      original: noon,
      originalIsRevertSnapshot: true,
      revertTo: snapshotOf(noon),
    });

    expect(description).toContain('**Changes since the Revert snapshot:**');
    expect(description).not.toContain('**Changes:**');
    expect(description).toContain('"Noon" → "Dusk"');
    expect(description).toContain('It may be older than the text this edit replaced.');
    expect(description).not.toContain('the text this edit replaced, and approves it');
  });

  it('sanitizes the snapshot name it prints', () => {
    const description = describeEdit({
      original: noon,
      revertTo: { ...snapshotOf(dawn), name: '<@999> @everyone Dawn' },
    });

    expect(description).not.toContain('<@999>');
    // defused, not deleted: a zero-width joiner splits the mass mention
    expect(description).not.toContain('@everyone');
    expect(description).toContain('Dawn');
  });
});

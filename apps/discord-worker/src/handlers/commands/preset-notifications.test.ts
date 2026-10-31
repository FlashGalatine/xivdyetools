/**
 * preset-notifications: revision-bound moderation buttons (FINDING-017) and
 * the author mention removal (FINDING-008).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseReviewCustomId,
  REVIEW_STATUSES,
  type ReviewAction,
  type ReviewBinding,
} from '@xivdyetools/types';
import type { Env } from '../../types/env.js';
import { buildModerationNotification, sendModerationNotification, type ModerationPresetInfo } from './preset-notifications.js';

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
  return { name: p.name, description: p.description, tags: p.tags ?? [], dyes: p.dyes,
    ...(Object.hasOwn(p, 'example_link') ? { example_link: p.example_link } : {}),
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

describe('link review compatibility (F016)', () => {
  const incomplete = 'Link details do not fit safely in this review. Ask the author to shorten the link before approval.';
  const linkPreset = (example_link: unknown) => ({ ...preset(), example_link });
  const field = (result: ReturnType<typeof buildModerationNotification>, name: string) =>
    result.embeds[0].fields?.find((entry) => entry.name === name)?.value;
  const build = (example_link: unknown) => buildModerationNotification(routableEnv, {
    kind: 'new', preset: linkPreset(example_link), contentRevision: 5,
  });

  it('shows the complete decoded path and never omitted URL components', () => {
    const result = build('https://secret-user:secret-pass@hidden.example/looks/Red%20Mage?token=private#fragment');
    expect(field(result, 'Links')).toBe('`/looks/Red Mage`');
    const json = JSON.stringify(result);
    for (const omitted of ['secret-user', 'secret-pass', 'hidden.example', 'token', 'private', 'fragment', 'https:']) {
      expect(json).not.toContain(omitted);
    }
    expect(customIds(result)).toEqual([`preset_approve_${PRESET_ID}:5:pending`, `preset_reject_${PRESET_ID}:5:pending`]);
  });

  it('escapes encoded backticks and invisible codepoints inside one nonclickable code span', () => {
    const result = build('https://hidden.example/%60%3C%40everyone%3E%0A%00%C2%85%E2%80%AE%E2%80%8B/[x](https:%2F%2Fevil)');
    expect(field(result, 'Links')).toBe('`/\\u0060<@everyone>\\u000a\\u0000\\u0085\\u202e\\u200b/[x](https://evil)`');
    expect(result.embeds[0]).not.toHaveProperty('url');
    expect(result.embeds[0]).not.toHaveProperty('image');
    expect(result.components?.[0].components.every((button) => !button.url)).toBe(true);
  });

  it('matches producer decoding with replacement for invalid UTF-8 and literal malformed escapes', () => {
    expect(field(build('https://hidden.example/%E6%97%A5/%FF/%zz/%41'), 'Links')).toBe('`/日/�/%zz/A`');
  });

  it('makes astral invisible formatting visible without losing path content', () => {
    expect(field(build('https://e.test/start%F3%A0%80%81end'), 'Links')).toBe('`/start\\u{e0001}end`');
  });

  it('preserves missing versus explicit null links for old and new producers', () => {
    const old = buildModerationNotification(routableEnv, { kind: 'new', preset: preset() });
    expect(field(old, 'Links')).toBe('Link details unavailable.');
    expect(field(build(null), 'Links')).toBe('No example link.');
    expect(customIds(old)).toHaveLength(2);
  });

  it.each(['?private=old', '#old'])('recognizes changes to hidden URL components (%s)', (suffix) => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: linkPreset('https://hidden.example/look?private=new#new'),
      original: linkPreset(`https://hidden.example/look${suffix}`),
    });
    expect(result.embeds[0].description).toContain('Link path is unchanged; other URL parts changed and are not shown.');
    expect(result.embeds[0].description).not.toContain('No visible changes');
    expect(JSON.stringify(result)).not.toContain('private=');
  });

  it('describes path changes without a redundant prior path copy', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: linkPreset('https://hidden.example/current'),
      original: linkPreset('https://hidden.example/previous'),
    });
    expect(result.embeds[0].description).toContain('Link changed; only path text is shown.');
    expect(field(result, 'Links')).toBe('`/current`');
    expect(JSON.stringify(result)).not.toContain('/previous');
  });

  it('compares normalized full URLs internally without inventing a change', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: linkPreset('https://EXAMPLE.test:443/look'),
      original: linkPreset('https://example.test/look'),
    });
    expect(result.embeds[0].description).toContain('No visible changes');
  });

  it('shows effective Revert links and distinguishes recorded null from legacy missing', () => {
    for (const target of [
      { ...snapshotOf(preset()), example_link: 'https://hidden.example/saved%20look' },
      { ...snapshotOf(preset()), example_link: null },
      snapshotOf(preset()),
    ]) {
      const result = buildModerationNotification(routableEnv, {
        kind: 'edit', preset: linkPreset('https://hidden.example/current'),
        original: linkPreset('https://hidden.example/prior'), revertTo: target,
      });
      expect(field(result, 'Revert link')).toBe(
        !('example_link' in target) ? 'Link details unavailable for this older snapshot.'
          : target.example_link === null ? 'No example link.' : '`/saved look`',
      );
      expect(customIds(result)).toHaveLength(3);
    }
  });

  it('does not equate a missing snapshot link to known unchanged metadata', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: linkPreset(null), original: linkPreset(null),
      revertTo: snapshotOf(preset()),
    });
    expect(result.embeds[0].description).toContain('may be older');
    expect(result.embeds[0].description).not.toContain('the text this edit replaced, and approves it');
  });

  it('includes link differences when the Revert snapshot predates edited_from', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: linkPreset(null), original: linkPreset('https://hidden.example/prior'),
      revertTo: { ...snapshotOf(preset()), example_link: 'https://hidden.example/saved' },
    });
    expect(result.embeds[0].description).toContain('they differ in: example_link');
  });

  it.each([false, 17, {}, '', 'javascript:alert(1)', 'not a URL'])('withholds Approve for malformed current metadata (%j)', (value) => {
    const result = build(value);
    expect(field(result, 'Links')).toBe(incomplete);
    expect(customIds(result)).toEqual([`preset_reject_${PRESET_ID}:5:pending`]);
  });

  it('withholds only Revert for a malformed target while keeping current content approvable', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: linkPreset(null), contentRevision: 5,
      revertTo: { ...snapshotOf(preset()), example_link: 17 },
    });
    expect(field(result, 'Revert link')).toBe(incomplete);
    expect(customIds(result)).toEqual([`preset_approve_${PRESET_ID}:5:pending`, `preset_reject_${PRESET_ID}:5:pending`]);
  });

  it('withholds publish actions for incomplete current content even with a safe Revert target', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: linkPreset(false), contentRevision: 5,
      revertTo: { ...snapshotOf(preset()), example_link: null },
    });
    expect(customIds(result)).toEqual([`preset_reject_${PRESET_ID}:5:pending`]);
  });

  it('withholds Approve for oversized legacy URL metadata and raw control loss', () => {
    for (const link of [`https://e.test/${'x'.repeat(300)}`, 'https://e.test/line\nbreak']) {
      const result = build(link);
      expect(field(result, 'Links')).toBe(incomplete);
      expect(customIds(result)).toEqual([`preset_reject_${PRESET_ID}:5:pending`]);
    }
  });

  it('never silently truncates a required path and rejects escaped field overflow', () => {
    const fittingPath = `/${'x'.repeat(276)}-tail`;
    const result = build(`https://e.test${fittingPath}`);
    expect(field(result, 'Links')).toBe(`\`${fittingPath}\``);
    const oversized = build(`https://e.test/${'`'.repeat(180)}-tail`);
    expect(field(oversized, 'Links')).toBe(incomplete);
    expect(customIds(oversized)).toEqual([`preset_reject_${PRESET_ID}:5:pending`]);
  });

  it('keeps every embed budget safe under oversized legacy surrounding metadata', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'edit', preset: { ...linkPreset('https://e.test/complete-current-tail'), name: 'N'.repeat(7000), description: 'D'.repeat(7000) },
      revertTo: { ...snapshotOf(preset()), example_link: 'https://e.test/complete-saved-tail' },
      extraFields: [{ name: 'Tags', value: 'T'.repeat(7000) }],
    });
    const embed = result.embeds[0];
    const fields = embed.fields ?? [];
    expect((embed.description ?? '').length).toBeLessThanOrEqual(4096);
    expect(fields.every((entry) => entry.value.length <= 1024 && entry.name.length <= 256)).toBe(true);
    const aggregate = (embed.title?.length ?? 0) + (embed.description?.length ?? 0) + (embed.footer?.text.length ?? 0)
      + fields.reduce((sum, entry) => sum + entry.name.length + entry.value.length, 0);
    expect(aggregate).toBeLessThanOrEqual(6000);
    expect(field(result, 'Links')).toBe('`/complete-current-tail`');
    expect(field(result, 'Revert link')).toBe('`/complete-saved-tail`');
    expect(customIds(result).every((id) => id.startsWith('preset_reject_'))).toBe(true);
    expect(embed.description).toBe(incomplete);
  });

  it('rejects aggregate overflow even when each individual extra field fits', () => {
    const result = buildModerationNotification(routableEnv, {
      kind: 'new', preset: linkPreset('https://e.test/complete-tail'), contentRevision: 5,
      extraFields: Array.from({ length: 6 }, (_, index) => ({ name: `Details ${index}`, value: 'x'.repeat(1000) })),
    });
    expect(result.embeds[0].description).toBe(incomplete);
    expect(field(result, 'Links')).toBe('`/complete-tail`');
    expect(customIds(result)).toEqual([`preset_reject_${PRESET_ID}:5:pending`]);
  });

  it('sends actual Discord JSON with complete path text and no allowed mentions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const sent = await sendModerationNotification({ ...routableEnv, MODERATION_CHANNEL_ID: 'review-channel' }, {
        kind: 'new', preset: linkPreset('https://hidden.example/%3C%40everyone%3E%60tail?private=token'), contentRevision: 5,
      });
      expect(sent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://discord.com/api/v10/channels/review-channel/messages');
      const body = JSON.parse(options.body as string);
      expect(body.allowed_mentions).toEqual({ parse: [] });
      expect(body.embeds[0].fields).toContainEqual({ name: 'Links', value: '`/<@everyone>\\u0060tail`', inline: false });
      expect(JSON.stringify(body)).not.toContain('hidden.example');
      expect(JSON.stringify(body)).not.toContain('private=token');
    } finally {
      vi.unstubAllGlobals();
    }
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
  const dawn = preset({ name: 'Dawn', description: 'First words', dyes: [1, 2, 3], example_link: null });
  const noon = preset({ name: 'Noon', description: 'Second words', dyes: [1, 2], example_link: null });
  const dusk = preset({ name: 'Dusk', description: 'Third words', dyes: [1, 2, 3], example_link: null });

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

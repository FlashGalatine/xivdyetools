/**
 * `refreshReview` and `buildReviewEmbed` on their own, without a button or
 * modal handler in front (those paths are covered by the `*-review.test.ts`
 * files beside each handler).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockFetcher } from '@xivdyetools/test-utils';
import { buildReviewEmbed, refreshReview, withoutTransientFields } from './review-message.js';
import type { ReviewInteraction } from './review-message.js';
import type { Env } from '../types/env.js';
import type { ModerationPresetView } from '../types/preset.js';
import { PresetAPIError } from '../types/preset.js';
import * as presetApi from '../services/preset-api.js';
import * as discordApi from '../utils/discord-api.js';

const ID = '12345678-1234-4123-8123-123456789abc';

vi.mock('../utils/discord-api.js', () => ({
  safeEditMessage: vi.fn(),
  safeEditOriginalResponse: vi.fn(),
  safeSendFollowUp: vi.fn(),
}));

vi.mock('../services/preset-api.js', () => ({
  getModerationPreset: vi.fn(),
}));

const SNAPSHOT = { name: 'Approved Before', description: 'old text', tags: [], dyes: [1, 2, 3] };

/** What `/preset moderate` shows beside a snapshot it offers no Revert for. */
const EDIT_LINE = '**Edit:** a saved earlier version exists (Revert is on the moderation message)';

const preset = (over: Partial<ModerationPresetView> = {}): ModerationPresetView =>
  ({
    id: ID,
    name: 'Fresh Name',
    description: 'Fresh description',
    author_name: 'Author',
    status: 'pending',
    category_id: 'jobs',
    dyes: [4, 5, 6],
    tags: [],
    previous_values: null,
    moderation_status: 'unknown',
    ...over,
  }) as ModerationPresetView;

/**
 * The message as Discord delivered it with the click: the PENDING embed the
 * moderator saw, from before any concurrent decision landed.
 */
const interaction = (over: Partial<ReviewInteraction> = {}): ReviewInteraction => ({
  token: 'token-1',
  channel_id: 'channel-mod',
  message: {
    id: 'msg-1',
    embeds: [
      {
        title: '🟡 New Preset Pending',
        description: '**Name:** Fresh Name',
        color: 0xfee75c,
        footer: { text: `ID: ${ID}` },
      },
    ],
  },
  ...over,
});

const env = {
  DISCORD_TOKEN: 'test-bot-token',
  DISCORD_CLIENT_ID: 'app-123',
} as Env;

const lastEdit = () => {
  const calls = vi.mocked(discordApi.safeEditMessage).mock.calls;
  return calls[calls.length - 1][3] as Record<string, any>;
};
const customIds = (edit: Record<string, any>): string[] =>
  edit.components[0].components.map((c: { custom_id: string }) => c.custom_id);

describe('refreshReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(discordApi.safeEditMessage).mockResolvedValue(true);
    vi.mocked(discordApi.safeEditOriginalResponse).mockResolvedValue(true);
    vi.mocked(discordApi.safeSendFollowUp).mockResolvedValue(true);
  });

  // BUG-052 (2026-10-04 deep-dive): two moderators press Approve. The winner
  // commits and edits the message to "Approved by X"; the loser's 409 refresh
  // lands after it. Rebuilding the embed from the preset (or from the click's
  // own copy of the message, which predates the winner's edit) wiped the
  // winner's attribution and reason.
  describe('a preset that has already been decided (BUG-052)', () => {
    it.each(['approved', 'rejected', 'flagged', 'hidden'] as const)(
      '%s: removes the buttons, leaves the embed and states the status in the content',
      async (status) => {
        vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
          preset: preset({ status }),
          revision: 7,
        });

        await refreshReview(interaction(), env, ID, 'mod-2');

        const edit = lastEdit();
        // No embeds: Discord keeps every field the PATCH leaves out, so the
        // winner's 'Approved by' / 'Reason' survive whichever edit lands last.
        // The content is a separate field the moderation post never sets, so
        // every viewer of the channel message still sees the outcome.
        expect(edit).toEqual({ content: `This preset is now ${status}.`, components: [] });
        expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith('app-123', 'token-1', {
          content: `This preset is now ${status}, so there is nothing left to review.`,
          ephemeral: true,
        });
      },
    );

    // The /preset moderate confirmation is private to one moderator, so no
    // winner's attribution can ever land on it: rebuild it from the current
    // preset, as before BUG-052, so it stops asking for a confirm click.
    it('rebuilds the ephemeral /preset moderate confirmation from the current preset', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ status: 'approved', previous_values: SNAPSHOT }),
        revision: 7,
      });

      await refreshReview(
        interaction({
          message: {
            id: 'msg-eph',
            flags: 64,
            embeds: [
              {
                title: '🟡 Preset Review',
                description: '**Status:** pending',
                fields: [{ name: 'Review', value: 'Review this text, then click Approve to confirm.' }],
              },
            ],
          },
        }),
        env,
        ID,
        'mod-2',
      );

      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      const edit = vi.mocked(discordApi.safeEditOriginalResponse).mock.calls[0][2] as Record<
        string,
        any
      >;
      expect(edit.components).toEqual([]);
      expect(edit).not.toHaveProperty('content');
      expect(edit.embeds[0].title).toBe('🟢 Preset Review');
      expect(edit.embeds[0].description).toContain('**Status:** approved');
      expect(edit.embeds[0].footer.text).toBe(`ID: ${ID} • Revision 7`);
      expect(edit.embeds[0].fields).toEqual([
        {
          name: 'Review',
          value: 'This preset is now approved, so there is nothing left to review.',
          inline: false,
        },
      ]);
      // nothing is left to decide, so the snapshot is not advertised either
      expect(edit.embeds[0].description).not.toContain('Revert');
    });

    it('still tells the moderator when the buttons could not be removed', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ status: 'approved' }),
        revision: 7,
      });
      vi.mocked(discordApi.safeEditMessage).mockResolvedValue(false);

      await refreshReview(interaction(), env, ID, 'mod-2');

      expect(discordApi.safeSendFollowUp).toHaveBeenCalledTimes(1);
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ content: expect.stringContaining('Could not update') }),
      );
    });
  });

  describe('a pending preset is re-rendered with fresh buttons', () => {
    it('replaces the embed with the current text and revision-bound Approve / Reject', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset(),
        revision: 4,
      });

      await refreshReview(interaction(), env, ID, 'mod-2');

      const edit = lastEdit();
      expect(edit.embeds[0].description).toContain('**Name:** Fresh Name');
      expect(edit.embeds[0].footer.text).toBe(`ID: ${ID} • Revision 4`);
      expect(customIds(edit)).toEqual([
        `preset_approve_${ID}:4:pending`,
        `preset_reject_${ID}:4:pending`,
      ]);
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ content: expect.stringContaining('click again') }),
      );
    });

    // A guard, not a red-first test: it passed before Sprint 17 too, and pins
    // that a preset without a snapshot is never told about Revert.
    it('guard: mentions neither Revert nor a saved version without a snapshot', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset(),
        revision: 4,
      });

      await refreshReview(interaction(), env, ID, 'mod-2');

      expect(lastEdit().embeds[0].description).not.toContain('Revert');
      expect(lastEdit().embeds[0].description).not.toContain('**Edit:**');
    });

    // Maintainer decision (Sprint 17): Revert stays on a refreshed pending
    // preset that has a snapshot, and the embed says what it restores. The
    // refresh cannot tell whether that snapshot was approved text, so it says
    // only that it is the saved version.
    it('offers Revert when there is a snapshot, and names the version it restores', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ previous_values: SNAPSHOT }),
        revision: 4,
      });

      await refreshReview(interaction(), env, ID, 'mod-2');

      const edit = lastEdit();
      expect(customIds(edit)).toEqual([
        `preset_approve_${ID}:4:pending`,
        `preset_reject_${ID}:4:pending`,
        `preset_revert_${ID}:4:pending`,
      ]);
      expect(edit.embeds[0].description).toContain(
        '**Revert:** restores the saved version "Approved Before" and approves it. ' +
          'It may be older than the text the latest edit replaced.',
      );
      expect(edit.embeds[0].description).not.toContain('approved version');
      expect(edit.embeds[0].description).not.toContain('**Edit:**');
    });

    it('sanitises the snapshot name it quotes', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({
          previous_values: { ...SNAPSHOT, name: '@everyone [x](https://evil.example) **now**' },
        }),
        revision: 4,
      });

      await refreshReview(interaction(), env, ID, 'mod-2');

      const description: string = lastEdit().embeds[0].description;
      const revertLine = description.split('\n').find((line) => line.startsWith('**Revert:**'));
      expect(revertLine).toBeDefined();
      expect(revertLine).not.toContain('@everyone');
      expect(revertLine).not.toMatch(/\[x\]\(https:\/\/evil\.example\)/);
      expect(revertLine).not.toContain('**now**');
    });

    it('still describes Revert when a malformed snapshot has no name', async () => {
      vi.mocked(presetApi.getModerationPreset).mockResolvedValue({
        preset: preset({ previous_values: { ...SNAPSHOT, name: undefined as unknown as string } }),
        revision: 4,
      });

      await refreshReview(interaction(), env, ID, 'mod-2');

      const edit = lastEdit();
      expect(customIds(edit)).toContain(`preset_revert_${ID}:4:pending`);
      expect(edit.embeds[0].description).toContain(
        '**Revert:** restores the saved version and approves it. ' +
          'It may be older than the text the latest edit replaced.',
      );
      expect(edit.embeds[0].description).not.toContain('""');
    });
  });

  // BUG-050's class: an 'Error' from a failed attempt, or the confirmation's
  // 'Review' instruction, must not survive onto the final, button-less message.
  it('drops the transient Error and Review fields when the preset no longer exists', async () => {
    vi.mocked(presetApi.getModerationPreset).mockResolvedValue(null);

    await refreshReview(
      interaction({
        message: {
          id: 'msg-1',
          embeds: [
            {
              title: '🟡 New Preset Pending',
              description: '**Name:** Fresh Name',
              fields: [
                { name: 'Source', value: 'Web', inline: true },
                { name: 'Review', value: 'Review this text, then click Approve to confirm.' },
                { name: 'Error', value: 'Failed to approve: earlier outage', inline: false },
              ],
              footer: { text: `ID: ${ID}` },
            },
          ],
        },
      }),
      env,
      ID,
      'mod-2',
    );

    const edit = lastEdit();
    expect(edit.components).toEqual([]);
    expect(edit.embeds[0].footer.text).toBe('That preset no longer exists.');
    expect(edit.embeds[0].fields).toEqual([{ name: 'Source', value: 'Web', inline: true }]);
  });

  // BUG-054: a presets-api that has no GET /moderation/:id (a rollback or a
  // misordered deploy) answers a ROUTE 404, which getModerationPreset now
  // throws rather than reporting as a deleted preset.
  describe('a presets-api load failure (BUG-054)', () => {
    it('keeps the message and its buttons when the preset cannot be loaded', async () => {
      vi.mocked(presetApi.getModerationPreset).mockRejectedValue(
        new PresetAPIError(404, `Route GET /api/v1/moderation/${ID} not found`),
      );

      await refreshReview(interaction(), env, ID, 'mod-2');

      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).not.toHaveBeenCalled();
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ content: expect.stringContaining('Nothing was changed') }),
      );
    });

    // The test above stubs the throw. This one runs the REAL getModerationPreset
    // against a presets-api that answers the catch-all route 404, so it fails
    // if that 404 is ever read as "the preset is gone" again.
    it('keeps the buttons when presets-api answers the catch-all route 404', async () => {
      const actual = await vi.importActual<typeof presetApi>('../services/preset-api.js');
      vi.mocked(presetApi.getModerationPreset).mockImplementationOnce(actual.getModerationPreset);
      const fetcher = createMockFetcher();
      fetcher._setupHandler(() =>
        Response.json(
          {
            success: false,
            error: 'NOT_FOUND',
            message: `Route GET /api/v1/moderation/${ID} not found`,
          },
          { status: 404 },
        ),
      );

      await refreshReview(
        interaction(),
        {
          ...env,
          PRESETS_API: fetcher as unknown as Fetcher,
          BOT_API_SECRET: 'test-api-secret',
        } as Env,
        ID,
        'mod-2',
      );

      // the request really reached the fake presets-api (not a config 503)
      expect(fetcher._calls).toHaveLength(1);
      expect(fetcher._calls[0].method).toBe('GET');
      expect(fetcher._calls[0].url).toBe(`https://internal/api/v1/moderation/${ID}`);
      expect(discordApi.safeEditMessage).not.toHaveBeenCalled();
      expect(discordApi.safeEditOriginalResponse).not.toHaveBeenCalled();
      expect(discordApi.safeSendFollowUp).toHaveBeenCalledWith(
        'app-123',
        'token-1',
        expect.objectContaining({ content: expect.stringContaining('Nothing was changed') }),
      );
    });
  });
});

describe('buildReviewEmbed', () => {
  it('describes Revert only when the caller offers it', () => {
    const withSnapshot = preset({ previous_values: SNAPSHOT });

    // the /preset moderate confirmation offers a single Approve or Reject button
    expect(buildReviewEmbed(withSnapshot, 2, 'Confirm').description).not.toContain('**Revert:**');
    expect(buildReviewEmbed(withSnapshot, 2, 'Confirm', true).description).toContain(
      '**Revert:** restores the saved version "Approved Before"',
    );
  });

  // Sprint 17 review: the /preset moderate confirmation carries no Revert
  // button, and dropping every mention of the snapshot hid that the text is an
  // edit with something to revert to.
  it('notes a saved earlier version on a pending preset when Revert is not offered', () => {
    const description = buildReviewEmbed(preset({ previous_values: SNAPSHOT }), 2, 'Confirm')
      .description;

    expect(description).toContain(EDIT_LINE);
    expect(description).not.toContain('**Revert:**');
  });

  it('does not repeat the note when Revert is offered', () => {
    const description = buildReviewEmbed(preset({ previous_values: SNAPSHOT }), 2, 'Confirm', true)
      .description;

    expect(description).not.toContain('**Edit:**');
  });

  it.each(['approved', 'rejected', 'flagged', 'hidden'] as const)(
    'does not point a %s preset at a Revert no moderation message offers',
    (status) => {
      const description = buildReviewEmbed(
        preset({ status, previous_values: SNAPSHOT }),
        2,
        'Confirm',
      ).description;

      expect(description).not.toContain('**Edit:**');
      expect(description).not.toContain('Revert');
    },
  );

  // A guard, not a red-first test: it passed before Sprint 17 too.
  it('guard: never describes Revert without a snapshot to restore', () => {
    expect(buildReviewEmbed(preset(), 2, undefined, true).description).not.toContain('Revert');
    expect(buildReviewEmbed(preset(), 2, 'Confirm').description).not.toContain('**Edit:**');
  });
});

describe('withoutTransientFields', () => {
  const FIELDS = [
    { name: 'Source', value: 'Web', inline: true },
    { name: 'Review', value: 'Review this text, then click Approve to confirm.' },
    { name: 'Error', value: 'Failed to approve: earlier outage' },
  ];

  it('drops both the Error and the Review field by default', () => {
    expect(withoutTransientFields(FIELDS)).toEqual([{ name: 'Source', value: 'Web', inline: true }]);
  });

  it('keeps Review when asked, so a retry after a failure still shows the instruction', () => {
    expect(withoutTransientFields(FIELDS, { keepReview: true }).map((f) => f.name)).toEqual([
      'Source',
      'Review',
    ]);
  });

  it('treats a message with no fields as an empty list', () => {
    expect(withoutTransientFields(undefined)).toEqual([]);
  });
});

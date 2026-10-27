import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env } from '../../types/env.js';
import type { ModalInteraction } from '../../types/modal.js';
import { handleBanReasonModal, isBanReasonModal } from './ban-reason.js';
import * as bans from '../../services/ban-service.js';
import * as confirmations from '../../services/ban-confirmation-service.js';
import * as discord from '../../utils/discord-api.js';
vi.mock('../../services/ban-service.js', () => ({
  banUser: vi.fn(),
  getPresetAuthorName: vi.fn(),
}));
vi.mock('../../services/ban-confirmation-service.js', async () => ({
  ...(await vi.importActual('../../services/ban-confirmation-service.js')),
  loadBanReview: vi.fn(),
}));
vi.mock('../../utils/discord-api.js', () => ({ safeSendMessage: vi.fn() }));
const MOD = '987654321098765432',
  TARGET = '123456789012345678',
  U = 'a0000000-0000-4000-8000-000000000001',
  NONCE = 'b0000000-0000-4000-8000-000000000001';
const validReview = {
  nonce: NONCE,
  actorId: MOD,
  phase: 'review',
  hash: 'a'.repeat(64),
  createdAt: 1,
  expiresAt: 2,
  proposal: {
    v: 1,
    action: 'ban',
    mode: 'new',
    banId: NONCE,
    inputs: [TARGET],
    snapshots: [],
    ids: [TARGET, U],
    parentIds: [],
    candidates: [],
    scope: [],
  },
} as const;
const modal = (
  reason = 'Repeated spam submissions',
  id = NONCE,
  source = 'guild',
): ModalInteraction => ({
  id: 'i',
  token: 't',
  application_id: 'a',
  ...(source === 'guild'
    ? { member: { user: { id: MOD, username: '_AttributionSentinel_ @here' } } }
    : { user: { id: MOD, username: '_AttributionSentinel_ @here' } }),
  data: {
    custom_id: `ban_reason_modal_${id}`,
    components: [{ type: 1, components: [{ type: 4, custom_id: 'ban_reason', value: reason }] }],
  },
});
let env: Env, ctx: ExecutionContext, pending: Promise<unknown>[];
beforeEach(() => {
  vi.clearAllMocks();
  env = {
    LINKED_BAN_CONFIRMATION_ENABLED: 'true',
    MODERATOR_IDS: MOD,
    DB: {} as D1Database,
    DISCORD_TOKEN: 'token',
    DISCORD_CLIENT_ID: 'app',
    MODERATION_CHANNEL_ID: 'moderation',
  } as Env;
  pending = [];
  ctx = {
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
  } as ExecutionContext;
  vi.mocked(confirmations.loadBanReview).mockResolvedValue(
    structuredClone(validReview) as unknown as confirmations.BanReview,
  );
  vi.mocked(bans.getPresetAuthorName).mockResolvedValue('_Target_ @everyone');
  vi.mocked(bans.banUser).mockResolvedValue({ success: true, presetsHidden: 7 });
});
describe('nonce-only ban modal', () => {
  it.each(['false', undefined, 'TRUE'])(
    'inactive legacy modal refuses before identity/name/storage or asynchronous work (%s)',
    async (flag) => {
      env.LINKED_BAN_CONFIRMATION_ENABLED = flag;
      const response = await handleBanReasonModal(modal(undefined, TARGET), env, ctx);
      expect(((await response.json()) as any).data.flags).toBe(64);
      expect(confirmations.loadBanReview).not.toHaveBeenCalled();
      expect(bans.getPresetAuthorName).not.toHaveBeenCalled();
      expect(bans.banUser).not.toHaveBeenCalled();
      expect(pending).toEqual([]);
    },
  );
  it.each(['', 'short', ' '.repeat(20), ' short '.padEnd(40), 'x'.repeat(501)])(
    'server-trims and enforces reason10..500 (%#)',
    async (reason) => {
      expect(
        ((await (await handleBanReasonModal(modal(reason), env, ctx)).json()) as any).data.flags,
      ).toBe(64);
      expect(bans.banUser).not.toHaveBeenCalled();
      expect(confirmations.loadBanReview).not.toHaveBeenCalled();
    },
  );
  it('trimmed reason reaches audit write unchanged and posts sanitized text', async () => {
    const response = await handleBanReasonModal(
      modal(' \n **Repeated** @everyone spam \t'),
      env,
      ctx,
    );
    await Promise.all(pending);
    expect(bans.banUser).toHaveBeenCalledWith(
      env,
      NONCE,
      MOD,
      '**Repeated** @everyone spam',
      '_Target_ @everyone',
    );
    expect(((await response.json()) as any).data.allowed_mentions).toEqual({ parse: [] });
    expect(JSON.stringify(vi.mocked(discord.safeSendMessage).mock.calls)).toContain('Repeated');
  });
  it.each([TARGET, U, 'garbage'])('old/forged ID %s has no target-only fallback', async (id) => {
    vi.mocked(confirmations.loadBanReview).mockRejectedValue(new Error('unknown nonce'));
    const response = await handleBanReasonModal(modal(undefined, id), env, ctx);
    expect(((await response.json()) as any).data.flags).toBe(64);
    expect(bans.banUser).not.toHaveBeenCalled();
    expect(bans.getPresetAuthorName).not.toHaveBeenCalled();
  });
  it('revoked moderator and missing actor are refused before load', async () => {
    env.MODERATOR_IDS = '899999999999999999';
    await handleBanReasonModal(modal(), env, ctx);
    const interaction = modal();
    delete interaction.member;
    await handleBanReasonModal(interaction, env, ctx);
    expect(confirmations.loadBanReview).not.toHaveBeenCalled();
  });
  it('unban review cannot be repurposed by a ban modal', async () => {
    const review = structuredClone(validReview) as unknown as confirmations.BanReview;
    review.proposal.action = 'unban';
    vi.mocked(confirmations.loadBanReview).mockResolvedValue(review);
    await handleBanReasonModal(modal(), env, ctx);
    expect(bans.banUser).not.toHaveBeenCalled();
  });
  it('a failed nonce claim never posts success or any public failure identifier', async () => {
    vi.mocked(bans.banUser).mockResolvedValue({
      success: false,
      presetsHidden: 0,
      error: confirmations.REVIEW_UNAVAILABLE,
    });
    const response = await handleBanReasonModal(modal(), env, ctx);
    expect(((await response.json()) as any).data.flags).toBe(64);
    expect(discord.safeSendMessage).not.toHaveBeenCalled();
  });
  it('thrown storage errors never appear in response or posts', async () => {
    vi.mocked(bans.banUser).mockRejectedValue(new Error('D1 private token SQLITE'));
    const text = await (await handleBanReasonModal(modal(), env, ctx)).text();
    expect(text).not.toContain('SQLITE');
    expect(text).not.toContain('token');
    expect(discord.safeSendMessage).not.toHaveBeenCalled();
  });
  it('unnamed author is rendered neutrally, stores target for private search only', async () => {
    vi.mocked(bans.getPresetAuthorName).mockResolvedValue(null);
    const body = (await (await handleBanReasonModal(modal(), env, ctx)).json()) as any;
    await Promise.all(pending);
    expect(body.data.embeds[0].description).toContain('an account with no author name');
    expect(JSON.stringify(body)).not.toContain(TARGET);
    expect(bans.banUser).toHaveBeenCalledWith(env, NONCE, MOD, 'Repeated spam submissions', TARGET);
  });
  it('logs counts and reason length only; no IDs, names or reason text', async () => {
    const logger = { info: vi.fn() } as never;
    await handleBanReasonModal(modal(), env, ctx, logger);
    expect((logger as any).info).toHaveBeenCalledWith('Account ban applied', {
      presetsHidden: 7,
      reasonLength: 25,
    });
  });
  it('prefix routing remains strict', () => {
    expect(isBanReasonModal('ban_reason_modal_abc')).toBe(true);
    expect(isBanReasonModal('ban_reason_modal')).toBe(false);
    expect(isBanReasonModal('preset_reject_modal_x')).toBe(false);
  });
});
describe('F001 neutral attribution', () => {
  const cases = ['guild', 'dm'].flatMap((source) => [true, false].map((log) => ({ source, log })));
  it.each(cases)('ban: $source, log=$log', async ({ source, log }) => {
    env.SUBMISSION_LOG_CHANNEL_ID = log ? 'log' : undefined;
    const reason = '**Repeated** @everyone spam';
    const response = await handleBanReasonModal(modal(reason, NONCE, source), env, ctx);
    const completion = ((await response.json()) as any).data;
    await Promise.all(pending);
    const post = vi.mocked(discord.safeSendMessage).mock.calls.at(-1)![2] as any;
    expect(bans.banUser).toHaveBeenCalledWith(env, NONCE, MOD, reason, '_Target_ @everyone');
    for (const payload of [post, completion]) {
      const text = JSON.stringify(payload);
      expect.soft(text).not.toContain('_AttributionSentinel_ @here');
      expect
        .soft(text)
        .not.toContain(JSON.stringify(String.raw`\_AttributionSentinel\_ @‍here`).slice(1, -1));
      expect.soft(text).not.toContain('AttributionSentinel');
      expect.soft(text).not.toContain(MOD);
      expect.soft(text).not.toContain(TARGET);
      expect.soft(text).not.toContain(U);
      expect.soft(text).not.toContain('User ID');
      expect
        .soft(payload.embeds[0].fields.some((field: any) => field.name === 'Banned By'))
        .toBe(false);
      expect(payload.embeds[0].description).toBe(
        '**\\_Target\\_ @‍everyone** has been banned from Preset Palettes.',
      );
      expect(payload.embeds[0].fields).toContainEqual({
        name: 'Presets Hidden',
        value: '7',
        inline: true,
      });
    }
    expect(completion.components).toEqual([]);
    expect(completion.allowed_mentions).toEqual({ parse: [] });
    expect(post.embeds[0].fields).toContainEqual({
      name: 'Reason',
      value: '\\*\\*Repeated\\*\\* @‍everyone spam',
      inline: false,
    });
  });
});

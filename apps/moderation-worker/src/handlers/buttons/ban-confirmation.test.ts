import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleBanConfirmButton,
  handleBanCancelButton,
  handleBanParentSelect,
  isBanConfirmButton,
  isBanCancelButton,
} from './ban-confirmation.js';
import type { Env } from '../../types/env.js';
import * as confirmations from '../../services/ban-confirmation-service.js';
import { unbanUser } from '../../services/ban-service.js';
vi.mock('../../services/ban-confirmation-service.js', async () => ({
  ...(await vi.importActual('../../services/ban-confirmation-service.js')),
  loadBanReview: vi.fn(),
  selectBanParent: vi.fn(),
}));
vi.mock('../../services/ban-service.js', () => ({ unbanUser: vi.fn() }));
const MOD = '987654321098765432',
  NONCE = 'b0000000-0000-4000-8000-000000000001',
  P = 'b0000000-0000-4000-8000-000000000002';
let env: Env;
let run: ReturnType<typeof vi.fn>;
let bind: ReturnType<typeof vi.fn>;
const ctx = {} as ExecutionContext;
const interaction = (prefix = 'ban_confirm_', id = NONCE) => ({
  id: 'i',
  token: 't',
  application_id: 'a',
  user: { id: MOD, username: 'Private actor' },
  data: { custom_id: `${prefix}${id}`, values: [P] },
});
const review = () =>
  ({
    nonce: NONCE,
    actorId: MOD,
    phase: 'review',
    hash: 'a'.repeat(64),
    proposal: {
      action: 'ban',
      mode: 'new',
      banId: P,
      ids: ['123456789012345678'],
      inputs: ['123456789012345678'],
      scope: [],
      snapshots: [],
      candidates: [],
      parentIds: [],
    },
  }) as unknown as confirmations.BanReview;
beforeEach(() => {
  vi.clearAllMocks();
  run = vi.fn(async () => ({ meta: { changes: 1 } }));
  bind = vi.fn(() => ({ run }));
  env = {
    LINKED_BAN_CONFIRMATION_ENABLED: 'true',
    MODERATOR_IDS: MOD,
    DB: { prepare: vi.fn(() => ({ bind })) },
  } as unknown as Env;
  vi.mocked(confirmations.loadBanReview).mockResolvedValue(review());
  vi.mocked(confirmations.selectBanParent).mockResolvedValue(review());
  vi.mocked(unbanUser).mockResolvedValue({
    success: true,
    presetsRestored: 2,
    presetsStillHidden: 1,
  });
});
describe('actor-bound nonce controls', () => {
  it('reviewed ban opens reason modal with nonce only and native100-char bounds', async () => {
    const body = (await (await handleBanConfirmButton(interaction(), env, ctx)).json()) as any;
    expect(body.type).toBe(9);
    expect(body.data.custom_id).toBe(`ban_reason_modal_${NONCE}`);
    expect(body.data.custom_id.length).toBeLessThanOrEqual(100);
    expect(body.data.components[0].components[0]).toMatchObject({
      min_length: 10,
      max_length: 500,
    });
    expect(confirmations.loadBanReview).toHaveBeenCalledWith(env, NONCE, MOD, 'review');
    expect(unbanUser).not.toHaveBeenCalled();
  });
  it('unban confirms exactly reviewed record via nonce with no public IDs or actor name', async () => {
    const row = review();
    row.proposal.action = 'unban';
    vi.mocked(confirmations.loadBanReview).mockResolvedValue(row);
    const response = await handleBanConfirmButton(interaction(), env, ctx);
    const body = (await response.json()) as any;
    expect(body.type).toBe(7);
    expect(unbanUser).toHaveBeenCalledWith(env, NONCE, MOD, undefined);
    expect(body.data.embeds[0].fields).toContainEqual({
      name: 'Presets Restored',
      value: '2',
      inline: true,
    });
    expect(JSON.stringify(body)).not.toContain(MOD);
    expect(JSON.stringify(body)).not.toContain(P);
    expect(JSON.stringify(body)).not.toContain('Private actor');
  });
  it('failed unban claim produces only private refusal', async () => {
    vi.mocked(unbanUser).mockResolvedValue({ success: false, presetsRestored: 0 });
    const row = review();
    row.proposal.action = 'unban';
    vi.mocked(confirmations.loadBanReview).mockResolvedValue(row);
    expect(
      ((await (await handleBanConfirmButton(interaction(), env, ctx)).json()) as any).data.flags,
    ).toBe(64);
  });
  it.each([handleBanConfirmButton, handleBanCancelButton, handleBanParentSelect])(
    'inactive controls refuse with no storage, scope display or lookup %#',
    async (handler) => {
      env.LINKED_BAN_CONFIRMATION_ENABLED = 'false';
      const body = (await (await handler(interaction(), env, ctx)).json()) as any;
      expect(body.data.flags).toBe(64);
      expect(confirmations.loadBanReview).not.toHaveBeenCalled();
      expect(confirmations.selectBanParent).not.toHaveBeenCalled();
      expect(env.DB.prepare).not.toHaveBeenCalled();
      expect(JSON.stringify(body)).not.toContain(P);
    },
  );
  it.each([handleBanConfirmButton, handleBanCancelButton, handleBanParentSelect])(
    'revoked moderator controls refuse before load %#',
    async (handler) => {
      env.MODERATOR_IDS = '899999999999999999';
      await handler(interaction(), env, ctx);
      expect(confirmations.loadBanReview).not.toHaveBeenCalled();
      expect(confirmations.selectBanParent).not.toHaveBeenCalled();
    },
  );
  it.each(['123456789012345678', 'a0000000-0000-4000-8000-000000000001', 'invalid'])(
    'legacy target or forged nonce %s refuses without fallback',
    async (id) => {
      vi.mocked(confirmations.loadBanReview).mockRejectedValue(new Error('unknown nonce'));
      const body = (await (
        await handleBanConfirmButton(interaction('ban_confirm_', id), env, ctx)
      ).json()) as any;
      expect(body.data.flags).toBe(64);
      expect(unbanUser).not.toHaveBeenCalled();
    },
  );
  it('cancel deletes only the live reviewed nonce bound to the actor', async () => {
    const body = (await (
      await handleBanCancelButton(interaction('ban_cancel_'), env, ctx)
    ).json()) as any;
    expect(body.type).toBe(7);
    expect(body.data.components).toEqual([]);
    expect(confirmations.loadBanReview).toHaveBeenCalledWith(env, NONCE, MOD, 'review');
    expect(env.DB.prepare).toHaveBeenCalledTimes(1);
    const sql = vi.mocked(env.DB.prepare).mock.calls[0][0];
    expect(sql).toBe(
      "DELETE FROM moderation_ban_confirmations WHERE nonce=? AND actor_id=? AND action=? AND mode=? AND proposal_hash=? AND phase='review' AND consumed_at IS NULL AND outcome IS NULL AND expires_at>unixepoch()",
    );
    expect(sql).not.toContain("'applied'");
    expect(bind).toHaveBeenCalledWith(NONCE, MOD, 'ban', 'new', 'a'.repeat(64));
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('cancel that claims no row refuses privately', async () => {
    run.mockResolvedValueOnce({ meta: { changes: 0 } });
    const response = await handleBanCancelButton(interaction('ban_cancel_'), env, ctx);
    const text = await response.text();
    const body = JSON.parse(text);
    expect(body.type).toBe(4);
    expect(body.data.flags).toBe(64);
    expect(text).not.toContain('Ban Cancelled');
  });
  it('cancel of an unloadable nonce never writes', async () => {
    vi.mocked(confirmations.loadBanReview).mockRejectedValue(new Error('unknown nonce'));
    const body = (await (
      await handleBanCancelButton(interaction('ban_cancel_'), env, ctx)
    ).json()) as any;
    expect(body.data.flags).toBe(64);
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
  it('selection passes exact nonce/one choice to atomic selector and renders fresh private review', async () => {
    const body = (await (
      await handleBanParentSelect(interaction('ban_choose_'), env, ctx)
    ).json()) as any;
    expect(confirmations.selectBanParent).toHaveBeenCalledWith(env, MOD, NONCE, P);
    expect(body.type).toBe(7);
    expect(body.data.flags).toBe(64);
  });
  it.each([[[]], [[P, P]]])('selector rejects wrong number of choices %#', async (values) => {
    const i = interaction('ban_choose_');
    i.data.values = values;
    await handleBanParentSelect(i, env, ctx);
    expect(confirmations.selectBanParent).not.toHaveBeenCalled();
  });
  it('select exceptions remain private', async () => {
    vi.mocked(confirmations.selectBanParent).mockRejectedValue(new Error('private payload'));
    const text = await (await handleBanParentSelect(interaction('ban_choose_'), env, ctx)).text();
    expect(text).not.toContain('private payload');
  });
  it('recognizes only exact supported prefixes', () => {
    expect(isBanConfirmButton(`ban_confirm_${NONCE}`)).toBe(true);
    expect(isBanConfirmButton('ban_confirm')).toBe(false);
    expect(isBanCancelButton('ban_cancel_x')).toBe(true);
    expect(isBanCancelButton('preset_reject_x')).toBe(false);
  });
});

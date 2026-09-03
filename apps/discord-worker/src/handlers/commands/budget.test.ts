/**
 * /budget — the `world:` override on find / quick goes through
 * `validateWorld()` exactly like `set_world` does (FINDING-033, 2026-08-21
 * security audit), and the echoed input is sanitised before it is sent
 * back (FINDING-019). Only `set_world` used to validate; find / quick
 * forwarded any string to the Universalis proxy and into the shared price
 * cache key.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleBudgetCommand } from './budget.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1])),
}));
vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../services/preferences.js', () => ({
  setPreference: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('../../services/emoji.js', () => ({
  getDyeEmoji: () => undefined,
}));
vi.mock('../../services/i18n.js', () => ({
  initializeLocale: vi.fn().mockResolvedValue(undefined),
  getLocalizedDyeName: (_id: number, name: string) => name,
}));

const JET_BLACK = { id: 5729, itemID: 5729, stainID: 1, name: 'Jet Black', hex: '#2B2B2B' };
const mockValidateWorld = vi.fn();
const mockFindBudgetLedger = vi.fn();
vi.mock('../../services/budget/index.js', () => ({
  findBudgetLedger: (...args: unknown[]) => mockFindBudgetLedger(...args),
  getDyeById: vi.fn(() => JET_BLACK),
  getDyeByName: vi.fn(() => JET_BLACK),
  getDyeAutocomplete: vi.fn(() => []),
  isUniversalisEnabled: vi.fn(() => true),
  validateWorld: (...args: unknown[]) => mockValidateWorld(...args),
  getWorldAutocomplete: vi.fn(async () => []),
  getQuickPickById: vi.fn(() => ({ id: 'jet-black', targetDyeId: 5729 })),
}));

// Stored preferences the handler reads (reset per test)
const prefs: Record<string, unknown> = {};
vi.mock('../../services/bot-i18n.js', async () => {
  const { createTranslator } = await import('@xivdyetools/bot-logic/i18n');
  return {
    createUserTranslatorWithPrefs: vi.fn(async () => ({ t: createTranslator('en'), prefs })),
  };
});

function interaction(
  subcommand: string,
  options: Array<{ name: string; value: unknown }>,
): DiscordInteraction {
  return {
    id: 'int-1',
    application_id: 'app-1',
    type: 2,
    token: 'token-1',
    locale: 'en-US',
    member: { user: { id: 'user-1' } },
    data: { name: 'budget', options: [{ name: subcommand, type: 1, options }] },
  } as unknown as DiscordInteraction;
}

describe('/budget world override validation (FINDING-033)', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let pending: Promise<unknown>[];

  const settle = () => Promise.all(pending);

  beforeEach(() => {
    vi.clearAllMocks();
    pending = [];
    for (const key of Object.keys(prefs)) delete prefs[key];
    prefs.world = 'Balmung';
    prefs.matching = 'ciede2000';

    env = {
      DISCORD_PUBLIC_KEY: 'k',
      DISCORD_TOKEN: 't',
      DISCORD_CLIENT_ID: 'app-1',
      KV: {} as KVNamespace,
    } as unknown as Env;
    ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => {
        pending.push(p.catch(() => undefined));
      }),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    // The ledger itself is out of scope here — stop the background work early
    mockFindBudgetLedger.mockRejectedValue(new Error('stop here'));
  });

  describe('/budget find', () => {
    it('rejects an unknown world: override before deferring (no ledger, no proxy call)', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      const res = await handleBudgetCommand(
        interaction('find', [
          { name: 'target_dye', value: 'Jet Black' },
          { name: 'world', value: 'Nowhere' },
        ]),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.flags).toBe(64);
      expect(body.data!.content).toContain('Could not find world');
      expect(body.data!.content).toContain('Nowhere');
      expect(mockValidateWorld).toHaveBeenCalledWith(env, 'Nowhere', undefined);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(mockFindBudgetLedger).not.toHaveBeenCalled();
    });

    it('passes the validated (canonical) world name to the ledger', async () => {
      mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });

      const res = await handleBudgetCommand(
        interaction('find', [
          { name: 'target_dye', value: 'Jet Black' },
          { name: 'world', value: 'balmung' },
        ]),
        env,
        ctx,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();
      expect(mockFindBudgetLedger).toHaveBeenCalledWith(
        env,
        5729,
        'Balmung',
        expect.anything(),
        undefined,
      );
    });

    // FINDING-019 (2026-08-29 security audit): the stored preference used to
    // skip validation entirely — whatever `/preferences set world:` had
    // written went straight to the Universalis proxy and the shared
    // price-cache key. It now takes the same (hour-cached) lookup the
    // override does, and the ledger is priced on the CANONICAL name.
    it('validates the stored preference before pricing', async () => {
      prefs.world = 'balmung';
      mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });

      const res = await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value: 'Jet Black' }]),
        env,
        ctx,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();
      expect(mockValidateWorld).toHaveBeenCalledWith(env, 'balmung', undefined);
      expect(mockFindBudgetLedger).toHaveBeenCalledWith(
        env,
        5729,
        'Balmung',
        expect.anything(),
        undefined,
      );
    });

    it('answers the unknown-world reply when the stored world no longer resolves', async () => {
      prefs.world = 'Retired';
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      const res = await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value: 'Jet Black' }]),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.flags).toBe(64);
      expect(body.data!.content).toContain('Could not find world');
      // The name the user must correct is the stored one, not an empty slot
      expect(body.data!.content).toContain('Retired');
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(mockFindBudgetLedger).not.toHaveBeenCalled();
    });

    it('asks for a world when none is stored, without a lookup', async () => {
      delete prefs.world;

      const res = await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value: 'Jet Black' }]),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.content).toContain('No world set');
      expect(mockValidateWorld).not.toHaveBeenCalled();
      expect(mockFindBudgetLedger).not.toHaveBeenCalled();
    });
  });

  describe('/budget quick', () => {
    it('rejects an unknown world: override before deferring', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      const res = await handleBudgetCommand(
        interaction('quick', [
          { name: 'preset', value: 'jet-black' },
          { name: 'world', value: 'Nowhere' },
        ]),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.flags).toBe(64);
      expect(body.data!.content).toContain('Could not find world');
      expect(mockValidateWorld).toHaveBeenCalledWith(env, 'Nowhere', undefined);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
    });

    it('passes the validated world name to the ledger', async () => {
      mockValidateWorld.mockResolvedValue({ ok: true, name: 'Crystal' });

      const res = await handleBudgetCommand(
        interaction('quick', [
          { name: 'preset', value: 'jet-black' },
          { name: 'world', value: 'crystal' },
        ]),
        env,
        ctx,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();
      expect(mockFindBudgetLedger).toHaveBeenCalledWith(
        env,
        5729,
        'Crystal',
        expect.anything(),
        undefined,
      );
    });
  });

  describe('echoed input (FINDING-019)', () => {
    it('sanitises the rejected world name before echoing it', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      const res = await handleBudgetCommand(
        interaction('find', [
          { name: 'target_dye', value: 'Jet Black' },
          { name: 'world', value: '@everyone **Nowhere**' },
        ]),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.data!.content).not.toContain('@everyone');
      expect(body.data!.content).not.toContain('**Nowhere**');
      expect(body.data!.content).toContain('Nowhere');
    });
  });

  // FINDING-011 (2026-08-29 security audit): the ledger log line carried the
  // world name — a player's home world is mildly identifying, and the log
  // needs only to say whether one was resolved.
  describe('log hygiene (FINDING-011)', () => {
    it('logs the target dye and whether a world resolved, never the world name', async () => {
      prefs.world = 'Balmung';
      mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });
      const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

      const res = await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value: 'Jet Black' }]),
        env,
        ctx,
        logger as never,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();

      const call = logger.info.mock.calls.find(
        ([message]) => message === 'Budget: building ledger',
      );
      expect(call, 'the ledger log line never ran').toBeDefined();
      expect(call![1]).toEqual({ targetDyeId: 5729, hasWorld: true });
      expect(JSON.stringify(logger.info.mock.calls)).not.toContain('Balmung');
    });
  });
});

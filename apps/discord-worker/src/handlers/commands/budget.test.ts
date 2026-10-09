/**
 * /budget — the `world:` override on find / quick goes through
 * `validateWorld()` exactly like `set_world` does (FINDING-033, 2026-08-21
 * security audit), and the echoed input is sanitised before it is sent
 * back (FINDING-019). Only `set_world` used to validate; find / quick
 * forwarded any string to the Universalis proxy and into the shared price
 * cache key.
 *
 * BUG-002 (2026-10-04 deep dive): that lookup is a service-binding call that
 * can take two sequential round-trips on a cold cache, so it now runs AFTER
 * the ack — find / quick defer and answer a world they cannot use after it;
 * set_world defers (ephemerally) first.
 *
 * find / quick defer PUBLICLY (the ledger is for the channel), and a public
 * defer can only be edited into a public message — so a world refusal, which
 * was a private reply before BUG-002, deletes the public original and is
 * sent as an ephemeral follow-up instead (Sprint 9 review).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleBudgetCommand } from './budget.js';
import {
  safeDeleteOriginalResponse,
  safeEditOriginalResponse,
  safeSendFollowUp,
} from '../../utils/discord-api.js';
import { setPreference } from '../../services/preferences.js';
import { getDyeByName, resolveTargetDye } from '../../services/budget/index.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

vi.mock('../../services/svg/renderer.js', () => ({
  renderSvgToPng: vi.fn().mockResolvedValue(new Uint8Array([1])),
}));
vi.mock('../../utils/discord-api.js', () => ({
  safeEditOriginalResponse: vi.fn().mockResolvedValue(true),
  safeDeleteOriginalResponse: vi.fn().mockResolvedValue(true),
  safeSendFollowUp: vi.fn().mockResolvedValue(true),
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
const SOOT_BLACK = { id: 5730, itemID: 5730, stainID: 2, name: 'Soot Black', hex: '#2E2E2E' };

/** A one-group ledger, enough for the frame to draw (the PNG step is mocked). */
const LEDGER_RESULT = {
  targetDye: JET_BLACK,
  targetPrice: 50_000,
  targetPriceSource: 'board',
  alreadyFloor: false,
  groups: [
    {
      key: 'A',
      type: null,
      label: 'General-purpose Dye',
      acquisition: null,
      price: 216,
      vendorCheaper: false,
      rows: [{ dye: SOOT_BLACK, de: 2.1, de2000: 2.1, perDe: 23_700 }],
    },
  ],
  omitted: [],
  method: 'ciede2000',
  matchLine: 8,
  world: 'Balmung',
  pricesAsOf: '2026-10-06T00:00:00.000Z',
};
const mockValidateWorld = vi.fn();
const mockFindBudgetLedger = vi.fn();
vi.mock('../../services/budget/index.js', () => ({
  findBudgetLedger: (...args: unknown[]) => mockFindBudgetLedger(...args),
  getDyeById: vi.fn(() => JET_BLACK),
  getDyeByName: vi.fn(() => JET_BLACK),
  // the bare-number path; the BUG-034 block runs the real one
  resolveTargetDye: vi.fn(() => null),
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

/** What the handler last wrote over its deferred ack. */
function lastEdit(): { content?: string; embeds?: Array<{ title?: string; description?: string }> } {
  const calls = vi.mocked(safeEditOriginalResponse).mock.calls;
  expect(calls.length, 'the deferred ack was never edited').toBeGreaterThan(0);
  return calls[calls.length - 1][2] as never;
}

/** Text of the last edit, whichever field carries it. */
function lastEditText(): string {
  const edit = lastEdit();
  return [edit.content ?? '', ...(edit.embeds ?? []).map((e) => e.description ?? '')].join('\n');
}

/**
 * Text of a refusal answered PRIVATELY over a public defer: the public
 * original deleted first, then one ephemeral follow-up, and nothing written
 * over the public message.
 */
function privateRefusalText(): string {
  expect(safeDeleteOriginalResponse).toHaveBeenCalledTimes(1);
  expect(vi.mocked(safeDeleteOriginalResponse).mock.calls[0].slice(0, 2)).toEqual([
    'app-1',
    'token-1',
  ]);
  const sends = vi.mocked(safeSendFollowUp).mock.calls;
  expect(sends.length, 'the refusal was never sent').toBe(1);
  const [appId, token, options] = sends[0];
  expect([appId, token]).toEqual(['app-1', 'token-1']);
  expect(options.ephemeral).toBe(true);
  // Delete BEFORE the follow-up: one sent while the deferred original is
  // still pending takes its place — and its public visibility
  expect(vi.mocked(safeDeleteOriginalResponse).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(safeSendFollowUp).mock.invocationCallOrder[0],
  );
  expect(safeEditOriginalResponse).not.toHaveBeenCalled();
  return [options.content ?? '', ...(options.embeds ?? []).map((e) => e.description ?? '')].join(
    '\n',
  );
}

/**
 * Resolve with the handler's Response, or `'no ack'` if it is still waiting
 * after a short grace period — i.e. it is awaiting something before acking.
 */
async function ackOrTimeout(pendingResponse: Promise<Response>): Promise<Response | 'no ack'> {
  return Promise.race([
    pendingResponse,
    new Promise<'no ack'>((resolve) => setTimeout(() => resolve('no ack'), 100)),
  ]);
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
    it('answers an unknown world: override privately (no ledger, no proxy call)', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      const res = await handleBudgetCommand(
        interaction('find', [
          { name: 'target_dye', value: 'Jet Black' },
          { name: 'world', value: 'Nowhere' },
        ]),
        env,
        ctx,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();
      const text = privateRefusalText();
      expect(text).toContain('Could not find world');
      expect(text).toContain('Nowhere');
      expect(mockValidateWorld).toHaveBeenCalledWith(env, 'Nowhere', undefined);
      expect(mockFindBudgetLedger).not.toHaveBeenCalled();
    });

    it('still answers over the public original when it cannot be deleted', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });
      vi.mocked(safeDeleteOriginalResponse).mockResolvedValueOnce(false);

      await handleBudgetCommand(
        interaction('find', [
          { name: 'target_dye', value: 'Jet Black' },
          { name: 'world', value: 'Nowhere' },
        ]),
        env,
        ctx,
      );
      await settle();

      // The "thinking…" is still there: answering it beats leaving it hanging,
      // and a follow-up would only take its place anyway
      expect(lastEditText()).toContain('Could not find world');
      expect(safeSendFollowUp).not.toHaveBeenCalled();
    });

    it('a valid world still renders the public ledger', async () => {
      mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });
      mockFindBudgetLedger.mockResolvedValue(LEDGER_RESULT);

      const res = await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value: 'Jet Black' }]),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(5);
      // A public defer — the ledger is for the channel
      expect((body.data?.flags ?? 0) & 64).toBe(0);
      await settle();

      const edit = lastEdit() as {
        embeds?: Array<{ image?: { url?: string } }>;
        file?: { name?: string };
      };
      expect(edit.file?.name).toBe('budget.png');
      expect(edit.embeds?.[0]?.image?.url).toBe('attachment://budget.png');
      expect(safeDeleteOriginalResponse).not.toHaveBeenCalled();
      expect(safeSendFollowUp).not.toHaveBeenCalled();
    });

    // BUG-002: on a cold isolate the lookup is up to two sequential
    // service-binding fetches (10 s timeout each). Awaited before the ack, a
    // slow Universalis turned into Discord's "The application did not respond".
    it('acks before the world lookup settles (BUG-002)', async () => {
      let release!: (value: unknown) => void;
      mockValidateWorld.mockReturnValue(new Promise((resolve) => (release = resolve)));

      const res = await ackOrTimeout(
        handleBudgetCommand(
          interaction('find', [
            { name: 'target_dye', value: 'Jet Black' },
            { name: 'world', value: 'balmung' },
          ]),
          env,
          ctx,
        ),
      );

      expect(res, 'the handler waited on the world lookup before acking').not.toBe('no ack');
      expect(((await (res as Response).json()) as InteractionResponseBody).type).toBe(5);
      expect(mockFindBudgetLedger).not.toHaveBeenCalled();

      release({ ok: true, name: 'Balmung' });
      await settle();
      expect(mockFindBudgetLedger).toHaveBeenCalledWith(
        env,
        5729,
        'Balmung',
        expect.anything(),
        undefined,
      );
    });

    it('answers an outage privately as an outage, not a typo (BUG-031)', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'upstream' });

      await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value: 'Jet Black' }]),
        env,
        ctx,
      );
      await settle();

      const text = privateRefusalText();
      expect(text).toContain('Could not fetch market board data');
      expect(text).not.toContain('Could not find world');
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

    it('answers the unknown-world reply privately when the stored world no longer resolves', async () => {
      prefs.world = 'Retired';
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      const res = await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value: 'Jet Black' }]),
        env,
        ctx,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();
      // The stored world is the user's own setting: never echoed to the channel
      const text = privateRefusalText();
      expect(text).toContain('Could not find world');
      // The name the user must correct is the stored one, not an empty slot
      expect(text).toContain('Retired');
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
      // Nothing to look up, so this one can still answer privately at once
      expect(body.data!.flags).toBe(64);
      expect(body.data!.content).toContain('No world set');
      expect(mockValidateWorld).not.toHaveBeenCalled();
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      expect(mockFindBudgetLedger).not.toHaveBeenCalled();
    });
  });

  describe('/budget quick', () => {
    it('answers an unknown world: override privately', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      const res = await handleBudgetCommand(
        interaction('quick', [
          { name: 'preset', value: 'jet-black' },
          { name: 'world', value: 'Nowhere' },
        ]),
        env,
        ctx,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();
      expect(privateRefusalText()).toContain('Could not find world');
      expect(mockValidateWorld).toHaveBeenCalledWith(env, 'Nowhere', undefined);
      expect(mockFindBudgetLedger).not.toHaveBeenCalled();
    });

    it('acks before the world lookup settles (BUG-002)', async () => {
      mockValidateWorld.mockReturnValue(new Promise(() => undefined));

      const res = await ackOrTimeout(
        handleBudgetCommand(interaction('quick', [{ name: 'preset', value: 'jet-black' }]), env, ctx),
      );

      expect(res, 'the handler waited on the world lookup before acking').not.toBe('no ack');
      expect(((await (res as Response).json()) as InteractionResponseBody).type).toBe(5);
    });

    it('asks for a world when none is stored, without a lookup', async () => {
      delete prefs.world;

      const res = await handleBudgetCommand(
        interaction('quick', [{ name: 'preset', value: 'jet-black' }]),
        env,
        ctx,
      );
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.flags).toBe(64);
      expect(mockValidateWorld).not.toHaveBeenCalled();
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

      await handleBudgetCommand(
        interaction('find', [
          { name: 'target_dye', value: 'Jet Black' },
          { name: 'world', value: '@everyone **Nowhere**' },
        ]),
        env,
        ctx,
      );
      await settle();

      const text = privateRefusalText();
      expect(text).not.toContain('@everyone');
      expect(text).not.toContain('**Nowhere**');
      expect(text).toContain('Nowhere');
    });

    it('sanitises the rejected set_world input before echoing it', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      await handleBudgetCommand(
        interaction('set_world', [{ name: 'world', value: '@everyone **Nowhere**' }]),
        env,
        ctx,
      );
      await settle();

      expect(lastEditText()).not.toContain('@everyone');
      expect(lastEditText()).toContain('Nowhere');
    });
  });

  // BUG-002: set_world used to await the lookup and the KV write and only
  // then answer — no defer at all.
  describe('/budget set_world', () => {
    it('acks privately before the world lookup settles', async () => {
      let release!: (value: unknown) => void;
      mockValidateWorld.mockReturnValue(new Promise((resolve) => (release = resolve)));

      const res = await ackOrTimeout(
        handleBudgetCommand(interaction('set_world', [{ name: 'world', value: 'balmung' }]), env, ctx),
      );

      expect(res, 'the handler waited on the world lookup before acking').not.toBe('no ack');
      const body = (await (res as Response).json()) as InteractionResponseBody;
      expect(body.type).toBe(5);
      expect(body.data!.flags).toBe(64);
      expect(setPreference).not.toHaveBeenCalled();

      release({ ok: true, name: 'Balmung' });
      await settle();
      expect(setPreference).toHaveBeenCalledWith(env.KV, 'user-1', 'world', 'Balmung', undefined);
      expect(lastEdit().content).toContain('Balmung');
    });

    it('saves nothing and says so for an unknown world', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'unknown' });

      await handleBudgetCommand(interaction('set_world', [{ name: 'world', value: 'Nowhere' }]), env, ctx);
      await settle();

      expect(setPreference).not.toHaveBeenCalled();
      expect(lastEditText()).toContain('Could not find world');
    });

    it('saves nothing and reports the outage during an outage', async () => {
      mockValidateWorld.mockResolvedValue({ ok: false, reason: 'upstream' });

      await handleBudgetCommand(interaction('set_world', [{ name: 'world', value: 'Balmung' }]), env, ctx);
      await settle();

      expect(setPreference).not.toHaveBeenCalled();
      expect(lastEditText()).toContain('Could not fetch market board data');
    });

    it('reports a failed save', async () => {
      mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });
      vi.mocked(setPreference).mockResolvedValueOnce({ success: false, reason: 'error' });

      await handleBudgetCommand(interaction('set_world', [{ name: 'world', value: 'Balmung' }]), env, ctx);
      await settle();

      expect(lastEditText()).toContain('Could not save your world preference');
    });

    it('still answers when the lookup itself throws', async () => {
      mockValidateWorld.mockRejectedValue(new Error('binding exploded'));

      await handleBudgetCommand(interaction('set_world', [{ name: 'world', value: 'Balmung' }]), env, ctx);
      await settle();

      expect(setPreference).not.toHaveBeenCalled();
      expect(lastEditText()).toContain('Could not save your world preference');
    });

    it('asks for a world without deferring when none was given', async () => {
      const res = await handleBudgetCommand(interaction('set_world', []), env, ctx);
      const body = (await res.json()) as InteractionResponseBody;

      expect(body.type).toBe(4);
      expect(body.data!.flags).toBe(64);
      expect(mockValidateWorld).not.toHaveBeenCalled();
    });
  });

  // FINDING-011 (2026-08-29 security audit): the ledger log line carried the
  // world name — a player's home world is mildly identifying, and the log
  // needs only to say whether one was resolved.
  describe('log hygiene (FINDING-011)', () => {
    it('logs only whether a world resolved, never the world name or the target dye', async () => {
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
      // FINDING-002: target_dye is an option value, so it is not logged either.
      expect(call![1]).toEqual({ hasWorld: true });
      expect(JSON.stringify(logger.info.mock.calls)).not.toContain('Balmung');
    });
  });

  /**
   * BUG-034 (2026-10-04 audit): every other command reads 1–5 bare digits as
   * a dye id and six or more never (bot-logic `parseDyeIdInput`), so
   * '013114' is the colour #013114 there. /budget kept its own numeric path,
   * which parsed any digit run, and priced zero-padded Pure White for the
   * same text its own autocomplete offered nothing for. /budget prices dyes,
   * not colours, so six or more bare digits now name no dye at all. The real
   * resolvers run here; only the ledger and the world lookup are mocked.
   */
  describe('/budget find — a bare-number target (BUG-034)', () => {
    /** Pure White's legacy item id — what the ledger is priced on. */
    const PURE_WHITE_ITEM_ID = 13114;

    beforeEach(async () => {
      const actual = await vi.importActual<
        typeof import('../../services/budget/budget-calculator.js')
      >('../../services/budget/budget-calculator.js');
      vi.mocked(resolveTargetDye).mockImplementation(actual.resolveTargetDye);
      vi.mocked(getDyeByName).mockImplementation(actual.getDyeByName);
      mockValidateWorld.mockResolvedValue({ ok: true, name: 'Balmung' });
    });

    afterEach(() => {
      // clearAllMocks keeps implementations: put the file's defaults back
      vi.mocked(resolveTargetDye).mockImplementation(() => null);
      vi.mocked(getDyeByName).mockImplementation(() => JET_BLACK as never);
    });

    it.each(['013114', '000101', ' 013114 ', '0013114'])(
      'answers %j privately as no such dye, and prices nothing',
      async (value) => {
        const res = await handleBudgetCommand(
          interaction('find', [{ name: 'target_dye', value }]),
          env,
          ctx,
        );
        const body = (await res.json()) as InteractionResponseBody;

        expect(body.type).toBe(4);
        expect(body.data?.flags).toBe(64);
        expect(body.data?.content).toContain(`Could not find dye "${value.trim()}`);
        expect(ctx.waitUntil).not.toHaveBeenCalled();
        expect(mockValidateWorld).not.toHaveBeenCalled();
        expect(mockFindBudgetLedger).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['101', 'a stainID'],
      ['13114', 'a legacy item id'],
      ['00101', 'a zero-padded stainID that still fits in five digits'],
    ])('still prices Pure White for %j (%s)', async (value) => {
      const res = await handleBudgetCommand(
        interaction('find', [{ name: 'target_dye', value }]),
        env,
        ctx,
      );

      expect(((await res.json()) as InteractionResponseBody).type).toBe(5);
      await settle();
      expect(mockFindBudgetLedger).toHaveBeenCalledWith(
        env,
        PURE_WHITE_ITEM_ID,
        'Balmung',
        expect.anything(),
        undefined,
      );
    });
  });
});

/**
 * Client for api-worker's POST /v1/chara/resolve — request shape, envelope
 * handling, session cache, and the "unavailable" contract the glamour block
 * relies on (any failure is one error type, never a thrown envelope).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveCharaEquipment,
  charaIconUrl,
  itemNameFor,
  clearCharaResolveCache,
  CharaResolveUnavailableError,
} from '../chara-resolve-service';
import { getApiWorkerBase } from '../api-worker-origin';
import { loadCharaFile } from '../chara-file-loader';
import { CharaSessionService } from '../chara-session-service';

const GEAR = [
  { slot: 'HeadGear' as const, base: 361, variant: 5 },
  { slot: 'MainHand' as const, set: 634, base: 19, variant: 1 },
];

const NAMES = { en: 'Mask', ja: '仮面', de: 'Maske', fr: 'Masque', ko: '가면', zh: '面具' };
const ITEM = {
  itemId: 361,
  names: NAMES,
  iconId: 41716,
  familySize: 53,
  alternates: [{ itemId: 362, names: NAMES, acquisition: 'Crafted' }],
  viaMainHand: false,
  rules: [
    {
      itemIds: Array.from({ length: 53 }, (_, i) => 361 + i),
      dyeCount: 2,
      glamourable: true,
      wearMask: 65535,
      grandCompany: 0,
    },
  ],
  acquisition: 'Vendor',
  retired: true as const,
  uiCategory: 1,
};
const GLASSES = { id: 40, names: NAMES, iconId: null, acquisition: 'Vendor' };

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: status === 200, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('chara-resolve-service', () => {
  beforeEach(() => clearCharaResolveCache());
  afterEach(() => vi.unstubAllGlobals());

  describe('validated resolve DTOs', () => {
    it('rebuilds valid extended consumer data and caches only the validated copy', async () => {
      const raw = {
        success: true,
        data: { items: { HeadGear: ITEM }, glasses: GLASSES, version: 'v' },
      };
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => raw });
      vi.stubGlobal('fetch', fetchMock);
      const result = await resolveCharaEquipment(GEAR, 40);
      expect(result).toEqual({
        items: { HeadGear: ITEM, MainHand: null },
        glasses: GLASSES,
        version: 'v',
      });
      const nodes = (value: unknown): object[] =>
        typeof value === 'object' && value !== null
          ? [value, ...Object.values(value).flatMap(nodes)]
          : [];
      const originals = new Set(nodes(raw));
      expect(nodes(result).some((node) => originals.has(node))).toBe(false);
      expect(await resolveCharaEquipment(GEAR, 40)).toBe(result);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('supports older absent optional fields, empty rules and regional fallbacks', async () => {
      const old = {
        itemId: 361,
        names: { en: '', ja: '', de: '', fr: '' },
        iconId: null,
        familySize: 1,
        alternates: [],
        viaMainHand: false,
      };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            envelope({ items: { HeadGear: old, MainHand: { ...old, rules: [] } } })
          )
      );
      expect(await resolveCharaEquipment(GEAR, null)).toEqual({
        items: { HeadGear: old, MainHand: { ...old, rules: [] } },
        glasses: null,
        version: null,
      });
    });

    const badItems: Array<[string, unknown]> = [
      ['array item', []],
      ['unsafe item id', { ...ITEM, itemId: Number.MAX_SAFE_INTEGER + 1 }],
      ['fractional icon', { ...ITEM, iconId: 1.5 }],
      ['zero icon', { ...ITEM, iconId: 0 }],
      ['missing locale', { ...ITEM, names: { en: 'Mask' } }],
      ['array names', { ...ITEM, names: [] }],
      ['bad optional locale', { ...ITEM, names: { ...NAMES, ko: 1 } }],
      ['bad family size', { ...ITEM, familySize: 0 }],
      ['bad viaMainHand', { ...ITEM, viaMainHand: 'false' }],
      ['bad alternate names', { ...ITEM, alternates: [{ itemId: 2, names: { en: 'Only' } }] }],
      ['bad alternate id', { ...ITEM, alternates: [{ itemId: -2, names: NAMES }] }],
      [
        'bad alternate acquisition',
        { ...ITEM, alternates: [{ itemId: 2, names: NAMES, acquisition: [] }] },
      ],
      ['array rules group', { ...ITEM, rules: [[]] }],
      ['bad rule ids', { ...ITEM, rules: [{ ...ITEM.rules[0], itemIds: [1, '2'] }] }],
      ['empty rule ids', { ...ITEM, rules: [{ ...ITEM.rules[0], itemIds: [] }] }],
      ['bad dye count', { ...ITEM, rules: [{ ...ITEM.rules[0], dyeCount: 3 }] }],
      ['bad glamour flag', { ...ITEM, rules: [{ ...ITEM.rules[0], glamourable: 1 }] }],
      ['bad wear mask', { ...ITEM, rules: [{ ...ITEM.rules[0], wearMask: 65536 }] }],
      ['bad company', { ...ITEM, rules: [{ ...ITEM.rules[0], grandCompany: 4 }] }],
      ['bad acquisition', { ...ITEM, acquisition: {} }],
      ['bad retired', { ...ITEM, retired: false }],
      ['bad category', { ...ITEM, uiCategory: Infinity }],
    ];
    it.each(badItems)(
      'nulls %s while preserving a valid requested sibling',
      async (_label, bad) => {
        vi.stubGlobal(
          'fetch',
          vi
            .fn()
            .mockResolvedValue(
              envelope({ items: { HeadGear: bad, MainHand: ITEM }, glasses: GLASSES })
            )
        );
        const result = await resolveCharaEquipment(GEAR, 40);
        expect(result.items.HeadGear).toBeNull();
        expect(result.items.MainHand).toEqual(ITEM);
        expect(result.glasses).toEqual(GLASSES);
        expect(await resolveCharaEquipment(GEAR, 40)).toBe(result);
        expect(fetch).toHaveBeenCalledTimes(1);
      }
    );

    it.each([
      [[]],
      [{ ...GLASSES, id: 0 }],
      [{ ...GLASSES, iconId: Number.MAX_SAFE_INTEGER + 1 }],
      [{ ...GLASSES, names: { en: 'Only' } }],
      [{ ...GLASSES, acquisition: false }],
    ])('nulls malformed glasses %j', async (glasses) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(envelope({ items: { HeadGear: ITEM }, glasses }))
      );
      expect((await resolveCharaEquipment(GEAR, 40)).glasses).toBeNull();
    });

    it.each([[[]], [{ items: [] }], [{ items: {}, version: 123 }]])(
      'rejects invalid envelope data %j without caching it',
      async (data) => {
        const fetchMock = vi
          .fn()
          .mockResolvedValueOnce(envelope(data))
          .mockResolvedValueOnce(envelope({ items: { HeadGear: ITEM } }));
        vi.stubGlobal('fetch', fetchMock);
        await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
          CharaResolveUnavailableError
        );
        expect((await resolveCharaEquipment(GEAR, null)).items.HeadGear).toEqual(ITEM);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      }
    );

    it('ignores unrequested/unknown slots and glasses, preserving out-of-range nulls', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            envelope({ items: { HeadGear: ITEM, Body: ITEM, Sneaky: ITEM }, glasses: GLASSES })
          )
      );
      const result = await resolveCharaEquipment(
        [GEAR[0], { slot: 'Body', base: 70000, variant: 1 }],
        null
      );
      expect(result).toEqual({
        items: { HeadGear: ITEM, Body: null },
        glasses: null,
        version: null,
      });
    });
  });

  it('posts the model keys (and glasses only when set) to /v1/chara/resolve', async () => {
    // The request CONTRACT with api-worker: URL, method, and body shape. Nothing
    // else in this file asserts any of the three, so without this a client-side
    // change that breaks the worker passes the whole suite. Deleted by the
    // 2026-09-01 cleanup even though every symbol it uses survived; restored
    // 2026-09-02.
    //
    // A fresh Response per call — a body can only be read once.
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          envelope({ items: { HeadGear: null, MainHand: null }, glasses: null, version: 'v' })
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveCharaEquipment(GEAR, null);
    expect(result).toEqual({
      items: { HeadGear: null, MainHand: null },
      glasses: null,
      version: 'v',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${getApiWorkerBase()}/v1/chara/resolve`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ gear: GEAR });

    clearCharaResolveCache();
    await resolveCharaEquipment(GEAR, 40);
    expect(
      JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string)
    ).toEqual({
      gear: GEAR,
      glasses: 40,
    });
  });

  it('serves the same file from the session cache — one request per signature', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(envelope({ items: {}, glasses: null, version: null }))
      );
    vi.stubGlobal('fetch', fetchMock);
    await resolveCharaEquipment(GEAR, null);
    // Same pieces in a different order is the same glamour.
    await resolveCharaEquipment([...GEAR].reverse(), null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Different facewear is a different request.
    await resolveCharaEquipment(GEAR, 40);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects with CharaResolveUnavailableError on a non-2xx, a network error, or a malformed envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(envelope({}, 503)));
    const down = await resolveCharaEquipment(GEAR, null).catch((e: unknown) => e);
    expect(down).toBeInstanceOf(CharaResolveUnavailableError);
    expect((down as CharaResolveUnavailableError).status).toBe(503);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"success":true}', { status: 200 }))
    );
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );
  });

  it('does not cache a failure — the next import retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(envelope({}, 503))
      .mockResolvedValueOnce(envelope({ items: { HeadGear: null }, glasses: null, version: 'v' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveCharaEquipment(GEAR, null)).rejects.toBeInstanceOf(
      CharaResolveUnavailableError
    );
    expect((await resolveCharaEquipment(GEAR, null)).version).toBe('v');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // BUG-116 (2026-10-04 deep-dive): api-worker refuses the WHOLE batch when any
  // lane or the glasses row is past uint16, so one corrupt piece cost every
  // name in the file and the note blamed availability.
  describe('lanes past uint16 (hand-edited or corrupt files)', () => {
    /** api-worker's own rule (router.ts lane() / glasses): 400 for the batch, else answer the slots sent. */
    const workerLike = () =>
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as {
          gear: Array<{ slot: string; set?: number; base: number; variant: number }>;
          glasses?: number;
        };
        const lanes = body.gear.flatMap((g) => [g.set ?? 0, g.base, g.variant]);
        if (lanes.some((v) => v > 0xffff) || (body.glasses ?? 0) > 0xffff) {
          return Promise.resolve(envelope({}, 400));
        }
        const items = Object.fromEntries(
          body.gear.map((g) => [g.slot, { ...ITEM, itemId: g.base }])
        );
        return Promise.resolve(
          envelope({
            items,
            glasses: body.glasses ? { ...GLASSES, id: body.glasses } : null,
            version: 'v',
          })
        );
      });

    it('leaves the out-of-range piece and glasses out of the request and names the rest', async () => {
      const fetchMock = workerLike();
      vi.stubGlobal('fetch', fetchMock);
      const gear = [
        { slot: 'HeadGear' as const, base: 361, variant: 5 },
        { slot: 'Body' as const, base: 70000, variant: 1 },
        { slot: 'MainHand' as const, set: 0x10000, base: 19, variant: 1 },
      ];

      const result = await resolveCharaEquipment(gear, 99999);

      const sent = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(sent).toEqual({ gear: [gear[0]] });
      expect(result.items.HeadGear).toMatchObject({ itemId: 361 });
      // No Item row can carry a lane the game cannot store: say so, as for an NPC model.
      expect(result.items.Body).toBeNull();
      expect(result.items.MainHand).toBeNull();
      expect(result.glasses).toBeNull();
    });

    it('does not call the worker when nothing in range is left to send', async () => {
      const fetchMock = workerLike();
      vi.stubGlobal('fetch', fetchMock);

      const result = await resolveCharaEquipment(
        [{ slot: 'Body' as const, base: 70000, variant: 1 }],
        0x10000
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result).toEqual({ items: { Body: null }, glasses: null, version: null });
    });

    it('still sends an in-range facewear row on its own', async () => {
      const fetchMock = workerLike();
      vi.stubGlobal('fetch', fetchMock);

      const result = await resolveCharaEquipment(
        [{ slot: 'Body' as const, base: 70000, variant: 1 }],
        0xffff
      );

      const sent = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(sent).toEqual({ gear: [], glasses: 0xffff });
      expect(result.items.Body).toBeNull();
      expect(result.glasses).toMatchObject({ id: 0xffff });
    });
  });

  /**
   * Task 5 (plan "Global constraints": test the exact body keys). The models
   * come from a real import — the library read, the projection and the page's
   * validator, run in-thread by the inline inspection mock — so this pins what
   * actually leaves the browser for a file, not a hand-built model list.
   */
  describe('the request body for an imported file', () => {
    afterEach(() => CharaSessionService.setSession(null));

    const IMPORTED = JSON.stringify({
      TypeName: 'Anamnesis Character File',
      Nickname: 'NICKNAME-CANARY',
      Author: 'AUTHOR-CANARY',
      Tribe: 'Midlander',
      Gender: 'Feminine',
      MainHand: { ModelSet: 634, ModelBase: 19, ModelVariant: 1, DyeId: 6, DyeId2: 0 },
      OffHand: { ModelSet: 0, ModelBase: 0, ModelVariant: 0, DyeId: 0, DyeId2: 0 },
      HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 33 },
      Body: { ModelBase: 200, ModelVariant: 1.5, DyeId: 56, DyeId2: 0 },
      Hands: { ModelBase: 70000, ModelVariant: 1, DyeId: 0, DyeId2: 0 },
      Legs: { ModelBase: '300', ModelVariant: 1, DyeId: 0, DyeId2: 0 },
      Feet: { ModelBase: 376, ModelVariant: 1, DyeId: 1.5, DyeId2: 0, Extra: 'FIELD-CANARY' },
      Glasses: { GlassesId: 40 },
    });

    async function importedSession() {
      const file = new File([IMPORTED], 'FILENAME-CANARY.chara', { type: 'application/json' });
      expect(await loadCharaFile(file)).toEqual({ ok: true });
      return CharaSessionService.getSession()!.resolved;
    }

    it('is exactly {gear, glasses}, each model only slot / base / variant (and set on a weapon)', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(envelope({ items: {}, glasses: null, version: 'v' }))
        );
      vi.stubGlobal('fetch', fetchMock);
      const resolved = await importedSession();

      await resolveCharaEquipment(resolved.gearModels, resolved.glassesId);

      const raw = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string;
      const body = JSON.parse(raw) as { gear: Array<Record<string, unknown>>; glasses?: number };
      expect(Object.keys(body).sort()).toEqual(['gear', 'glasses']);
      expect(body.glasses).toBe(40);
      // Fractional (Body), past-uint16 (Hands) and string (Legs) lanes never
      // become a model; an all-zero weapon (OffHand) is empty, not worn
      expect(body.gear.map((m) => m.slot)).toEqual(['MainHand', 'HeadGear', 'Feet']);
      expect(body.gear[0]).toEqual({ slot: 'MainHand', set: 634, base: 19, variant: 1 });
      expect(Object.keys(body.gear[1]).sort()).toEqual(['base', 'slot', 'variant']);
      expect(Object.keys(body.gear[2]).sort()).toEqual(['base', 'slot', 'variant']);
      // No dye channel, label or unknown field travels
      expect(raw).not.toMatch(/Dye|CANARY|Nickname|Extra/);
    });

    it('omits glasses when the file wears none', async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(envelope({ items: {}, glasses: null, version: 'v' }))
        );
      vi.stubGlobal('fetch', fetchMock);
      const file = new File(
        [
          JSON.stringify({
            HeadGear: { ModelBase: 361, ModelVariant: 5 },
            Glasses: { GlassesId: 0 },
          }),
        ],
        'plain.chara'
      );
      expect(await loadCharaFile(file)).toEqual({ ok: true });
      const resolved = CharaSessionService.getSession()!.resolved;

      await resolveCharaEquipment(resolved.gearModels, resolved.glassesId);

      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body).toEqual({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }] });
    });
  });

  it('propagates the caller abort untouched', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            );
          })
      )
    );
    const pending = resolveCharaEquipment(GEAR, null, controller.signal);
    controller.abort();
    const err = await pending.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DOMException);
    expect((err as DOMException).name).toBe('AbortError');
  });

  it('builds icon URLs on the api-worker origin and picks names with EN fallback', () => {
    expect(charaIconUrl(41716)).toBe(`${getApiWorkerBase()}/v1/chara/icon/41716`);
    const names = {
      en: 'Beech Mask of Casting',
      ja: 'ビーチキャスターマスク',
      de: 'Buchenmaske der Magie',
      fr: 'Masque',
      ko: '너도밤나무 마술사 가면',
    };
    expect(itemNameFor(names, 'ja')).toBe('ビーチキャスターマスク');
    expect(itemNameFor(names, 'ko')).toBe('너도밤나무 마술사 가면');
    expect(itemNameFor(names, 'zh')).toBe('Beech Mask of Casting');
    expect(itemNameFor({ ...names, de: '' }, 'de')).toBe('Beech Mask of Casting');
  });
});

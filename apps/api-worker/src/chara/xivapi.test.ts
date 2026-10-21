import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  buildResolveQuery,
  cleanName,
  iconAssetUrl,
  parseItemRow,
  UpstreamUnavailableError,
  XivapiClient,
} from './xivapi';

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('buildResolveQuery', () => {
  it('emits one required group per lookup inside one required outer group', () => {
    expect(
      buildResolveQuery([
        { field: 'Head', key: '328041' },
        { field: 'MainHand', key: '4296213114' },
      ]),
    ).toBe(
      '+((+EquipSlotCategory.Head=1 +ModelMain=328041) (+EquipSlotCategory.MainHand=1 +ModelMain=4296213114))',
    );
  });

  it('collapses duplicate lookups', () => {
    expect(
      buildResolveQuery([
        { field: 'Body', key: '1' },
        { field: 'Body', key: '1' },
      ]),
    ).toBe('+((+EquipSlotCategory.Body=1 +ModelMain=1))');
  });
});

describe('iconAssetUrl', () => {
  it('pads to six digits and derives the thousand-folder', () => {
    const url = new URL(iconAssetUrl('https://v2.xivapi.com', 41716, 'aaaaaaaaaaaaaaaa'));
    expect(url.pathname).toBe('/api/asset');
    expect(url.searchParams.get('path')).toBe('ui/icon/041000/041716_hr1.tex');
    expect(url.searchParams.get('format')).toBe('png');
    expect(
      new URL(iconAssetUrl('https://v2.xivapi.com', 200018, 'aaaaaaaaaaaaaaaa')).searchParams.get(
        'path',
      ),
    ).toBe('ui/icon/200000/200018_hr1.tex');
  });
});

describe('cleanName / parseItemRow', () => {
  it('reads equipment level independently of glamour rules and preserves an unknown level', () => {
    expect(
      parseItemRow({ row_id: 372, fields: { Name: 'Dated Hempen Coif', LevelEquip: 1 } })
        .levelEquip,
    ).toBe(1);
    expect(parseItemRow({ row_id: 372, fields: { LevelEquip: 50 } }).levelEquip).toBe(50);
    expect(parseItemRow({ row_id: 372, fields: {} }).levelEquip).toBeNull();
    expect(parseItemRow({ row_id: 372, fields: { LevelEquip: '50' } }).levelEquip).toBeNull();
  });
  it('reads the ItemUICategory row and answers null when absent or the blank row 0', () => {
    const cat = (id: number) => ({ value: id, sheet: 'ItemUICategory', row_id: id, fields: {} });
    expect(parseItemRow({ row_id: 1, fields: { ItemUICategory: cat(2) } }).uiCategory).toBe(2);
    expect(parseItemRow({ row_id: 1, fields: { ItemUICategory: cat(0) } }).uiCategory).toBeNull();
    expect(parseItemRow({ row_id: 1, fields: {} }).uiCategory).toBeNull();
  });
  it('strips U+00AD soft hyphens (German names) and trims', () => {
    expect(cleanName('Erzfeind-Pan­zer­hand­schu­he ')).toBe('Erzfeind-Panzerhandschuhe');
    expect(cleanName(undefined)).toBe('');
  });

  it('trims a raw search row to the cache shape', () => {
    const row = parseItemRow({
      row_id: 9295,
      fields: {
        Name: "The Emperor's New Ring",
        'Name@ja': 'エンペラーリング',
        'Name@de': 'Ring des Kaisers',
        'Name@fr': "Anneau de l'empereur",
        Icon: { id: 54561, path: 'ui/icon/054000/054561.tex' },
        ModelMain: 65589,
        ModelSub: 0,
        EquipSlotCategory: {
          value: 12,
          fields: { Head: 0, FingerL: 1, FingerR: 1, Body: 0 },
        },
      },
    });
    expect(row).toEqual({
      rowId: 9295,
      names: {
        en: "The Emperor's New Ring",
        ja: 'エンペラーリング',
        de: 'Ring des Kaisers',
        fr: "Anneau de l'empereur",
      },
      iconId: 54561,
      modelMain: '65589',
      modelSub: '0',
      slots: ['FingerL', 'FingerR'],
      levelEquip: null,
      uiCategory: null,
      rules: null,
    });
  });

  it('reads the in-game rules: dye channels, glamour flag, race/gender lock, Grand Company', () => {
    // Viera Chestwrap #25208: two channels, Viera women only (EquipRaceCategory 17), any company
    const row = parseItemRow({
      row_id: 25208,
      fields: {
        Name: 'Viera Chestwrap',
        ModelMain: 66117,
        EquipSlotCategory: { fields: { Body: 1 } },
        DyeCount: 2,
        IsGlamorous: true,
        EquipRestriction: {
          value: 17,
          fields: { Hyur: false, Viera: true, Male: false, Female: true },
        },
        GrandCompany: { value: 0, sheet: 'GrandCompany', row_id: 0, fields: {} },
      },
    });
    expect(row.rules).toEqual({
      dyeCount: 2,
      glamourable: true,
      wearMask: 0x8000,
      grandCompany: 0,
    });
    // Serpent Private's Sword #1618: the Order of the Twin Adder only
    const serpent = parseItemRow({
      row_id: 1618,
      fields: {
        Name: "Serpent Private's Sword",
        ModelMain: 1,
        DyeCount: 0,
        IsGlamorous: true,
        EquipRestriction: { fields: { Hyur: true, Male: true, Female: true } },
        GrandCompany: { value: 2, sheet: 'GrandCompany', row_id: 2, fields: {} },
      },
    });
    expect(serpent.rules?.grandCompany).toBe(2);
  });

  it('answers null rules when a field is missing, never a guess', () => {
    const fields = {
      Name: 'Curtana Zenith',
      ModelMain: 1,
      DyeCount: 0,
      IsGlamorous: false,
      EquipRestriction: { fields: { Hyur: true, Male: true } },
      GrandCompany: { value: 0, row_id: 0 },
    };
    expect(parseItemRow({ row_id: 6257, fields }).rules).toMatchObject({
      glamourable: false,
      grandCompany: 0,
    });
    for (const missing of ['DyeCount', 'IsGlamorous', 'EquipRestriction', 'GrandCompany']) {
      const partial: Record<string, unknown> = { ...fields };
      delete partial[missing];
      expect(parseItemRow({ row_id: 6257, fields: partial }).rules).toBeNull();
    }
  });

  it('keeps 64-bit weapon keys exact as strings and tolerates a missing icon', () => {
    const row = parseItemRow({
      row_id: 49486,
      fields: {
        Name: 'Runaway Bow',
        ModelMain: 4296213114,
        ModelSub: 4304732858,
        EquipSlotCategory: { fields: { MainHand: 1 } },
      },
    });
    expect(row.modelMain).toBe('4296213114');
    expect(row.modelSub).toBe('4304732858');
    expect(row.iconId).toBeNull();
    expect(row.slots).toEqual(['MainHand']);
  });
});

const V = 'aaaaaaaaaaaaaaaa';
const S = 'exdschema@2:rev:' + 'a'.repeat(40);
const S2 = 'exdschema@2:rev:' + 'b'.repeat(40);
const pinned = { XIVAPI_BASE: 'https://xivapi.test', XIVAPI_VERSION: V, XIVAPI_SCHEMA: S };
const metadata = (version = V, schema = S) => ({
  row_id: 1,
  version,
  schema,
  fields: { Name: 'Gil' },
});

describe('XivapiClient request context', () => {
  let now: number;
  beforeEach(() => {
    now = 5_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses a fully canonical pair without discovery and partitions base/schema identities', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const first = await new XivapiClient(pinned).resolveContext();
    const same = await new XivapiClient({
      ...pinned,
      XIVAPI_BASE: 'https://xivapi.test:443/',
    }).resolveContext();
    const otherBase = await new XivapiClient({
      ...pinned,
      XIVAPI_BASE: 'https://other.test',
    }).resolveContext();
    const otherSchema = await new XivapiClient({ ...pinned, XIVAPI_SCHEMA: S2 }).resolveContext();
    expect(first.cacheNamespace).toBe(same.cacheNamespace);
    expect(
      new Set([first.cacheNamespace, otherBase.cacheNamespace, otherSchema.cacheNamespace]).size,
    ).toBe(3);
    expect(first.cacheNamespace).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('memoizes a complete pair and refreshes at exactly ten minutes', async () => {
    let version = V;
    let schema = S;
    const fetchMock = vi.fn(async () => okJson(metadata(version, schema)));
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({
      XIVAPI_BASE: 'https://context-ttl.test',
      XIVAPI_VERSION: 'latest',
    });
    const contexts = await Promise.all([client.resolveContext(), client.resolveContext()]);
    expect(contexts[0]).toEqual(contexts[1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL((fetchMock.mock.calls as unknown as [string][])[0][0]);
    expect(url.pathname).toBe('/api/sheet/Item/1');
    expect(url.searchParams.get('fields')).toBe('Name');
    expect(url.searchParams.get('version')).toBe('latest');
    version = 'bbbbbbbbbbbbbbbb';
    schema = S2;
    now += 599_999;
    expect(await client.resolveContext()).toEqual(contexts[0]);
    now++;
    expect(await client.resolveContext()).toMatchObject({ version, schema });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps input selectors isolated, including schema aliases', async () => {
    const fetchMock = vi.fn(async () => okJson(metadata()));
    vi.stubGlobal('fetch', fetchMock);
    for (const env of [
      { XIVAPI_BASE: 'https://inputs.test', XIVAPI_VERSION: 'latest' },
      { XIVAPI_BASE: 'https://inputs.test', XIVAPI_VERSION: '7.57' },
      {
        XIVAPI_BASE: 'https://inputs.test',
        XIVAPI_VERSION: 'latest',
        XIVAPI_SCHEMA: 'exdschema@2:ver:request',
      },
      { XIVAPI_BASE: 'https://inputs-other.test', XIVAPI_VERSION: 'latest' },
    ])
      await new XivapiClient(env).resolveContext();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      new URL((fetchMock.mock.calls as unknown as [string][])[2][0]).searchParams.get('schema'),
    ).toBe('exdschema@2:ver:request');
  });

  it.each([
    ['missing schema', { row_id: 1, version: V }],
    ['numeric version', { ...metadata(), version: 1111111111111111 }],
    ['array schema', { ...metadata(), schema: [S] }],
    ['short version', { ...metadata(), version: 'abc' }],
    ['short schema', { ...metadata(), schema: 'exdschema@2:rev:abc' }],
    ['wrong row', { ...metadata(), row_id: 2 }],
    ['partial refresh', { ...metadata(), schema: null }],
  ])('bypasses persistence for %s and retries at exactly one minute', async (label, body) => {
    const fetchMock = vi.fn(async () => okJson(body));
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({
      XIVAPI_BASE: 'https://bad-' + String(label).replaceAll(' ', '-') + '.test',
    });
    expect(await client.resolveContext()).toMatchObject({
      version: 'latest',
      cacheNamespace: null,
    });
    now += 59_999;
    await client.resolveContext();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now++;
    fetchMock.mockImplementation(async () => okJson(metadata()));
    expect(await client.resolveContext()).toMatchObject({
      version: V,
      schema: S,
      cacheNamespace: expect.any(String),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['network', '503', 'invalid-json', 'oversized', 'truncated'])(
    'does not publish failed discovery: %s',
    async (kind) => {
      const fetchMock = vi.fn(async () => {
        if (kind === 'network') throw new Error('timeout');
        if (kind === '503') return new Response(null, { status: 503 });
        if (kind === 'oversized') return new Response('x'.repeat(32 * 1024 + 1));
        return new Response(kind === 'truncated' ? '{"row_id":' : 'not-json');
      });
      vi.stubGlobal('fetch', fetchMock);
      const client = new XivapiClient({ XIVAPI_BASE: 'https://failure-' + kind + '.test' });
      expect((await client.resolveContext()).cacheNamespace).toBeNull();
    },
  );

  it.each([
    { XIVAPI_VERSION: V, XIVAPI_SCHEMA: undefined },
    { XIVAPI_VERSION: 'latest', XIVAPI_SCHEMA: S },
  ])('does not discover away from an explicit canonical pin: %j', async (selectors) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okJson(metadata('bbbbbbbbbbbbbbbb', S2))),
    );
    const client = new XivapiClient({
      XIVAPI_BASE: 'https://pin-' + selectors.XIVAPI_VERSION + '.test',
      ...selectors,
    });
    expect((await client.resolveContext()).cacheNamespace).toBeNull();
  });

  it('retains the last complete context on failure, then recovers', async () => {
    const fetchMock = vi.fn(async () => okJson(metadata()));
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({ XIVAPI_BASE: 'https://last-good.test' });
    const first = await client.resolveContext();
    now += 600_000;
    fetchMock.mockImplementation(async () =>
      okJson({ ...metadata('bbbbbbbbbbbbbbbb'), schema: null }),
    );
    expect(await client.resolveContext()).toEqual(first);
    now += 60_000;
    fetchMock.mockImplementation(async () => okJson(metadata('bbbbbbbbbbbbbbbb', S2)));
    expect(await client.resolveContext()).toMatchObject({
      version: 'bbbbbbbbbbbbbbbb',
      schema: S2,
    });
  });

  it('uses its captured context for Item and Glasses after the memo moves', async () => {
    let version = V;
    let schema = S;
    const fetchMock = vi.fn(async (raw: string) => {
      const url = new URL(raw);
      if (url.pathname.endsWith('/Item/1')) return okJson(metadata(version, schema));
      const identity = {
        version: url.searchParams.get('version'),
        schema: url.searchParams.get('schema'),
      };
      return okJson(
        url.pathname.endsWith('/search')
          ? { ...identity, results: [] }
          : { ...identity, row_id: 3, fields: { Name: 'Glasses' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({ XIVAPI_BASE: 'https://captured.test' });
    const captured = await client.resolveContext();
    now += 600_000;
    version = 'bbbbbbbbbbbbbbbb';
    schema = S2;
    await client.resolveContext();
    await client.searchItems([{ field: 'Head', key: '1' }], captured);
    await client.getGlasses(3, captured);
    for (const [raw] of fetchMock.mock.calls.slice(2)) {
      const url = new URL(raw);
      expect(url.searchParams.get('version')).toBe(V);
      expect(url.searchParams.get('schema')).toBe(S);
    }
  });
});

describe('XivapiClient data requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('projects Item fields under the captured pair, with User-Agent and manual redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ version: V, schema: S, results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient(pinned);
    const result = await client.searchItems(
      [{ field: 'Head', key: '328041' }],
      await client.resolveContext(),
    );
    expect(result).toEqual({ version: V, schema: S, rows: [], truncated: false });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const u = new URL(url);
    expect(u.pathname).toBe('/api/search');
    expect(u.searchParams.get('query')).toBe('+((+EquipSlotCategory.Head=1 +ModelMain=328041))');
    expect(u.searchParams.get('fields')!.split(',')).toEqual(
      expect.arrayContaining([
        'DyeCount',
        'IsGlamorous',
        'EquipRestriction.Viera',
        'EquipRestriction.Female',
        'GrandCompany.row_id',
        'ItemUICategory.row_id',
      ]),
    );
    expect(u.searchParams.get('fields')).not.toContain('ClassJobCategory');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/XIVDyeTools/);
    expect(init.redirect).toBe('manual');
  });
  it.each([
    { version: 'bbbbbbbbbbbbbbbb', schema: S },
    { version: V, schema: S2 },
    { version: V },
    {},
  ])('refuses identity drift/missing metadata: %j', async (identity) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okJson({ ...identity, results: [], row_id: 3, fields: { Name: 'G' } })),
    );
    const client = new XivapiClient(pinned);
    const context = await client.resolveContext();
    await expect(client.searchItems([{ field: 'Head', key: '1' }], context)).rejects.toBeInstanceOf(
      UpstreamUnavailableError,
    );
    await expect(client.getGlasses(3, context)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });
  it('skips all network work for empty lookups', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient(pinned);
    expect(await client.searchItems([], await client.resolveContext())).toEqual({
      version: null,
      schema: null,
      rows: [],
      truncated: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([302, 429, 503])('refuses redirects and unavailable statuses: %i', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status })),
    );
    const client = new XivapiClient(pinned);
    await expect(
      client.searchItems([{ field: 'Head', key: '1' }], await client.resolveContext()),
    ).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });
  it('maps a network timeout to upstream status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const client = new XivapiClient(pinned);
    const error = await client
      .searchItems([{ field: 'Head', key: '1' }], await client.resolveContext())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamUnavailableError);
    expect((error as UpstreamUnavailableError).status).toBe(0);
  });
  it('flags a cursor or a full 500-row search as truncated', async () => {
    const client = new XivapiClient(pinned);
    const context = await client.resolveContext();
    const full = Array.from({ length: 500 }, (_, i) => ({
      row_id: i + 1,
      fields: { Name: 'Item ' + i },
    }));
    for (const [results, next, want] of [
      [[], 'cursor', true],
      [full, undefined, true],
      [full.slice(0, 499), '', false],
    ] as const) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => okJson({ version: V, schema: S, results, next })),
      );
      expect((await client.searchItems([{ field: 'Head', key: '1' }], context)).truncated).toBe(
        want,
      );
    }
  });
  it('reads a Glasses row and preserves a verified 404 as null', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        okJson({
          version: V,
          schema: S,
          row_id: 40,
          fields: { Name: 'Spectacles', 'Name@ja': '???', Icon: { id: 200018 } },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient(pinned);
    const context = await client.resolveContext();
    expect((await client.getGlasses(40, context)).row).toEqual({
      rowId: 40,
      names: { en: 'Spectacles', ja: '???', de: '', fr: '' },
      iconId: 200018,
    });
    expect(await client.getGlasses(9999, context)).toEqual({
      version: null,
      schema: null,
      row: null,
    });
  });
});

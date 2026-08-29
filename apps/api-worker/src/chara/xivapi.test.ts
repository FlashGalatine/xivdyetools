import { describe, it, expect, vi, afterEach } from 'vitest';
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
    ).toBe('+((+EquipSlotCategory.Head=1 +ModelMain=328041) (+EquipSlotCategory.MainHand=1 +ModelMain=4296213114))');
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
    const url = new URL(iconAssetUrl('https://v2.xivapi.com', 41716));
    expect(url.pathname).toBe('/api/asset');
    expect(url.searchParams.get('path')).toBe('ui/icon/041000/041716_hr1.tex');
    expect(url.searchParams.get('format')).toBe('png');
    expect(new URL(iconAssetUrl('https://v2.xivapi.com', 200018)).searchParams.get('path')).toBe(
      'ui/icon/200000/200018_hr1.tex',
    );
  });
});

describe('cleanName / parseItemRow', () => {
  it('strips U+00AD soft hyphens (German names) and trims', () => {
    expect(cleanName('Erzfeind-Pan­zer­hand­schu­he ')).toBe(
      'Erzfeind-Panzerhandschuhe',
    );
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
    });
  });

  it('keeps 64-bit weapon keys exact as strings and tolerates a missing icon', () => {
    const row = parseItemRow({
      row_id: 49486,
      fields: { Name: 'Runaway Bow', ModelMain: 4296213114, ModelSub: 4304732858, EquipSlotCategory: { fields: { MainHand: 1 } } },
    });
    expect(row.modelMain).toBe('4296213114');
    expect(row.modelSub).toBe('4304732858');
    expect(row.iconId).toBeNull();
    expect(row.slots).toEqual(['MainHand']);
  });
});

describe('XivapiClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches Item with the pinned version, a real User-Agent and the slot columns', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ version: 'abc', results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({ XIVAPI_BASE: 'https://xivapi.test/', XIVAPI_VERSION: 'vkey', XIVAPI_SCHEMA: 'exdschema@2:rev:deadbeef' });
    const res = await client.searchItems([{ field: 'Head', key: '328041' }]);
    expect(res.version).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin).toBe('https://xivapi.test');
    expect(u.pathname).toBe('/api/search');
    expect(u.searchParams.get('sheets')).toBe('Item');
    expect(u.searchParams.get('version')).toBe('vkey');
    expect(u.searchParams.get('schema')).toBe('exdschema@2:rev:deadbeef');
    expect(u.searchParams.get('query')).toBe('+((+EquipSlotCategory.Head=1 +ModelMain=328041))');
    expect(u.searchParams.get('fields')).toContain('EquipSlotCategory.FingerR');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/XIVDyeTools/);
    // FINDING-025 / API-9: a redirecting upstream must not be followed to a third
    // host — `manual` (workerd has no `error` mode; it throws on it)
    expect(init.redirect).toBe('manual');
    expect(client.versionKey).toBe('vkey');
    expect(res.truncated).toBe(false);
  });

  it('treats a redirecting XIVAPI as unavailable instead of following it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: 'https://elsewhere.test/' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({ XIVAPI_BASE: 'https://xivapi.test/' });
    await expect(client.searchItems([{ field: 'Head', key: '1' }])).rejects.toThrow(
      UpstreamUnavailableError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips the network for an empty lookup list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({});
    expect(await client.searchItems([])).toEqual({ version: null, rows: [], truncated: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // FINDING-025 / API-3: the caller must know when the single 500-row page
  // could not have held every family it asked for.
  it('flags a truncated page — a next cursor, or a page filled to the 500 cap', async () => {
    const client = new XivapiClient({});
    const lookups = [{ field: 'Head' as const, key: '1' }];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ version: 'v', results: [], next: 'cursor' })));
    expect((await client.searchItems(lookups)).truncated).toBe(true);

    const full = Array.from({ length: 500 }, (_, i) => ({ row_id: i + 1, fields: { Name: `Item ${i}` } }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ version: 'v', results: full })));
    expect((await client.searchItems(lookups)).truncated).toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ version: 'v', results: full.slice(0, 499), next: '' })));
    expect((await client.searchItems(lookups)).truncated).toBe(false);
  });

  it('maps a 503 (search not ready) to UpstreamUnavailableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503, statusText: 'Service Unavailable' })));
    const client = new XivapiClient({});
    await expect(client.searchItems([{ field: 'Head', key: '1' }])).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });

  it('maps a network failure / timeout to UpstreamUnavailableError with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')));
    const client = new XivapiClient({});
    const err = await client.searchItems([{ field: 'Head', key: '1' }]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamUnavailableError);
    expect((err as UpstreamUnavailableError).status).toBe(0);
  });

  it('reads a Glasses row by id and returns null on 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        okJson({ row_id: 40, version: 'abc', fields: { Name: 'Black Rose-colored Spectacles', 'Name@ja': 'ローズ', 'Name@de': 'Brille', 'Name@fr': 'Lunettes', Icon: { id: 200018 } } }),
      )
      .mockResolvedValueOnce(new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new XivapiClient({ XIVAPI_BASE: 'https://xivapi.test' });
    const found = await client.getGlasses(40);
    expect(found.row).toEqual({ rowId: 40, names: { en: 'Black Rose-colored Spectacles', ja: 'ローズ', de: 'Brille', fr: 'Lunettes' }, iconId: 200018 });
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/api/sheet/Glasses/40');
    const missing = await client.getGlasses(99999);
    expect(missing.row).toBeNull();
  });
});

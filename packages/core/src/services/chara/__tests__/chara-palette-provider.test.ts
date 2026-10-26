import { describe, it, expect, vi } from 'vitest';
import { createDefaultPaletteProvider, type PaletteName, type PaletteRequest } from 'xivcharakit/palettes';
import { CharacterColorService } from '../../CharacterColorService.js';
import { createCharaPaletteProvider } from '../chara-palette-provider.js';

const bundled = createDefaultPaletteProvider();
const colors = new CharacterColorService();
const provider = createCharaPaletteProvider(colors);

const SHARED: readonly PaletteName[] = [
  'eyes',
  'highlights',
  'features',
  'lipsDark',
  'lipsLight',
  'facePaintDark',
  'facePaintLight',
];
const SHADER_SHARED: readonly PaletteName[] = ['eyes', 'highlights', 'features', 'lipsDark'];
const TRIBES = [
  'Midlander',
  'Highlander',
  'Wildwood',
  'Duskwight',
  'Plainsfolk',
  'Dunesfolk',
  'SeekerOfTheSun',
  'KeeperOfTheMoon',
  'SeaWolf',
  'Hellsguard',
  'Raen',
  'Xaela',
  'Helions',
  'TheLost',
  'Rava',
  'Veena',
] as const;
const GENDERS = ['Masculine', 'Feminine'] as const;

describe('createCharaPaletteProvider', () => {
  it('matches the bundled provider for shared creator palette entries', async () => {
    for (const palette of SHARED) {
      for (const index of [0, 1, 47, 95]) {
        const request: PaletteRequest = { table: 'creator', palette, index };
        expect(await provider.getColor(request), `${palette}[${index}]`).toEqual({
          ...(await bundled.getColor(request)),
          datasetVersion: 'xivdyetools-host-palette-bridge/1',
        });
      }
    }
  });

  it('matches the bundled provider for shared shader palettes and returns null where the host has none', async () => {
    for (const palette of SHADER_SHARED) {
      for (const index of [0, 5, 95]) {
        const request: PaletteRequest = { table: 'shader', palette, index };
        expect((await provider.getColor(request))?.hex, `${palette}[${index}]`).toBe(
          (await bundled.getColor(request))?.hex,
        );
      }
    }
    for (const palette of ['lipsLight', 'facePaintDark', 'facePaintLight'] as const) {
      expect(await provider.getColor({ table: 'shader', palette, index: 0 })).toBeNull();
    }
  });

  it('matches the bundled provider for skin and hair in all sixteen tribes, both genders and both tables', async () => {
    for (const table of ['creator', 'shader'] as const) {
      for (const palette of ['skin', 'hair'] as const) {
        for (const tribe of TRIBES) {
          for (const gender of GENDERS) {
            for (const index of [0, 77, 191]) {
              const request: PaletteRequest = { table, palette, index, tribe, gender };
              const got = await provider.getColor(request);
              const want = await bundled.getColor(request);
              expect(got?.hex, JSON.stringify(request)).toBe(want?.hex);
              expect(got?.tribe).toBe(tribe);
              expect(got?.gender).toBe(gender);
            }
          }
        }
      }
    }
  });

  it('returns canonical uppercase hex, an RGB tuple and echoes the request', async () => {
    const got = await provider.getColor({ table: 'creator', palette: 'eyes', index: 3 });
    expect(got).not.toBeNull();
    expect(got!.hex).toMatch(/^#[0-9A-F]{6}$/);
    const n = parseInt(got!.hex.slice(1), 16);
    expect(got!.rgb).toEqual([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    expect(got).toMatchObject({
      table: 'creator',
      palette: 'eyes',
      index: 3,
      datasetVersion: 'xivdyetools-host-palette-bridge/1',
    });
    expect(provider.metadata).toBeUndefined();
  });

  it('returns a detached result each call', async () => {
    const a = await provider.getColor({ table: 'creator', palette: 'eyes', index: 3 });
    const b = await provider.getColor({ table: 'creator', palette: 'eyes', index: 3 });
    expect(a).not.toBe(b);
    const first = a!.rgb[0];
    (a!.rgb as unknown as number[])[0] = 999;
    expect((await provider.getColor({ table: 'creator', palette: 'eyes', index: 3 }))!.rgb[0]).toBe(first);
  });

  it('returns null for invalid coordinates before touching any data', async () => {
    const skin = vi.spyOn(colors, 'getSkinColors');
    const hair = vi.spyOn(colors, 'getHairColors');
    const bad: unknown[] = [
      { table: 'creator', palette: 'nope', index: 0 },
      { table: 'other', palette: 'eyes', index: 0 },
      { table: 'creator', palette: 'eyes', index: -1 },
      { table: 'creator', palette: 'eyes', index: 1.5 },
      { table: 'creator', palette: 'eyes', index: 192 },
      { table: 'creator', palette: 'eyes', index: Number.NaN },
      { table: 'creator', palette: 'lipsDark', index: 96 },
      { table: 'creator', palette: 'skin', index: 0 },
      { table: 'creator', palette: 'skin', index: 0, tribe: 'Midlander' },
      { table: 'creator', palette: 'skin', index: 0, tribe: 'Nobody', gender: 'Masculine' },
      { table: 'creator', palette: 'skin', index: 0, tribe: 'Midlander', gender: 'Male' },
      { table: 'creator', palette: 'hair', index: 0, tribe: '__proto__', gender: 'Feminine' },
      { table: 'shader', palette: 'skin', index: 192, tribe: 'Midlander', gender: 'Feminine' },
    ];
    for (const request of bad) {
      expect(await provider.getColor(request as PaletteRequest), JSON.stringify(request)).toBeNull();
    }
    expect(skin).not.toHaveBeenCalled();
    expect(hair).not.toHaveBeenCalled();
    skin.mockRestore();
    hair.mockRestore();
  });

  it('maps library genders to host genders when calling the race getters', async () => {
    const skin = vi.spyOn(colors, 'getSkinColors');
    await provider.getColor({ table: 'creator', palette: 'skin', index: 0, tribe: 'Wildwood', gender: 'Feminine' });
    await provider.getColor({ table: 'creator', palette: 'skin', index: 0, tribe: 'Wildwood', gender: 'Masculine' });
    expect(skin.mock.calls).toEqual([
      ['Wildwood', 'Female'],
      ['Wildwood', 'Male'],
    ]);
    skin.mockRestore();
  });

  it('propagates a loader failure, then succeeds on retry', async () => {
    const request: PaletteRequest = {
      table: 'creator',
      palette: 'hair',
      index: 1,
      tribe: 'Midlander',
      gender: 'Masculine',
    };
    const fail = vi.spyOn(colors, 'getHairColors').mockRejectedValueOnce(new Error('load'));
    await expect(provider.getColor(request)).rejects.toThrow('load');
    fail.mockRestore();
    expect((await provider.getColor(request))?.hex).toBe((await bundled.getColor(request))?.hex);
  });

  it('does not use the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await provider.getColor({ table: 'shader', palette: 'hair', index: 4, tribe: 'Veena', gender: 'Feminine' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCharaFile } from '../chara-parser.js';
import { resolveCharaColors, OFF_GRID_DELTA_E2000 } from '../chara-resolver.js';
import { charaShaderHex } from '../chara-shader-colors.js';
import { CharacterColorService } from '../../CharacterColorService.js';
import { DyeService } from '../../DyeService.js';
import dyeData from '../../../data/dyes.json' with { type: 'json' };

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string): string => readFileSync(join(fixturesDir, name), 'utf8');

const characterColors = new CharacterColorService();
const dyeService = new DyeService(dyeData);

const minimal = (extra: Record<string, unknown>): string =>
  JSON.stringify({ Race: 'Elezen', Tribe: 'Wildwood', Gender: 'Feminine', ...extra });

describe('resolveCharaColors', () => {
  it('resolves heterochromia eyes separately and never merges them', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(fixture('duskwight-heterochromia.chara')),
      characterColors
    );
    const left = resolved.slots.find((s) => s.slot === 'leftEye');
    const right = resolved.slots.find((s) => s.slot === 'rightEye');
    expect(left?.indexHex).toBeTruthy();
    expect(right?.indexHex).toBeTruthy();
    expect(left?.floatHex).not.toBe(right?.floatHex);
    expect(resolved.eyesShareIndex).toBe(false);
  });

  describe('eye pairing', () => {
    // #DCBA6C (42) and #87C0A3 (169), stored squared the way the game writes them
    const stored = (index: number): string => {
      const { r, g, b } = characterColors.getEyeColors()[index].rgb;
      return [r, g, b].map((c) => ((c / 255) ** 2).toFixed(8)).join(', ');
    };
    const eyes = async (extra: Record<string, unknown>) => {
      const resolved = await resolveCharaColors(
        parseCharaFile(
          minimal({ LEyeColor: 169, REyeColor: 42, IsExtendedAppearanceValid: true, ...extra })
        ),
        characterColors
      );
      return {
        left: resolved.slots.find((s) => s.slot === 'leftEye'),
        right: resolved.slots.find((s) => s.slot === 'rightEye'),
      };
    };

    it('pairs by name when each float lands on its own eye (153 of 157 heterochromia files)', async () => {
      const { left, right } = await eyes({ LeftEyeColor: stored(169), RightEyeColor: stored(42) });
      expect(left?.floatHex?.toUpperCase()).toBe('#87C0A3');
      expect(right?.floatHex?.toUpperCase()).toBe('#DCBA6C');
      expect([left?.verdict, right?.verdict]).toEqual(['index', 'index']);
      expect([left?.deltaE, right?.deltaE]).toEqual([0, 0]);
    });

    it('un-crosses a file whose two floats each land on the other eye', async () => {
      const { left, right } = await eyes({ LeftEyeColor: stored(42), RightEyeColor: stored(169) });
      expect(left?.index).toBe(169);
      expect(left?.floatHex?.toUpperCase()).toBe('#87C0A3');
      expect(right?.floatHex?.toUpperCase()).toBe('#DCBA6C');
      expect([left?.verdict, right?.verdict]).toEqual(['index', 'index']);
    });

    it('un-crosses the duskwight fixture (amber stored on the left key, index 169 sage)', async () => {
      const resolved = await resolveCharaColors(
        parseCharaFile(fixture('duskwight-heterochromia.chara')),
        characterColors
      );
      const left = resolved.slots.find((s) => s.slot === 'leftEye');
      const right = resolved.slots.find((s) => s.slot === 'rightEye');
      expect(left?.floatHex?.toUpperCase()).toBe(left?.indexHex?.toUpperCase());
      expect(right?.floatHex?.toUpperCase()).toBe(right?.indexHex?.toUpperCase());
      expect([left?.verdict, right?.verdict]).toEqual(['index', 'index']);
    });

    it('never swaps on half a match: a custom colour is OFF GRID on its own eye', async () => {
      // The right float lands on the LEFT index, but the left float is custom
      const { left, right } = await eyes({ LeftEyeColor: '0, 0, 1', RightEyeColor: stored(169) });
      expect(left?.floatHex?.toUpperCase()).toBe('#0000FF');
      expect(right?.floatHex?.toUpperCase()).toBe('#87C0A3');
      expect([left?.verdict, right?.verdict]).toEqual(['offGrid', 'offGrid']);
    });

    it('does not un-cross when both eyes share an index', async () => {
      const resolved = await resolveCharaColors(
        parseCharaFile(
          minimal({
            LEyeColor: 42,
            REyeColor: 42,
            LeftEyeColor: '0, 0, 1',
            RightEyeColor: stored(42),
            IsExtendedAppearanceValid: true,
          })
        ),
        characterColors
      );
      expect(resolved.slots.find((s) => s.slot === 'leftEye')?.verdict).toBe('offGrid');
      expect(resolved.slots.find((s) => s.slot === 'rightEye')?.verdict).toBe('index');
    });
  });

  it('merges shared-index eyes into one badge signal', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(fixture('xaela-anamnesis-header.chara')),
      characterColors
    );
    expect(resolved.eyesShareIndex).toBe(true);
  });

  it('missing IsExtendedAppearanceValid → index wins and the UI is told', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(fixture('xaela-anamnesis-header.chara')),
      characterColors
    );
    const left = resolved.slots.find((s) => s.slot === 'leftEye');
    expect(left?.verdict).toBe('index');
    expect(left?.indexWinNote).toBe('extendedMissing');
    expect(left?.floatHex).toBeTruthy(); // both hexes still available to name
  });

  it('a live float far from the sheet colour goes OFF GRID with both hexes named', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(
        minimal({
          LEyeColor: 0, // near-white sheet entry
          LeftEyeColor: '0.01, 0.01, 0.01', // near-black live float
          IsExtendedAppearanceValid: true,
        })
      ),
      characterColors
    );
    const left = resolved.slots.find((s) => s.slot === 'leftEye');
    expect(left?.verdict).toBe('offGrid');
    expect(left?.indexHex).toBeTruthy();
    expect(left?.floatHex).toBeTruthy();
    expect(left?.deltaE).toBeGreaterThan(OFF_GRID_DELTA_E2000);
  });

  it('index wins when the live float agrees within the threshold', async () => {
    const sheetHex = characterColors.getEyeColors()[0].hex; // #F7F7F7
    expect(sheetHex.toUpperCase()).toBe('#F7F7F7');
    const resolved = await resolveCharaColors(
      parseCharaFile(
        minimal({
          LEyeColor: 0,
          LeftEyeColor: '0.93817762, 0.93817762, 0.93817762', // (247/255)², #F7F7F7 as stored
          IsExtendedAppearanceValid: true,
        })
      ),
      characterColors
    );
    const left = resolved.slots.find((s) => s.slot === 'leftEye');
    expect(left?.verdict).toBe('index');
    expect(left?.deltaE).toBeLessThanOrEqual(OFF_GRID_DELTA_E2000);
    // The square root lands the stored value exactly on its palette entry
    expect(left?.floatHex?.toUpperCase()).toBe('#F7F7F7');
    expect(left?.deltaE).toBe(0);
  });

  describe('a float is judged against the color the game stores, not the swatch', () => {
    // As a .chara stores it: the shader color, each channel squared
    const squared = (hex: string): string =>
      [1, 3, 5].map((i) => ((parseInt(hex.slice(i, i + 2), 16) / 255) ** 2).toFixed(8)).join(', ');
    const stored = async (
      palette: 'skin' | 'hair' | 'features' | 'lipsDark',
      index: number
    ): Promise<string> => (await charaShaderHex(palette, index, 'Wildwood', 'Female'))!;
    const judge = async (extra: Record<string, unknown>) =>
      (
        await resolveCharaColors(
          parseCharaFile(minimal({ IsExtendedAppearanceValid: true, ...extra })),
          characterColors
        )
      ).slots;

    it('an unedited skin or hair float agrees with its stored color, though not with the swatch', async () => {
      const slots = await judge({
        Skintone: 3,
        HairTone: 42,
        SkinColor: squared(await stored('skin', 3)),
        HairColor: squared(await stored('hair', 42)),
      });
      for (const id of ['skin', 'hair'] as const) {
        const slot = slots.find((s) => s.slot === id);
        expect(slot?.verdict, id).toBe('index');
        expect(slot?.deltaE, id).toBe(0);
        expect(slot?.floatHex, id).not.toBe(slot?.indexHex);
      }
    });

    it('a custom skin or hair color is OFF GRID again', async () => {
      const slots = await judge({
        Skintone: 3,
        HairTone: 42,
        SkinColor: '0, 0, 1',
        HairColor: '0, 1, 0',
      });
      expect(slots.find((s) => s.slot === 'skin')?.verdict).toBe('offGrid');
      expect(slots.find((s) => s.slot === 'hair')?.verdict).toBe('offGrid');
    });

    it('judges a light-palette lip against the dark entry the game stores for it', async () => {
      const slots = await judge({
        LipsToneFurPattern: 138,
        MouthColor: `${squared(await stored('lipsDark', 10))}, 0.8`,
      });
      const lip = slots.find((s) => s.slot === 'lip');
      expect(lip?.sheetVariant).toBe('light');
      expect(lip?.indexHex).toBe(characterColors.getLipColorsLight()[10].hex);
      expect(lip?.verdict).toBe('index');
      expect(lip?.deltaE).toBe(0);
    });

    it('still calls a custom light-palette lip OFF GRID', async () => {
      const slots = await judge({ LipsToneFurPattern: 138, MouthColor: '0, 0, 1, 0.8' });
      expect(slots.find((s) => s.slot === 'lip')?.verdict).toBe('offGrid');
    });

    it('judges the limbal ring against the stored feature color — entry 7 stores black', async () => {
      const live = { SkinColor: '0.25, 0.25, 0.25' }; // so the block is not the never-read one
      const at42 = (
        await judge({
          ...live,
          LimbalEyes: 42,
          LimbalRingColor: squared(await stored('features', 42)),
        })
      ).find((s) => s.slot === 'limbal');
      expect([at42?.verdict, at42?.deltaE]).toEqual(['index', 0]);
      const at7 = (await judge({ ...live, LimbalEyes: 7, LimbalRingColor: '0, 0, 0' })).find(
        (s) => s.slot === 'limbal'
      );
      expect([at7?.verdict, at7?.deltaE]).toEqual(['index', 0]);
      const custom = (await judge({ ...live, LimbalEyes: 42, LimbalRingColor: '0, 0, 1' })).find(
        (s) => s.slot === 'limbal'
      );
      expect(custom?.verdict).toBe('offGrid');
    });
  });

  it('96-127 on a dark/light palette fails loudly, never clamps', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(minimal({ LipsToneFurPattern: 100, MouthColor: '0.1, 0.1, 0.1, 0.5' })),
      characterColors
    );
    const lip = resolved.slots.find((s) => s.slot === 'lip');
    expect(lip?.verdict).toBe('error');
    expect(lip?.error?.code).toBe('midRangeIndex');
    expect(lip?.error?.message).toContain('100');
  });

  it('128-223 resolves against the light sheet with the offset removed', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(minimal({ LipsToneFurPattern: 130 })),
      characterColors
    );
    const lip = resolved.slots.find((s) => s.slot === 'lip');
    expect(lip?.sheetVariant).toBe('light');
    expect(lip?.sheetIndex).toBe(2);
    expect(lip?.indexHex).toBe(characterColors.getLipColorsLight()[2].hex);
  });

  it('labels the limbal slot tattoo off Au Ra and limbal on Au Ra', async () => {
    const elezen = await resolveCharaColors(
      parseCharaFile(minimal({ LimbalEyes: 3 })),
      characterColors
    );
    expect(elezen.slots.find((s) => s.slot === 'limbal')?.kind).toBe('tattoo');

    const auRa = await resolveCharaColors(
      parseCharaFile(
        JSON.stringify({ Race: 'AuRa', Tribe: 'Raen', Gender: 'Masculine', LimbalEyes: 3 })
      ),
      characterColors
    );
    expect(auRa.slots.find((s) => s.slot === 'limbal')?.kind).toBe('limbal');
  });

  it('a Hrothgar lip holding a live colour takes the OFF-GRID path', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(
        JSON.stringify({
          Race: 'Hrothgar',
          Tribe: 'TheLost',
          Gender: 'Masculine',
          LipsToneFurPattern: 35,
          MouthColor: '0.2, 0.02, 0.05, 0.8',
          IsExtendedAppearanceValid: true,
        })
      ),
      characterColors
    );
    const lip = resolved.slots.find((s) => s.slot === 'lip');
    expect(lip?.verdict).toBe('floatOnly');
    expect(lip?.floatHex).toBeTruthy();
    expect(lip?.indexHex).toBeNull();
  });

  it('alpha 0 means no lip even on Hrothgar', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(fixture('hrothgar-helions.chara')),
      characterColors
    );
    const lip = resolved.slots.find((s) => s.slot === 'lip');
    expect(lip?.verdict).toBe('inert');
    expect(lip?.inertReason).toBe('noLip');
  });

  it('composites the lip over skin and provides both raw and blend', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(fixture('wildwood-facepaint.chara')),
      characterColors
    );
    const lip = resolved.slots.find((s) => s.slot === 'lip');
    expect(lip?.alpha).toBeCloseTo(0.6, 6);
    expect(lip?.blendHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // The blend must differ from the raw lip colour (it carries 40% skin)
    const raw = lip?.verdict === 'offGrid' ? lip?.floatHex : lip?.indexHex;
    expect(lip?.blendHex).not.toBe(raw);
  });

  it('produces grid addresses on the 8-column grid', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(minimal({ LEyeColor: 10 })),
      characterColors
    );
    expect(resolved.slots.find((s) => s.slot === 'leftEye')?.gridAddress).toBe('R2·C3');
  });

  it('resolves gear dye stain IDs through the dye database', async () => {
    const resolved = await resolveCharaColors(
      parseCharaFile(fixture('duskwight-heterochromia.chara')),
      characterColors,
      dyeService
    );
    expect(resolved.gearDyes).toHaveLength(7);
    const headGear = resolved.gearDyes.find((g) => g.slot === 'HeadGear' && g.channel === 1);
    expect(headGear?.stainId).toBe(92);
    expect(headGear?.dye?.stainID).toBe(92);
    // stainId 1 = Snow White
    const channel2 = resolved.gearDyes.find((g) => g.slot === 'HeadGear' && g.channel === 2);
    expect(channel2?.dye?.name).toBe('Snow White');
  });
});

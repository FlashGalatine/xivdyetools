import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCharaFile } from '../chara-parser.js';
import { resolveCharaColors, OFF_GRID_DELTA_E2000 } from '../chara-resolver.js';
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
          REyeColor: 0, // near-white sheet entry
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
          REyeColor: 0,
          LeftEyeColor: '0.9301, 0.9301, 0.9301', // ≈ linear of #F7F7F7
          IsExtendedAppearanceValid: true,
        })
      ),
      characterColors
    );
    const left = resolved.slots.find((s) => s.slot === 'leftEye');
    expect(left?.verdict).toBe('index');
    expect(left?.deltaE).toBeLessThanOrEqual(OFF_GRID_DELTA_E2000);
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
      parseCharaFile(minimal({ REyeColor: 10 })),
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

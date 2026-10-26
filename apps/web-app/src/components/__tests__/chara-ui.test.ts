/**
 * The `.chara` views' shared text helpers: a count in the locale's plural form
 * (I18N-007) and two sentences joined the way the locale writes them
 * (I18N-012). Real LanguageService (setup.ts initialises it with EN); the
 * plural tests switch locale and spy on `tInterpolate`, so they assert which
 * key was chosen rather than the wording of a translation.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { CharaImportIssue } from '@xivdyetools/core';
import { LanguageService } from '@services/index';
import {
  charaWarnings,
  hasValidGridCoordinate,
  joinSentences,
  matchTargetHex,
  previewHex,
  slotLabel,
  slotProblemText,
  slotViewState,
  tCount,
} from '../chara-ui';
import { makeImportedCharacter, makeImportedSlot } from '../../__tests__/mocks/imported-chara';

afterEach(async () => {
  vi.restoreAllMocks();
  await LanguageService.setLocale('en');
});

describe('tCount — a count in the locale plural form (I18N-007)', () => {
  it('takes the one form at 1 and the other form at 0 and 2 in English', () => {
    expect(tCount(1, 'glamour.row.twins_one', 'glamour.row.twins_other')).toBe(
      'Same look as 1 other item: pick the one the list names'
    );
    expect(tCount(2, 'glamour.row.twins_one', 'glamour.row.twins_other')).toBe(
      'Same look as 2 other items: pick the one the list names'
    );
    expect(tCount(0, 'swatch.footEmpty_one', 'swatch.footEmpty_other')).toBe('0 slots are empty');
  });

  it('follows French, where 0 takes the one form — and fills in the 0', async () => {
    await LanguageService.setLocale('fr');
    const spy = vi.spyOn(LanguageService, 'tInterpolate');

    tCount(0, 'swatch.footEmpty_one', 'swatch.footEmpty_other');
    tCount(2, 'swatch.footEmpty_one', 'swatch.footEmpty_other');

    expect(spy).toHaveBeenNthCalledWith(1, 'swatch.footEmpty_one', { n: '0' });
    expect(spy).toHaveBeenNthCalledWith(2, 'swatch.footEmpty_other', { n: '2' });
  });

  it('uses the other form for every count in a language with no singular (ja)', async () => {
    await LanguageService.setLocale('ja');
    const spy = vi.spyOn(LanguageService, 'tInterpolate');

    tCount(1, 'swatch.footEmpty_one', 'swatch.footEmpty_other');

    expect(spy).toHaveBeenCalledWith('swatch.footEmpty_other', { n: '1' });
  });
});

describe('joinSentences — no ASCII space after a full-width stop (I18N-012)', () => {
  it('writes the two sentences together after 。, ！ or ？', () => {
    expect(joinSentences('この端末にとどまります。', '編集した入手方法は保存されます。')).toBe(
      'この端末にとどまります。編集した入手方法は保存されます。'
    );
    expect(joinSentences('留在本机。', '编辑会保存。')).toBe('留在本机。编辑会保存。');
    expect(joinSentences('本当？', '次。')).toBe('本当？次。');
    expect(joinSentences('はい！', '次。')).toBe('はい！次。');
  });

  it('keeps one space after a Latin full stop, as en, de, fr and ko write it', () => {
    expect(joinSentences('Colors stay here.', 'Notes are kept here.')).toBe(
      'Colors stay here. Notes are kept here.'
    );
    expect(joinSentences('이 기기에 남습니다.', '수정한 내용은 저장됩니다.')).toBe(
      '이 기기에 남습니다. 수정한 내용은 저장됩니다.'
    );
  });
});

// ---------------------------------------------------------------------------
// Task 5 (assignment B): the slot state classifier and the file card's warning rows, over the
// xivcharakit-backed projection (`ImportedCharaSlot`). Hand-built slots from the shared factory;
// the real-file tuples are pinned in chara-sheet.test.ts through the loader.
// ---------------------------------------------------------------------------

type Slot = ReturnType<typeof makeImportedSlot>;
type SlotName = Slot['slot'];
const t = (key: string): string => LanguageService.t(key);
const SLOT_NAMES: readonly SlotName[] = [
  'leftEye',
  'rightEye',
  'hair',
  'highlights',
  'skin',
  'limbal',
  'lip',
  'facePaint',
];

/** An unresolved slot: no color evidence, so no preview and no match. */
function unresolvedSlot(reason: Slot['reason'], extra: Partial<Slot> = {}): Slot {
  return makeImportedSlot({
    interpretation: 'unresolved',
    reason,
    displayHex: null,
    creatorHex: null,
    shaderHex: null,
    ...extra,
  });
}

/** The library leaves an inactive slot's palette coordinate in place, never its preview. */
function inactiveSlot(reason: Slot['reason'], extra: Partial<Slot> = {}): Slot {
  return makeImportedSlot({
    active: false,
    interpretation: 'inactive',
    reason,
    displayHex: null,
    ...extra,
  });
}

function issue(
  code: string,
  path: CharaImportIssue['path'] = [],
  severity: CharaImportIssue['severity'] = 'warning'
): CharaImportIssue {
  return { code, severity, path };
}

describe('slotViewState — one classifier for the file card, the sheet and the pins', () => {
  it('reads a confirmed palette color as on the grid', () => {
    expect(slotViewState(makeImportedSlot())).toEqual({ kind: 'onGrid' });
  });

  it.each(['offGrid', 'extendedOnly'] as const)(
    'reads a confirmed %s color as off the grid',
    (interpretation) => {
      const slot = makeImportedSlot({
        interpretation,
        reason: interpretation === 'offGrid' ? 'offGrid' : 'floatOnly',
        displayHex: '#123456',
      });
      expect(slot.matchHex).toBe('#123456');
      expect(slotViewState(slot)).toEqual({ kind: 'offGrid' });
    }
  );

  // Key on `active`, never on `reason`: a live float with no EnableHighlights keeps the library's
  // offGrid interpretation and reason, but its activation is still unknown (plan L165).
  it.each([
    ['palette', 'activityUnknown'],
    ['palette', 'extendedInactive'],
    ['offGrid', 'offGrid'],
    ['extendedOnly', 'floatOnly'],
  ] as const)('reads %s / %s with active null as activity unknown', (interpretation, reason) => {
    const slot = makeImportedSlot({ active: null, interpretation, reason, displayHex: '#808080' });
    expect(slot.matchHex).toBeNull();
    expect(slotViewState(slot)).toEqual({ kind: 'activityUnknown' });
  });

  it.each(['highlightsDisabled', 'facePaintNone', 'noLip', 'lipDisabled', 'furPattern'] as const)(
    'reads inactive %s as inactive with its reason',
    (reason) => {
      expect(slotViewState(inactiveSlot(reason))).toEqual({ kind: 'inactive', reason });
    }
  );

  it('reads a color the file does not store as absent, not as an error', () => {
    expect(slotViewState(unresolvedSlot('missingColor'))).toEqual({ kind: 'absent' });
  });

  it.each([
    ['missingTribeGender', {}, 'noTribe'],
    ['missingRace', {}, 'noRace'],
    ['indexOutOfRange', {}, 'indexOutOfRange'],
    ['indexOutOfRange', { indexGap: true }, 'midRangeIndex'],
    // The fraction 96.5 the maintainer asked for: invalid, but in the gap (ruling 2).
    ['invalidIndex', { indexGap: true }, 'midRangeIndex'],
    ['invalidIndex', {}, 'unknown'],
    ['missingPaletteEntry', {}, 'indexOutOfRange'],
    ['missingShaderReference', {}, 'unknown'],
  ] as const)('reads unresolved %s %j as the %s problem', (reason, extra, code) => {
    expect(slotViewState(unresolvedSlot(reason, extra))).toEqual({ kind: 'unresolved', code });
  });

  it.each(['PALETTE_UNAVAILABLE', 'INVALID_PALETTE_RESPONSE'])(
    'reads a missing palette entry as unknown when the file carries %s',
    (code) => {
      const slot = unresolvedSlot('missingPaletteEntry');
      expect(slotViewState(slot, [issue(code, ['HairTone'])])).toEqual({
        kind: 'unresolved',
        code: 'unknown',
      });
    }
  );
});

describe('previewHex / matchTargetHex / hasValidGridCoordinate', () => {
  const composite = { hex: '#CC8877', alpha: 0.4, derived: true } as const;

  it('previews the display color, and the lip composite where one exists', () => {
    expect(previewHex(makeImportedSlot({ displayHex: '#112233' }))).toBe('#112233');
    const lip = makeImportedSlot({ slot: 'lip', displayHex: '#AA0000', lipComposite: composite });
    expect(previewHex(lip)).toBe('#CC8877');
  });

  it('previews an unknown-activation color but never matches it (D6, D4)', () => {
    const slot = makeImportedSlot({
      active: null,
      reason: 'activityUnknown',
      displayHex: '#808080',
    });
    expect(previewHex(slot)).toBe('#808080');
    expect(matchTargetHex(slot)).toBeNull();
  });

  it('has nothing to preview or match on an inactive or unresolved slot', () => {
    for (const slot of [
      inactiveSlot('lipDisabled', { slot: 'lip' }),
      unresolvedSlot('missingColor'),
    ]) {
      expect(previewHex(slot)).toBeNull();
      expect(matchTargetHex(slot)).toBeNull();
    }
  });

  it('matches the lip composite when the lip is confirmed (D1), its own color otherwise', () => {
    const blended = makeImportedSlot({
      slot: 'lip',
      displayHex: '#AA0000',
      lipComposite: composite,
    });
    expect(matchTargetHex(blended)).toBe('#CC8877');
    expect(matchTargetHex(makeImportedSlot({ slot: 'lip', displayHex: '#AA0000' }))).toBe(
      '#AA0000'
    );
  });

  it('never matches a composite whose lip is of unknown activation', () => {
    const lip = makeImportedSlot({
      slot: 'lip',
      active: null,
      displayHex: '#AA0000',
      lipComposite: composite,
    });
    expect(matchTargetHex(lip)).toBeNull();
  });

  it('never falls back from a null matchHex to the display color', () => {
    expect(matchTargetHex(makeImportedSlot({ displayHex: '#123456', matchHex: null }))).toBeNull();
  });

  it('calls a coordinate valid only with a sheet index and a creator color', () => {
    expect(hasValidGridCoordinate(makeImportedSlot())).toBe(true);
    // missingTribeGender keeps sheetIndex but has no creator entry.
    expect(
      hasValidGridCoordinate(unresolvedSlot('missingTribeGender', { slot: 'hair', sheetIndex: 12 }))
    ).toBe(false);
    expect(hasValidGridCoordinate(makeImportedSlot({ sheetIndex: null }))).toBe(false);
  });
});

describe('slotProblemText — keyed sentences, never core text', () => {
  it.each([
    ['missingTribeGender', {}, 'swatch.slotError.noTribe'],
    ['missingRace', {}, 'swatch.slotError.noRace'],
    ['indexOutOfRange', { indexGap: true }, 'swatch.slotError.midRangeIndex'],
    ['indexOutOfRange', {}, 'swatch.slotError.indexOutOfRange'],
    ['invalidIndex', {}, 'swatch.slotError.unknown'],
  ] as const)('%s %j says %s', (reason, extra, key) => {
    expect(t(key)).not.toBe(key);
    expect(slotProblemText(unresolvedSlot(reason, extra), [])).toBe(t(key));
  });
});

describe('slotLabel — the race-unknown limbal slot', () => {
  it('names a limbalOrTattoo slot "Tattoo / Limbal"', () => {
    const label = (kind: Slot['kind']) => slotLabel(makeImportedSlot({ slot: 'limbal', kind }));
    expect(label('limbalOrTattoo')).toBe(t('swatch.palTattoo'));
    expect(label('tattoo')).toBe(t('swatch.slotTattoo'));
    expect(label('limbal')).toBe(t('swatch.slotLimbal'));
  });
});

describe('charaWarnings — the amber card rows', () => {
  /** A character whose eight slots are all quietly absent unless overridden. */
  const quiet = (
    slots: Partial<Record<SlotName, Partial<Slot>>> = {},
    issues: CharaImportIssue[] = []
  ) =>
    makeImportedCharacter({
      slots: SLOT_NAMES.map((s) => unresolvedSlot('missingColor', { slot: s, ...slots[s] })),
      issues,
    });
  const texts = (resolved: ReturnType<typeof quiet>, includeGear: boolean) =>
    charaWarnings(resolved, { includeGear }).map((w) => w.text);

  it('has nothing to say about a fully confirmed character', () => {
    expect(charaWarnings(makeImportedCharacter(), { includeGear: false })).toEqual([]);
  });

  it('says nothing about absent or inactive slots', () => {
    const resolved = quiet({
      highlights: { active: false, interpretation: 'inactive', reason: 'highlightsDisabled' },
      lip: { active: false, interpretation: 'inactive', reason: 'lipDisabled' },
    });
    expect(charaWarnings(resolved, { includeGear: true })).toEqual([]);
  });

  it('gives an error row, an UNCONFIRMED row and an OFF GRID row', () => {
    const resolved = quiet({
      hair: { reason: 'missingTribeGender', sheetIndex: 4 },
      highlights: {
        active: null,
        interpretation: 'offGrid',
        reason: 'offGrid',
        displayHex: '#808080',
        matchHex: null,
      },
      skin: {
        active: true,
        interpretation: 'offGrid',
        reason: 'offGrid',
        displayHex: '#335577',
        matchHex: '#335577',
      },
    });
    expect(charaWarnings(resolved, { includeGear: false })).toEqual([
      {
        tag: t('swatch.warnErrorTag'),
        text: `${t('swatch.slotHair')} · ${t('swatch.slotError.noTribe')}`,
        severe: true,
      },
      {
        tag: t('swatch.activityUnknownTag'),
        text: `${t('swatch.slotHighlights')} · ${t('swatch.activityUnknownNote')}`,
        severe: false,
      },
      {
        tag: t('swatch.offGrid'),
        text: `${t('swatch.slotSkin')} · ${t('swatch.offGridNote')}`,
        severe: false,
      },
    ]);
  });

  it('keys the gap sentence on indexGap (ruling 2)', () => {
    const resolved = quiet({ lip: { reason: 'invalidIndex', indexGap: true } });
    expect(texts(resolved, false)).toEqual([
      `${t('swatch.slotLips')} · ${t('swatch.slotError.midRangeIndex')}`,
    ]);
  });

  it.each([
    ['IMAGE_OMITTED', ['Base64Image'], 'info'],
    ['INVALID_IMAGE_TYPE', ['unknown'], 'warning'],
    ['UNSUPPORTED_FIELD', ['unknown'], 'info'],
    ['AMBIGUOUS_ZERO_BLOCK', [], 'info'],
    ['EXTENDED_CLAMPED', ['HairColor'], 'warning'],
    ['ALPHA_CLAMPED', ['MouthColor'], 'warning'],
    ['MISSING_PALETTE_CONTEXT', ['HairTone'], 'warning'],
    ['PALETTE_INDEX_OUT_OF_RANGE', ['LipsToneFurPattern'], 'warning'],
    ['MISSING_SHADER_REFERENCE', ['hair'], 'warning'],
    ['INVALID_FIELD', ['HairTone'], 'warning'],
    ['UNSUPPORTED_VALUE', ['LEyeColor'], 'warning'],
    ['SOMETHING_NEW_BUT_INFO', [], 'info'],
  ] as const)('stays silent about routine %s', (code, path, severity) => {
    expect(charaWarnings(quiet({}, [issue(code, path, severity)]), { includeGear: true })).toEqual(
      []
    );
  });

  it.each([
    ['INVALID_FIELD', ['Tribe'], 'swatch.issue.invalidIdentity'],
    ['UNSUPPORTED_VALUE', ['Gender'], 'swatch.issue.invalidIdentity'],
    ['INVALID_FIELD', ['Race'], 'swatch.issue.invalidIdentity'],
    ['INVALID_FIELD', ['EnableHighlights'], 'swatch.issue.invalidField'],
    ['INVALID_FIELD', ['Glasses'], 'swatch.issue.invalidField'],
    ['RACE_TRIBE_MISMATCH', ['Race'], 'swatch.issue.raceTribeMismatch'],
    ['EYE_PAIRING_INFERRED', ['leftEye'], 'swatch.issue.eyePairingInferred'],
    ['EYE_PAIRING_UNCONFIRMED', ['leftEye'], 'swatch.issue.unknown'],
    ['PALETTE_UNAVAILABLE', ['HairTone'], 'swatch.issue.paletteUnavailable'],
    ['INVALID_PALETTE_RESPONSE', ['HairTone'], 'swatch.issue.paletteUnavailable'],
    ['ISSUES_TRUNCATED', [], 'swatch.issue.truncated'],
  ] as const)('shows %s %j as %s, with the CHECK tag', (code, path, key) => {
    // RACE_TRIBE_MISMATCH is info in the library; the explicit map wins over severity.
    const severity = code === 'RACE_TRIBE_MISMATCH' ? 'info' : 'warning';
    expect(t(key)).not.toBe(key);
    expect(charaWarnings(quiet({}, [issue(code, path, severity)]), { includeGear: false })).toEqual(
      [{ tag: t('swatch.warnCheckTag'), text: t(key), severe: false }]
    );
  });

  it.each(['warning', 'error'] as const)(
    'falls back to the generic sentence for an unknown %s code, never printing the code',
    (severity) => {
      const rows = charaWarnings(quiet({}, [issue('BRAND_NEW_CODE', ['unknown'], severity)]), {
        includeGear: false,
      });
      expect(rows).toEqual([
        { tag: t('swatch.warnCheckTag'), text: t('swatch.issue.unknown'), severe: false },
      ]);
      expect(JSON.stringify(rows)).not.toContain('BRAND_NEW_CODE');
    }
  );

  it('does not read a prototype member as a mapped code', () => {
    expect(texts(quiet({}, [issue('constructor')]), false)).toEqual([t('swatch.issue.unknown')]);
  });

  it('lists each sentence once, after the slot rows', () => {
    const resolved = quiet({ hair: { reason: 'missingTribeGender' } }, [
      issue('INVALID_FIELD', ['EnableHighlights']),
      issue('INVALID_FIELD', ['FacePaint']),
      issue('PALETTE_UNAVAILABLE', ['HairTone']),
      issue('INVALID_PALETTE_RESPONSE', ['Skintone']),
    ]);
    expect(texts(resolved, false)).toEqual([
      `${t('swatch.slotHair')} · ${t('swatch.slotError.noTribe')}`,
      t('swatch.issue.invalidField'),
      t('swatch.issue.paletteUnavailable'),
    ]);
  });

  describe('gear rows, only for a host that shows gear (D5)', () => {
    const gearIssues = [
      issue('INCOMPLETE_MODEL', ['HeadGear']),
      issue('INVALID_FIELD', ['HeadGear', 'ModelVariant']),
      issue('INCOMPLETE_MODEL', ['Body']),
      issue('INVALID_FIELD', ['Hands', 'DyeId2']),
      issue('UNSUPPORTED_VALUE', ['Feet', 'DyeId']),
      // A gear slot that is not an object at all: no INCOMPLETE_MODEL follows it (index.js:149).
      issue('INVALID_FIELD', ['LeftRing']),
    ];

    it('names the piece and the problem, one row per piece', () => {
      const rows = charaWarnings(quiet({}, gearIssues), { includeGear: true });
      expect(rows.every((r) => r.tag === t('swatch.warnCheckTag') && !r.severe)).toBe(true);
      expect(rows.map((r) => r.text)).toEqual([
        `${t('swatch.gearSlot.HeadGear')} · ${t('swatch.issue.incompleteModel')}`,
        `${t('swatch.gearSlot.Body')} · ${t('swatch.issue.incompleteModel')}`,
        `${t('swatch.gearSlot.Hands')} · ${t('swatch.issue.invalidDye')}`,
        `${t('swatch.gearSlot.Feet')} · ${t('swatch.issue.invalidDye')}`,
        `${t('swatch.gearSlot.LeftRing')} · ${t('swatch.issue.incompleteModel')}`,
      ]);
    });

    it('shows none of them in the Swatch Matcher', () => {
      expect(charaWarnings(quiet({}, gearIssues), { includeGear: false })).toEqual([]);
    });
  });
});

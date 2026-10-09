/**
 * The `.chara` views' shared text helpers: a count in the locale's plural form
 * (I18N-007) and two sentences joined the way the locale writes them
 * (I18N-012). Real LanguageService (setup.ts initialises it with EN); the
 * plural tests switch locale and spy on `tInterpolate`, so they assert which
 * key was chosen rather than the wording of a translation.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LanguageService } from '@services/index';
import { joinSentences, tCount } from '../chara-ui';

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

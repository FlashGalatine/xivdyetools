/**
 * The preset services report *codes*; these helpers turn a code into text.
 *
 * Two silent failures are what this file exists to catch:
 *   - a code mapped to a key no locale defines — `LanguageService.t()` echoes
 *     the key back, so the toast shows a raw dot-path;
 *   - a code mapped to a key whose placeholder is spelled differently from the
 *     one the helper interpolates (`preset.maxDyesAllowed` uses `{count}`,
 *     every `preset.validation.*` key uses `{n}`), so the toast shows a
 *     literal `{count}`.
 *
 * Both are checked in all six locales, because a key present in `en.json` and
 * missing from `ja.json` fails only for Japanese users.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LanguageService } from '@services/language-service';
import { presetValidationMessage, presetErrorMessage } from '@shared/preset-i18n';
import type { LocaleCode } from '@shared/i18n-types';
import type { PresetErrorCode, PresetValidationCode } from '@services/preset-submission-service';

const LOCALES: LocaleCode[] = ['en', 'de', 'fr', 'ja', 'ko', 'zh'];

/** `t()` returns the key itself when the key is missing — that shape, exactly. */
const LOOKS_LIKE_A_KEY = /^[a-z][A-Za-z]*(\.[A-Za-z]+)+$/;
const UNRESOLVED_PLACEHOLDER = /\{[A-Za-z]+\}/;

/** Every value `preset-submission-service` can put in a `ValidationError`. */
const VALIDATION_CODES: PresetValidationCode[] = [
  'nameMin',
  'nameMax',
  'descMin',
  'descMax',
  'category',
  'dyesMin',
  'dyesMax',
  'dyesInvalid',
  'dyesRange',
  'tagsArray',
  'tagsMax',
  'tagLength',
];

/** The codes that name a bound, and so are always sent with a `limit`. */
const CODES_WITH_LIMIT: PresetValidationCode[] = [
  'nameMin',
  'nameMax',
  'descMin',
  'descMax',
  'dyesMin',
  'dyesMax',
  'tagsMax',
  'tagLength',
];

const ERROR_CODES: PresetErrorCode[] = [
  'notLoggedInSubmit',
  'notLoggedInEdit',
  'validation',
  'submitFailed',
  'editFailed',
  'timeout',
  'network',
  'duplicate',
];

afterAll(async () => {
  await LanguageService.setLocale('en');
});

describe('presetValidationMessage', () => {
  for (const locale of LOCALES) {
    describe(locale, () => {
      beforeAll(async () => {
        await LanguageService.setLocale(locale);
      });

      it('resolves every validation code to real text, not a dot-path', () => {
        for (const code of VALIDATION_CODES) {
          const limit = CODES_WITH_LIMIT.includes(code) ? 7 : undefined;
          const text = presetValidationMessage({ field: 'x', code, limit });
          expect(text, `${code} in ${locale}`).not.toMatch(LOOKS_LIKE_A_KEY);
          expect(text.length).toBeGreaterThan(0);
        }
      });

      it('substitutes the bound, leaving no placeholder behind', () => {
        for (const code of CODES_WITH_LIMIT) {
          const text = presetValidationMessage({ field: 'x', code, limit: 7 });
          expect(text, `${code} in ${locale}`).toContain('7');
          expect(text, `${code} in ${locale}`).not.toMatch(UNRESOLVED_PLACEHOLDER);
        }
      });
    });
  }

  it('reuses the existing dye-cap string, whose placeholder is {count}', () => {
    expect(presetValidationMessage({ field: 'dyes', code: 'dyesMax', limit: 6 })).toBe(
      LanguageService.tInterpolate('preset.maxDyesAllowed', { count: 6 })
    );
  });

  it('routes the developer guards to the generic error rather than inventing copy', () => {
    const generic = LanguageService.t('errors.unexpectedError');
    expect(presetValidationMessage({ field: 'dyes', code: 'dyesRange' })).toBe(generic);
    expect(presetValidationMessage({ field: 'tags', code: 'tagsArray' })).toBe(generic);
  });
});

describe('presetErrorMessage', () => {
  for (const locale of LOCALES) {
    it(`resolves every transport code to real text in ${locale}`, async () => {
      await LanguageService.setLocale(locale);
      for (const code of ERROR_CODES) {
        const text = presetErrorMessage(code, 'errors.submitPresetFailed');
        expect(text, `${code} in ${locale}`).not.toMatch(LOOKS_LIKE_A_KEY);
        expect(text, `${code} in ${locale}`).not.toMatch(UNRESOLVED_PLACEHOLDER);
      }
    });
  }

  it('separates the submit and edit wordings', async () => {
    await LanguageService.setLocale('en');
    expect(presetErrorMessage('submitFailed', 'errors.submitPresetFailed')).toBe(
      LanguageService.t('errors.submitPresetFailed')
    );
    expect(presetErrorMessage('editFailed', 'errors.saveChangesFailed')).toBe(
      LanguageService.t('errors.saveChangesFailed')
    );
    expect(presetErrorMessage('notLoggedInSubmit', 'errors.submitPresetFailed')).toBe(
      LanguageService.t('preset.loginToSubmit')
    );
    expect(presetErrorMessage('notLoggedInEdit', 'errors.saveChangesFailed')).toBe(
      LanguageService.t('preset.loginToEdit')
    );
  });

  it('distinguishes a timeout from a generic network failure', async () => {
    await LanguageService.setLocale('en');
    const timeout = presetErrorMessage('timeout', 'errors.submitPresetFailed');
    const network = presetErrorMessage('network', 'errors.submitPresetFailed');
    expect(timeout).toBe(LanguageService.t('errors.requestTimeout'));
    expect(network).toBe(LanguageService.t('errors.networkError'));
    expect(timeout).not.toBe(network);
  });

  it('falls back to the caller-supplied key when the service reported no code', async () => {
    await LanguageService.setLocale('en');
    expect(presetErrorMessage(undefined, 'errors.saveChangesFailed')).toBe(
      LanguageService.t('errors.saveChangesFailed')
    );
    // `validation` means "read validationErrors"; the caller does that itself.
    expect(presetErrorMessage('validation', 'errors.submitPresetFailed')).toBe(
      LanguageService.t('errors.submitPresetFailed')
    );
  });

  it('names the duplicate generically when the 409 arrived without a name', async () => {
    await LanguageService.setLocale('en');
    expect(presetErrorMessage('duplicate', 'errors.saveChangesFailed')).toBe(
      LanguageService.tInterpolate('preset.duplicateFound', {
        name: LanguageService.t('preset.anotherPreset'),
      })
    );
  });
});

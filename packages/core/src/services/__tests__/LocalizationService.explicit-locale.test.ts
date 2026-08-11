/**
 * Explicit-locale arms of the LocalizationService facade.
 *
 * Every getter is `this.translator.getX(key, locale ?? this.currentLocale)`.
 * The `??` has two arms and only the default one was exercised, which is the
 * risky half to leave dark: BUG-006 introduced the explicit-locale getters
 * precisely so a Worker handling concurrent requests in different languages
 * would stop racing on a shared `setLocale`. If the explicit argument were
 * ever dropped, every request would silently answer in the current locale
 * and the tests would still pass.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalizationService } from '../LocalizationService.js';
import { LocaleRegistry } from '../localization/LocaleRegistry.js';
import { TranslationProvider } from '../localization/TranslationProvider.js';
import type {
  ClanKey,
  GrandCompanyKey,
  JobKey,
  LocaleCode,
  LocaleData,
  RaceKey,
  SheetKey,
  ToolKey,
  VisionType,
} from '@xivdyetools/types';

/** A locale whose every value is suffixed with its code, so a wrong-locale
 *  answer is visible in the assertion rather than merely absent. */
function taggedLocale(locale: LocaleCode): LocaleData {
  const tag = locale.toUpperCase();
  return {
    locale,
    meta: { version: '1.0.0', generated: '2026-01-01T00:00:00.000Z', dyeCount: 125 },
    labels: { dye: `Dye-${tag}` },
    dyeNames: { '5729': `Snow White-${tag}` },
    categories: { Whites: `Whites-${tag}` },
    acquisitions: { 'Dye Vendor': `Dye Vendor-${tag}` },
    currencies: { Gil: `Gil-${tag}` },
    metallicDyeIds: locale === 'ja' ? [13116] : [13117],
    harmonyTypes: { complementary: `Complementary-${tag}` },
    visionTypes: { normal: `Normal Vision-${tag}` },
    visions: { normal: `Normal-${tag}`, deuteranopia: `Deuteranopia-${tag}` },
    tools: { harmony: `Harmony-${tag}` },
    sheets: { eyeColors: `Eye Colors-${tag}` },
    jobNames: { paladin: `Paladin-${tag}` },
    grandCompanyNames: { maelstrom: `Maelstrom-${tag}` },
    races: { hyur: `Hyur-${tag}` },
    clans: { midlander: `Midlander-${tag}` },
  } as unknown as LocaleData;
}

describe('LocalizationService — explicit locale argument', () => {
  let registry: LocaleRegistry;
  let service: LocalizationService;

  beforeEach(() => {
    registry = new LocaleRegistry();
    registry.registerLocale(taggedLocale('en'));
    registry.registerLocale(taggedLocale('ja'));

    service = new LocalizationService({
      registry,
      translator: new TranslationProvider(registry),
    });
  });

  afterEach(() => {
    service.clear();
    LocalizationService.clear();
  });

  it('defaults to the current locale when none is passed', () => {
    expect(service.getCurrency('Gil')).toBe('Gil-EN');
    expect(service.getCategory('Whites')).toBe('Whites-EN');
  });

  it.each([
    ['getCurrency', (s: LocalizationService, l?: LocaleCode) => s.getCurrency('Gil', l), 'Gil'],
    [
      'getCategory',
      (s: LocalizationService, l?: LocaleCode) => s.getCategory('Whites', l),
      'Whites',
    ],
    [
      'getAcquisition',
      (s: LocalizationService, l?: LocaleCode) => s.getAcquisition('Dye Vendor', l),
      'Dye Vendor',
    ],
    [
      'getVisionShort',
      (s: LocalizationService, l?: LocaleCode) =>
        s.getVisionShort('deuteranopia' as VisionType, l),
      'Deuteranopia',
    ],
    [
      'getToolName',
      (s: LocalizationService, l?: LocaleCode) => s.getToolName('harmony' as ToolKey, l),
      'Harmony',
    ],
    [
      'getSheetName',
      (s: LocalizationService, l?: LocaleCode) => s.getSheetName('eyeColors' as SheetKey, l),
      'Eye Colors',
    ],
    [
      'getJobName',
      (s: LocalizationService, l?: LocaleCode) => s.getJobName('paladin' as JobKey, l),
      'Paladin',
    ],
    [
      'getGrandCompanyName',
      (s: LocalizationService, l?: LocaleCode) =>
        s.getGrandCompanyName('maelstrom' as GrandCompanyKey, l),
      'Maelstrom',
    ],
    [
      'getRace',
      (s: LocalizationService, l?: LocaleCode) => s.getRace('hyur' as RaceKey, l),
      'Hyur',
    ],
    [
      'getClan',
      (s: LocalizationService, l?: LocaleCode) => s.getClan('midlander' as ClanKey, l),
      'Midlander',
    ],
  ] as const)('%s honours an explicit locale over the current one', (_name, call, base) => {
    // Current locale is 'en'; asking for 'ja' must not answer in English
    expect(call(service, 'ja')).toBe(`${base}-JA`);
    expect(call(service, 'en')).toBe(`${base}-EN`);
    expect(call(service, undefined)).toBe(`${base}-EN`);
  });

  it('getDyeName honours an explicit locale', () => {
    expect(service.getDyeName(5729, 'ja')).toBe('Snow White-JA');
    expect(service.getDyeName(5729)).toBe('Snow White-EN');
  });

  it('getMetallicDyeIds honours an explicit locale', () => {
    expect(service.getMetallicDyeIds('ja')).toEqual([13116]);
    expect(service.getMetallicDyeIds()).toEqual([13117]);
  });

  it('ensureLocaleLoaded is a no-op for an already-registered locale', async () => {
    // The early-return arm: no loader is configured here, so reaching the
    // load path would throw.
    await expect(service.ensureLocaleLoaded('ja')).resolves.toBeUndefined();
    expect(registry.hasLocale('ja')).toBe(true);
  });
});

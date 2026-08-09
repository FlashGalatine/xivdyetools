/**
 * MetricHelp unit tests — the 6A pair-readout units, bands, and tier colours.
 */

import { describe, it, expect, vi } from 'vitest';
import { PAIR_READOUT_UNITS, tierColor, shiftTierColor, createMetricHelp } from '../metric-help';

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

describe('PAIR_READOUT_UNITS', () => {
  it('pct bands derive from the user threshold', () => {
    expect(PAIR_READOUT_UNITS.pct.bands(30)).toEqual({ good: 60, tight: 60, fail: 30 });
    expect(PAIR_READOUT_UNITS.pct.bands(20)).toEqual({ good: 60, tight: 40, fail: 20 });
  });

  it('ratio bands are the 1.4.11 cuts', () => {
    expect(PAIR_READOUT_UNITS.ratio.bands(30)).toEqual({ good: 7, tight: 4.5, fail: 3 });
  });

  it('de2000 bands are the drawn cuts', () => {
    expect(PAIR_READOUT_UNITS.de2000.bands(30)).toEqual({ good: 35, tight: 20, fail: 10 });
  });

  it('formats per unit', () => {
    expect(PAIR_READOUT_UNITS.pct.format(61.7)).toBe('62%');
    expect(PAIR_READOUT_UNITS.ratio.format(4.5)).toBe('4.50:1');
    expect(PAIR_READOUT_UNITS.de2000.format(13.96)).toBe('ΔE 14.0');
  });

  it('only ratio is a published standard', () => {
    expect(PAIR_READOUT_UNITS.ratio.standard).toBe(true);
    expect(PAIR_READOUT_UNITS.pct.standard).toBe(false);
    expect(PAIR_READOUT_UNITS.de2000.standard).toBe(false);
  });
});

describe('tierColor', () => {
  const bands = { good: 7, tight: 4.5, fail: 3 };

  it('maps values to the dark ramp', () => {
    expect(tierColor(8, bands, true)).toBe('#5bbd68');
    expect(tierColor(5, bands, true)).toBe('#8bc34a');
    expect(tierColor(3.2, bands, true)).toBe('#ffc107');
    expect(tierColor(2, bands, true)).toBe('#f4645a');
  });

  it('maps values to the light ramp', () => {
    expect(tierColor(8, bands, false)).toBe('#137A33');
    expect(tierColor(2, bands, false)).toBe('#B91C1C');
  });
});

describe('shiftTierColor', () => {
  it('uses the 5/10/20/35 shift cuts', () => {
    expect(shiftTierColor(2, true)).toBe('#5bbd68');
    expect(shiftTierColor(7, true)).toBe('#8bc34a');
    expect(shiftTierColor(15, true)).toBe('#ffc107');
    expect(shiftTierColor(25, true)).toBe('#ff9800');
    expect(shiftTierColor(40, true)).toBe('#f4645a');
  });
});

describe('createMetricHelp', () => {
  it('renders the NOT A STANDARD badge for pct but not ratio', () => {
    const pct = createMetricHelp({ unit: 'pct', threshold: 30, dark: true, onUnitChange: vi.fn() });
    expect(pct.textContent).toContain('accessibility.notAStandard');

    const ratio = createMetricHelp({
      unit: 'ratio',
      threshold: 30,
      dark: true,
      onUnitChange: vi.fn(),
    });
    expect(ratio.textContent).not.toContain('accessibility.notAStandard');
  });

  it('links to the W3C page only for ratio', () => {
    const ratio = createMetricHelp({
      unit: 'ratio',
      threshold: 30,
      dark: true,
      onUnitChange: vi.fn(),
    });
    const link = ratio.querySelector('a');
    expect(link?.href).toContain('w3.org/WAI/WCAG21/Understanding/non-text-contrast');

    const de = createMetricHelp({
      unit: 'de2000',
      threshold: 30,
      dark: true,
      onUnitChange: vi.fn(),
    });
    expect(de.querySelector('a')).toBeNull();
  });

  it('switches units through the chip row', () => {
    const onUnitChange = vi.fn();
    const el = createMetricHelp({ unit: 'pct', threshold: 30, dark: true, onUnitChange });
    const chips = el.querySelectorAll('button');
    expect(chips.length).toBe(3);
    // Active chip does not re-fire
    (chips[0] as HTMLButtonElement).click();
    expect(onUnitChange).not.toHaveBeenCalled();
    (chips[1] as HTMLButtonElement).click();
    expect(onUnitChange).toHaveBeenCalledWith('ratio');
  });

  it('renders the four-word tier legend with unit-specific ranges', () => {
    const el = createMetricHelp({
      unit: 'de2000',
      threshold: 30,
      dark: true,
      onUnitChange: vi.fn(),
    });
    expect(el.textContent).toContain('accessibility.tierClear');
    expect(el.textContent).toContain('accessibility.tierCollapsed');
    expect(el.textContent).toContain('35 +');
    expect(el.textContent).toContain('< 10');
  });
});

describe('createMethodHelp (7C methods mode)', () => {
  it('orders the six methods perceptual to not', async () => {
    const { METHOD_ORDER } = await import('../metric-help');
    expect(METHOD_ORDER).toEqual(['ciede2000', 'oklab', 'cie76', 'redmean', 'rgb', 'distinguish']);
  });

  it('renders the kind badge and learn link', async () => {
    const { createMethodHelp } = await import('../metric-help');
    const el = createMethodHelp({ method: 'ciede2000', dark: true, onMethodChange: vi.fn() });
    expect(el.textContent).toContain('comparison.kind2');
    const link = el.querySelector('a');
    expect(link?.href).toContain('wikipedia.org/wiki/Color_difference');
  });

  it('switches methods through the chip row without re-firing the active one', async () => {
    const { createMethodHelp } = await import('../metric-help');
    const onMethodChange = vi.fn();
    const el = createMethodHelp({ method: 'ciede2000', dark: true, onMethodChange });
    const chips = el.querySelectorAll('button');
    expect(chips.length).toBe(6);
    (chips[0] as HTMLButtonElement).click();
    expect(onMethodChange).not.toHaveBeenCalled();
    (chips[1] as HTMLButtonElement).click();
    expect(onMethodChange).toHaveBeenCalledWith('oklab');
  });

  it('shows NOT-PERCEPTUAL kind for rgb and distinguish', async () => {
    const { createMethodHelp } = await import('../metric-help');
    for (const method of ['rgb', 'distinguish'] as const) {
      const el = createMethodHelp({ method, dark: false, onMethodChange: vi.fn() });
      expect(el.textContent).toContain('comparison.kind0');
    }
  });
});

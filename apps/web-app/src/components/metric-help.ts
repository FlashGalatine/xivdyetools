/**
 * XIV Dye Tools 5.0 - MetricHelp (the pair-readout explainer)
 *
 * The inline expander behind the ⓘ beside a pair-readout heading, per the
 * confirmed 6A Lens direction. Carries the active unit's definition, its
 * caveat, the four-word tier legend (same words in every unit; only the
 * numbers under them change), the unit switcher, and — for units without a
 * published standard — the NOT A STANDARD badge. The WCAG ratio entry links
 * to the W3C Understanding page.
 *
 * Shared: Accessibility (6A) owns it first; Comparison (7C) reuses it.
 *
 * @module components/metric-help
 */

import { LanguageService } from '@services/language-service';

// ============================================================================
// Unit definitions (bands per the drawn 6A spec)
// ============================================================================

export type PairReadoutUnit = 'pct' | 'ratio' | 'de2000';

export interface UnitBands {
  good: number;
  tight: number;
  fail: number;
}

interface UnitDef {
  id: PairReadoutUnit;
  /** Locale key stem under accessibility.* */
  stem: string;
  standard: boolean;
  /** Static bands; pct's tight/fail derive from the user threshold at call time */
  bands: (threshold: number) => UnitBands;
  format: (v: number) => string;
  /** Tier-legend number ranges, derived from the bands */
  ranges: (b: UnitBands) => [string, string, string, string];
}

export const PAIR_READOUT_UNITS: Record<PairReadoutUnit, UnitDef> = {
  pct: {
    id: 'pct',
    stem: 'unitPct',
    standard: false,
    bands: (threshold) => ({ good: 60, tight: threshold * 2, fail: threshold }),
    format: (v) => `${Math.round(v)}%`,
    ranges: (b) => [
      `${b.good}% +`,
      `${b.tight}–${b.good - 1}%`,
      `${b.fail}–${b.tight - 1}%`,
      `< ${b.fail}%`,
    ],
  },
  ratio: {
    id: 'ratio',
    stem: 'unitRatio',
    standard: true,
    bands: () => ({ good: 7, tight: 4.5, fail: 3 }),
    format: (v) => `${v.toFixed(2)}:1`,
    ranges: () => ['7:1 +', '4.5–7', '3–4.5', '< 3:1'],
  },
  de2000: {
    id: 'de2000',
    stem: 'unitDe',
    standard: false,
    bands: () => ({ good: 35, tight: 20, fail: 10 }),
    format: (v) => `ΔE ${v.toFixed(1)}`,
    ranges: () => ['35 +', '20–35', '10–20', '< 10'],
  },
};

const LEARN_URL = 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html';

/**
 * Tier colours per the drawn ramps (dark / light theme).
 * Order: good, tight, fail, below.
 */
const TIER_COLORS_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_COLORS_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;

/**
 * Colour for a metric value under a unit's bands (higher = safer).
 */
export function tierColor(value: number, bands: UnitBands, dark: boolean): string {
  const ramp = dark ? TIER_COLORS_DARK : TIER_COLORS_LIGHT;
  if (value >= bands.good) return ramp[0];
  if (value >= bands.tight) return ramp[1];
  if (value >= bands.fail) return ramp[2];
  return ramp[3];
}

/**
 * Colour for a ΔE *shift* (lens-introduced change; lower = safer).
 * Cuts per the drawn `etier`: 5 / 10 / 20 / 35.
 */
export function shiftTierColor(deltaE: number, dark: boolean): string {
  const ramp = dark ? TIER_COLORS_DARK : TIER_COLORS_LIGHT;
  if (deltaE < 5) return ramp[0];
  if (deltaE < 10) return ramp[1];
  if (deltaE < 20) return ramp[2];
  return deltaE < 35 ? (dark ? '#ff9800' : '#C2410C') : ramp[3];
}

// ============================================================================
// Builder
// ============================================================================

export interface MetricHelpOptions {
  unit: PairReadoutUnit;
  /** The user's MATCH threshold (feeds pct's bands) */
  threshold: number;
  dark: boolean;
  /** Called when the user picks another unit from the switcher */
  onUnitChange: (unit: PairReadoutUnit) => void;
}

/**
 * Build the MetricHelp expander body for the active unit.
 * The caller owns visibility (the ⓘ toggles it).
 */
export function createMetricHelp(options: MetricHelpOptions): HTMLElement {
  const t = (key: string): string => LanguageService.t(`accessibility.${key}`);
  const def = PAIR_READOUT_UNITS[options.unit];
  const bands = def.bands(options.threshold);

  // Inline styles throughout: this renders inside the v4 shell's shadow
  // DOM, where document-level Tailwind utilities do not reach
  const box = document.createElement('div');
  box.style.cssText =
    'display: flex; flex-direction: column; gap: 10px; padding: 12px; margin-bottom: 12px; border-radius: 12px; border: 1px solid var(--theme-border); background: var(--theme-card-background);';

  // Title row: unit label + NOT A STANDARD badge (or nothing for ratio)
  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';
  const title = document.createElement('span');
  title.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--theme-text);';
  title.textContent = t(`${def.stem}Label`);
  titleRow.appendChild(title);
  if (!def.standard) {
    const badge = document.createElement('span');
    badge.style.cssText =
      "font-family: 'Fragment Mono', monospace; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; padding: 2px 6px; border-radius: 5px; border: 1px solid var(--theme-border); color: var(--theme-text-muted);";
    badge.textContent = t('notAStandard');
    titleRow.appendChild(badge);
  }
  box.appendChild(titleRow);

  // Definition + caveat
  const desc = document.createElement('p');
  desc.style.cssText = 'font-size: 12px; line-height: 1.55; margin: 0; color: var(--theme-text-muted);';
  desc.textContent = t(`${def.stem}Desc`);
  box.appendChild(desc);

  const caveat = document.createElement('p');
  caveat.style.cssText = 'font-size: 12px; line-height: 1.55; margin: 0; color: var(--theme-text-muted);';
  caveat.textContent = t(`${def.stem}Caveat`);
  box.appendChild(caveat);

  // Tier legend: same four words in every unit, numbers change
  const legend = document.createElement('div');
  legend.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;';
  const tierKeys = ['tierClear', 'tierFine', 'tierTight', 'tierCollapsed'] as const;
  const ranges = def.ranges(bands);
  const ramp = options.dark ? TIER_COLORS_DARK : TIER_COLORS_LIGHT;
  tierKeys.forEach((key, i) => {
    const cell = document.createElement('div');
    cell.style.cssText =
      'display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 0; border-radius: 8px; background: var(--theme-background-secondary);';
    const bar = document.createElement('span');
    bar.style.cssText = `display: block; border-radius: 2px; width: 70%; height: 4px; background: ${ramp[i]};`;
    cell.appendChild(bar);
    const word = document.createElement('span');
    word.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--theme-text);';
    word.textContent = t(key);
    cell.appendChild(word);
    const range = document.createElement('span');
    range.style.cssText =
      "font-family: 'Fragment Mono', monospace; font-size: 10px; color: var(--theme-text-muted);";
    range.textContent = ranges[i];
    cell.appendChild(range);
    legend.appendChild(cell);
  });
  box.appendChild(legend);

  // Unit switcher
  const switcher = document.createElement('div');
  switcher.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
  (Object.keys(PAIR_READOUT_UNITS) as PairReadoutUnit[]).forEach((id) => {
    const u = PAIR_READOUT_UNITS[id];
    const active = id === options.unit;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.style.cssText = `padding: 6px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 600; cursor: pointer; border: 1px solid ${active ? 'var(--theme-primary)' : 'var(--theme-border)'}; background: ${active ? 'var(--theme-primary)' : 'var(--theme-card-background)'}; color: ${active ? 'var(--theme-text-header)' : 'var(--theme-text)'};`;
    chip.textContent = t(`${u.stem}Short`);
    chip.setAttribute('aria-pressed', String(active));
    chip.addEventListener('click', () => {
      if (!active) options.onUnitChange(id);
    });
    switcher.appendChild(chip);
  });
  box.appendChild(switcher);

  // Learn-more link (ratio — the only unit with a published standard)
  if (options.unit === 'ratio') {
    const link = document.createElement('a');
    link.style.cssText = 'font-size: 12px; color: var(--theme-primary); text-decoration: underline;';
    link.href = LEARN_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = t('learnMore');
    box.appendChild(link);
  }

  return box;
}

/**
 * Accessibility Command — Business Logic (13D/13E/13H)
 *
 * The `vision:` option chooses the frame; nothing picks it for the user:
 * a named lens renders 13D, vision:all renders 13E, a single dye renders
 * 13H. Achromatopsia is a full member of the choice list — on the classic
 * red/green pair it is the only lens that finds a problem.
 *
 * Simulation is the shipped Brettel path (ColorService), separation is
 * ΔE2000 between the two SIMULATED colours, and separation bands run the
 * other way from match bands: larger is safer.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/accessibility
 */

import type { Dye, VisionType as CoreVisionType } from '@xivdyetools/types';
import { ColorService } from '@xivdyetools/core';
import { createTranslator, type LocaleCode, type Translator } from '../i18n/index.js';
import { generateA11yCard, type A11yLensRow, type VisionType } from '@xivdyetools/svg';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

/** @internal Reference constant — not required by external consumers. */
export const VISION_TYPES: VisionType[] = [
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
];

// DEAD-037 (Wave 4a): bidirectional compile-time check that svg's 4-lens
// `VisionType` (this list's element type — the simulated colourblind lenses,
// no baseline) covers exactly @xivdyetools/types' `VisionType` union minus
// its 'normal' baseline member. Errors if either union gains or drops a lens
// the other doesn't know about.
type AssertVisionTypesCoverExactly =
  VisionType extends Exclude<CoreVisionType, 'normal'>
    ? Exclude<CoreVisionType, 'normal'> extends VisionType
      ? true
      : never
    : never;
const _assertVisionTypesCoverExactly: AssertVisionTypesCoverExactly = true;
void _assertVisionTypesCoverExactly;

/** Untranslated lens codes — identifiers, never localized (like HEX/RGB). */
const LENS_SHORT: Record<'normal' | VisionType, string> = {
  normal: 'NORM',
  protanopia: 'PROT',
  deuteranopia: 'DEUT',
  tritanopia: 'TRIT',
  achromatopsia: 'ACHR',
};

export interface AccessibilityDye {
  dye?: Dye;
  hex: string;
  name: string;
  /** FFXIV item ID for localization (optional — hex inputs won't have this) */
  itemID?: number | null;
}

export interface AccessibilityInput {
  /** 1 dye → 13H solo; 2 dyes → the pair frames */
  dyes: AccessibilityDye[];
  /**
   * The router: a named lens → 13D, 'all' (or absent) → 13E.
   * Ignored for a single dye (13H always shows every lens).
   */
  vision?: VisionType | 'all';
  locale: LocaleCode;
  /** Card theme (stored user preference; defaults dark) */
  theme?: 'dark' | 'light';
  /** The command the user actually typed ('/ACCESSIBILITY' or '/A11Y') */
  commandLabel?: string;
}

export type AccessibilityResult =
  | {
      ok: true;
      svgString: string;
      mode: 'lens' | 'all' | 'solo';
      embed: EmbedData;
    }
  | { ok: false; error: 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================

function lensLabel(lens: 'normal' | VisionType, t: Translator): string {
  return lens === 'normal' ? t.t('accessibility.normalVision') : t.t(`accessibility.${lens}`);
}

/** Pair separation under a lens: ΔE2000 between the two SIMULATED colours. */
function pairRow(
  lens: 'normal' | VisionType,
  hexA: string,
  hexB: string,
  t: Translator,
): A11yLensRow {
  const simA = lens === 'normal' ? hexA : ColorService.simulateColorblindnessHex(hexA, lens);
  const simB = lens === 'normal' ? hexB : ColorService.simulateColorblindnessHex(hexB, lens);
  return {
    label: lensLabel(lens, t),
    short: LENS_SHORT[lens],
    deltaE: ColorService.getDistanceForMethod(simA, simB, 'ciede2000'),
    isNormal: lens === 'normal',
    hexA: simA,
    hexB: simB,
  };
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates the accessibility card (13D/13E/13H) and a one-line embed
 * carrying the verdict sentence — the numbers alone would mislead, and the
 * sentence costs a lens row inside the frame, so it lives here.
 */
export async function executeAccessibility(
  input: AccessibilityInput,
): Promise<AccessibilityResult> {
  const { dyes, locale, vision, theme, commandLabel } = input;
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    const localized = dyes.map((d) =>
      d.itemID ? getLocalizedDyeName(d.itemID, d.name, locale) : d.name,
    );

    const labels = {
      designed: t.t('card.designed'),
      perceived: t.t('card.perceived'),
      separation: t.t('card.separationCol'),
      normalShort: LENS_SHORT.normal,
      lens: t.t('card.lensCol'),
      shift: t.t('card.shiftCol'),
      sepBandKey: t.t('card.sepBandKey'),
      soloKey: t.t('card.soloKey'),
      worstNote: '',
    };

    // ---- 13H: a single dye — every lens, a shift with no verdict
    if (dyes.length === 1) {
      const d = dyes[0];
      const rows: A11yLensRow[] = (['normal', ...VISION_TYPES] as const).map((lens) => ({
        label: lensLabel(lens, t),
        short: LENS_SHORT[lens],
        deltaE:
          lens === 'normal'
            ? 0
            : ColorService.getDistanceForMethod(
                d.hex,
                ColorService.simulateColorblindnessHex(d.hex, lens),
                'ciede2000',
              ),
        isNormal: lens === 'normal',
        hexA: lens === 'normal' ? d.hex : ColorService.simulateColorblindnessHex(d.hex, lens),
      }));

      const svgString = generateA11yCard({
        mode: 'solo',
        titleText: localized[0],
        rows,
        labels,
        lang: locale,
        theme,
        commandLabel,
      });

      const embed: EmbedData = {
        title: localized[0],
        description: d.hex.toUpperCase(),
        color: parseInt(d.hex.replace('#', ''), 16),
      };
      return { ok: true, svgString, mode: 'solo', embed };
    }

    // ---- Pair frames: separation per lens
    const [a, b] = dyes;
    const pairTitle = `${localized[0]} ↔ ${localized[1]}`;
    const allRows = (['normal', ...VISION_TYPES] as const).map((lens) =>
      pairRow(lens, a.hex, b.hex, t),
    );
    const lensOnly = allRows.filter((r) => !r.isNormal);
    const worst = lensOnly.reduce((x, y) => (y.deltaE < x.deltaE ? y : x));
    const verdict = t.t('card.a11yVerdict', {
      lens: worst.label,
      de: worst.deltaE.toFixed(1),
    });

    if (vision && vision !== 'all') {
      // 13D: the named lens is the subject; the rest stay as the strip
      const subject = allRows.find((r) => r.short === LENS_SHORT[vision])!;
      const svgString = generateA11yCard({
        mode: 'lens',
        titleText: pairTitle,
        subject,
        normalDeltaE: allRows[0].deltaE,
        rows: allRows.filter((r) => r !== subject),
        labels,
        lang: locale,
        theme,
        commandLabel,
      });
      const embed: EmbedData = {
        title: pairTitle,
        description: verdict,
        color: parseInt(a.hex.replace('#', ''), 16),
      };
      return { ok: true, svgString, mode: 'lens', embed };
    }

    // 13E: every lens, one row each — the normal row is the control
    const svgString = generateA11yCard({
      mode: 'all',
      titleText: pairTitle,
      rows: allRows,
      labels: { ...labels, worstNote: t.t('card.worstNote', { lens: worst.label }) },
      lang: locale,
      theme,
      commandLabel,
    });
    const embed: EmbedData = {
      title: pairTitle,
      description: verdict,
      color: parseInt(a.hex.replace('#', ''), 16),
    };
    return { ok: true, svgString, mode: 'all', embed };
  } catch {
    return {
      ok: false,
      error: 'GENERATION_FAILED',
      errorMessage: t.t('errors.generationFailed'),
    };
  }
}

export type { VisionType };

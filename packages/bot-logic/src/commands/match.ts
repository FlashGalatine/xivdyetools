/**
 * Match Command — Business Logic
 *
 * Finds the closest FFXIV dye(s) to a given color input.
 * No SVG is generated — response is text-based embed data.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 * The adapter is responsible for building copy buttons (Discord-specific).
 *
 * @module commands/match
 */

import { ColorService, type Dye } from '@xivdyetools/core';
import { createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { dyeService, resolveColorInput } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import { getColorDistance, getMatchQualityInfo } from '../color-math.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface MatchInput {
  /** Raw color input (hex or dye name) */
  colorInput: string;
  /** Number of closest dyes to find (1-10, default: 1) */
  count?: number;
  locale: LocaleCode;
}

export interface MatchEntry {
  dye: Dye;
  distance: number;
}

export type MatchResult =
  | {
      ok: true;
      targetHex: string;
      /** The dye the user entered (if input was a dye name) */
      fromDye?: Dye;
      matches: MatchEntry[];
      embed: EmbedData;
    }
  | { ok: false; error: 'INVALID_INPUT' | 'NO_MATCHES'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================

function getMatchQuality(distance: number, t: ReturnType<typeof createTranslator>): { emoji: string; label: string } {
  const qi = getMatchQualityInfo(distance);
  return { emoji: qi.emoji, label: t.t(`quality.${qi.key}`) };
}

function formatRgb(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function formatHsv(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
  return `${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`;
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Finds the closest FFXIV dye(s) to the given color input.
 *
 * For single-match: embed includes fields (inputColor, closestDye, matchQuality).
 * For multi-match: embed includes description with ranked list.
 *
 * The adapter adds Discord copy buttons using match[0].dye's hex/rgb/hsv.
 */
export async function executeMatch(input: MatchInput): Promise<MatchResult> {
  const { colorInput, locale } = input;
  const matchCount = Math.min(Math.max(input.count ?? 1, 1), 10);
  const t = createTranslator(locale);

  await initializeLocale(locale);

  // Resolve color input
  const resolved = resolveColorInput(colorInput, { excludeFacewear: true });
  if (!resolved) {
    return { ok: false, error: 'INVALID_INPUT', errorMessage: `Could not resolve color: ${colorInput}` };
  }

  const targetHex = resolved.hex;
  const fromDye = resolved.dye;

  // Find closest dye(s), excluding Facewear
  const matches: MatchEntry[] = [];
  const excludeIds: number[] = [];

  for (let i = 0; i < matchCount; i++) {
    let closestDye: Dye | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = dyeService.findClosestDye(targetHex, excludeIds);
      if (!candidate) break;
      if (candidate.category !== 'Facewear') {
        closestDye = candidate;
        break;
      }
      excludeIds.push(candidate.id);
    }

    if (closestDye) {
      const distance = getColorDistance(targetHex, closestDye.hex);
      matches.push({ dye: closestDye, distance });
      excludeIds.push(closestDye.id);
    }
  }

  if (matches.length === 0) {
    return { ok: false, error: 'NO_MATCHES', errorMessage: 'No matching dyes found.' };
  }

  let embed: EmbedData;

  if (matchCount === 1) {
    const { dye, distance } = matches[0];
    const quality = getMatchQuality(distance, t);
    const localizedDyeName = getLocalizedDyeName(dye.itemID, dye.name, locale);

    // Input color description
    let inputDesc = `**Hex:** \`${targetHex.toUpperCase()}\`\n`;
    inputDesc += `**${t.t('common.rgb')}:** \`${formatRgb(targetHex)}\`\n`;
    inputDesc += `**${t.t('common.hsv')}:** \`${formatHsv(targetHex)}\``;
    if (fromDye) {
      const fromDyeName = getLocalizedDyeName(fromDye.itemID, fromDye.name, locale);
      inputDesc = `**${fromDyeName}**\n${inputDesc}`;
    }

    // Match description
    let matchDesc = `**${localizedDyeName}**\n`;
    matchDesc += `**Hex:** \`${dye.hex.toUpperCase()}\`\n`;
    matchDesc += `**${t.t('common.rgb')}:** \`${formatRgb(dye.hex)}\`\n`;
    matchDesc += `**${t.t('common.hsv')}:** \`${formatHsv(dye.hex)}\`\n`;
    matchDesc += `**${t.t('common.category')}:** ${dye.category}`;

    embed = {
      title: `${quality.emoji} ${t.t('match.title', { name: localizedDyeName })}`,
      fields: [
        { name: `🎨 ${t.t('common.inputColor')}`, value: inputDesc, inline: true },
        { name: `🧪 ${t.t('common.closestDye')}`, value: matchDesc, inline: true },
        {
          name: `📊 ${t.t('common.matchQuality')}`,
          value: `**${t.t('common.distance')}:** ${distance.toFixed(2)}\n**${t.t('common.quality')}:** ${quality.label}`,
          inline: true,
        },
      ],
      color: parseInt(dye.hex.replace('#', ''), 16),
      footer: `${t.t('common.footer')} • ${t.t('match.useInfoHint')}`,
    };
  } else {
    const fromDyeName = fromDye ? getLocalizedDyeName(fromDye.itemID, fromDye.name, locale) : null;
    const inputText = fromDyeName
      ? `**${fromDyeName}** (\`${targetHex.toUpperCase()}\`)`
      : `\`${targetHex.toUpperCase()}\``;

    const matchLines = matches.map((match, i) => {
      const quality = getMatchQuality(match.distance, t);
      const localizedName = getLocalizedDyeName(match.dye.itemID, match.dye.name, locale);
      return `**${i + 1}.** **${localizedName}** • \`${match.dye.hex.toUpperCase()}\` • ${quality.emoji} ${quality.label} (Δ ${match.distance.toFixed(1)})`;
    }).join('\n');

    embed = {
      title: `🎨 ${t.t('match.topMatches', { count: matches.length })}`,
      description: `${t.t('match.findingMatches', { input: inputText })}\n\n${matchLines}`,
      color: parseInt(matches[0].dye.hex.replace('#', ''), 16),
      footer: `${t.t('common.footer')} • ${t.t('match.useInfoNameHint')}`,
    };
  }

  return { ok: true, targetHex, fromDye, matches, embed };
}

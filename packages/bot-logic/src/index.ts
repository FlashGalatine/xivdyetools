/**
 * @xivdyetools/bot-logic
 *
 * Platform-agnostic command business logic for the XIV Dye Tools Discord bot.
 * Each execute function takes a typed input and returns a discriminated union result.
 *
 * Usage:
 *   import { executeHarmony, resolveColorInput, initializeLocale } from '@xivdyetools/bot-logic';
 *
 * @module bot-logic
 */

// Foundation: CSS color name resolution
export { resolveCssColorName } from './css-colors.js';

// Foundation: Color input resolution (hex, dye name, CSS color)
export {
  isValidHex,
  normalizeHex,
  resolveColorInput,
  resolveDyeInput,
  dyeService,
} from './input-resolution.js';
export type { ResolvedColor, ResolveColorOptions } from './input-resolution.js';

// Foundation: Core dye name / category localization
export {
  initializeLocale,
  getLocalizedDyeName,
  getLocalizedCategory,
} from './localization.js';
export type { LocaleCode } from './localization.js';

// Shared result types
export type { EmbedData, EmbedField } from './commands/types.js';

// Shared color math utilities (REFACTOR-001, REFACTOR-002)
export { getColorDistance, getMatchQualityInfo } from './color-math.js';
export type { MatchQualityInfo } from './color-math.js';

// Command: Harmony wheel
export { executeHarmony, getHarmonyTypeChoices, HARMONY_TYPES } from './commands/harmony.js';
export type {
  HarmonyInput,
  HarmonyResult,
  HarmonyType,
  HarmonyColorSpace,
} from './commands/harmony.js';

// Command: Dye info card
export { executeDyeInfo } from './commands/dye-info.js';
export type { DyeInfoInput, DyeInfoResult } from './commands/dye-info.js';

// Command: Random dyes grid
export { executeRandom } from './commands/dye-info.js';
export type { RandomInput, RandomResult } from './commands/dye-info.js';

// Command: Dye blending (mixer)
export { executeMixer } from './commands/mixer.js';
export type {
  MixerInput,
  MixerResult,
  MixerMatch,
  BlendingMode,
} from './commands/mixer.js';

// Command: Color gradient
export { executeGradient } from './commands/gradient.js';
export type {
  GradientInput,
  GradientResult,
  GradientStepResult,
  InterpolationMode,
  MatchingMethod,
} from './commands/gradient.js';

// Command: Color match
export { executeMatch } from './commands/match.js';
export type { MatchInput, MatchResult, MatchEntry } from './commands/match.js';

// Command: Dye comparison grid
export { executeComparison } from './commands/comparison.js';
export type { ComparisonInput, ComparisonResult } from './commands/comparison.js';

// Command: Accessibility (colorblind simulation + contrast matrix)
export { executeAccessibility, VISION_TYPES } from './commands/accessibility.js';
export type {
  AccessibilityInput,
  AccessibilityResult,
  AccessibilityDye,
  VisionType,
} from './commands/accessibility.js';

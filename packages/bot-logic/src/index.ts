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

// @xivdyetools/bot-logic — public barrel.
//
// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.

// Foundation: Color input resolution (hex, dye name, CSS color)
export {
  /** @public */
  isValidHex,
  /** @public */
  normalizeHex,
  resolveColorInput,
  resolveDyeInput,
  searchDyesByName,
  findDyeByName,
  dyeService,
} from './input-resolution.js';
export type { ResolvedColor, /** @public */ ResolveColorOptions } from './input-resolution.js';

// Foundation: Core dye name / category localization
export {
  initializeLocale,
  getLocalizedDyeName,
  getLocalizedCategory,
  getLocalizedAcquisition,
  /** @public */
  getLocalizedCurrency,
} from './localization.js';
export type { /** @public */ LocaleCode } from './localization.js';

// Shared result types
export type { /** @public */ EmbedData, /** @public */ EmbedField } from './commands/types.js';

// Command: Harmony wheel
export {
  executeHarmony,
  /** @public */ getHarmonyTypeChoices,
  /** @public */ HARMONY_TYPES,
} from './commands/harmony.js';
export type {
  /** @public */ HarmonyInput,
  /** @public */ HarmonyResult,
  HarmonyType,
} from './commands/harmony.js';

// Command: Dye info card
export { executeDyeInfo } from './commands/dye-info.js';
export type {
  /** @public */ DyeInfoInput,
  /** @public */ DyeInfoResult,
} from './commands/dye-info.js';

// Command: Random dyes grid
export { executeRandom } from './commands/dye-info.js';
export type {
  /** @public */ RandomInput,
  /** @public */ RandomResult,
} from './commands/dye-info.js';

// Command: Dye blending (mixer)
export { executeMixer } from './commands/mixer.js';
export type { /** @public */ MixerInput, /** @public */ MixerResult } from './commands/mixer.js';

// Command: Color gradient
export { executeGradient } from './commands/gradient.js';
export type {
  /** @public */
  GradientInput,
  /** @public */
  GradientResult,
  /** @public */
  GradientStepResult,
  InterpolationMode,
} from './commands/gradient.js';

// Command: Dye comparison grid
export { executeComparison } from './commands/comparison.js';
export type {
  /** @public */ ComparisonInput,
  /** @public */ ComparisonResult,
} from './commands/comparison.js';

// Command: Accessibility (13D/13E/13H — the vision: option routes the frame)
export { executeAccessibility, /** @public */ VISION_TYPES } from './commands/accessibility.js';
export type {
  /** @public */
  AccessibilityInput,
  /** @public */
  AccessibilityResult,
  AccessibilityDye,
  VisionType,
} from './commands/accessibility.js';

// Command: Swatch (character-file frame — measuredRow consumer #5)
export { executeSwatch } from './commands/swatch.js';
export type {
  SwatchInput,
  /** @public */ SwatchResult,
  /** @public */ SwatchCharacter,
  SwatchSlotOption,
} from './commands/swatch.js';

// Command: Contrast (13A/13B/13C·1 — the pair count routes the frame)
export { executeContrast } from './commands/contrast.js';
export type {
  /** @public */ ContrastInput,
  /** @public */ ContrastResult,
  ContrastDyeInput,
} from './commands/contrast.js';

// BUG-073/REFACTOR-010 (2026-07-18 audit): single MODERATOR_IDS grammar for both bot workers
export {
  parseModeratorIds,
  isModeratorId,
  /** @public */ isValidDiscordSnowflake,
} from './moderators.js';

// FINDING-019 (2026-08-21 security audit): one sanitiser for every user-sourced
// string that lands in a bot-authored Discord message/embed (both bots)
export {
  /** @public */ escapeDiscordMarkdown,
  /** @public */ sanitizeEmbedText,
  /** @public */ ALLOWED_MENTIONS_NONE,
} from './discord-markdown.js';

/**
 * Color Utility Functions — Re-export shim
 *
 * All color resolution logic lives in @xivdyetools/bot-logic.
 * This file is kept so existing imports within discord-worker continue to work.
 */
export {
  isValidHex,
  normalizeHex,
  resolveColorInput,
  resolveDyeInput,
  dyeService,
} from '@xivdyetools/bot-logic';
export type { ResolvedColor, ResolveColorOptions } from '@xivdyetools/bot-logic';

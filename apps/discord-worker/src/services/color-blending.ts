/**
 * Color Blending — Discord Worker re-export
 *
 * All blending logic lives in @xivdyetools/color-blending.
 * This file is kept so existing imports within discord-worker continue to work.
 */

export type { RGB, LAB, HSL, BlendResult, BlendingMode } from '@xivdyetools/color-blending';
export {
  BLENDING_MODES,
  isValidBlendingMode,
  blendColors,
  getBlendingModeDescription,
  rgbToLab,
} from '@xivdyetools/color-blending';

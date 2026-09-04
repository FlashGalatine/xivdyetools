export type {
  /** @public */ RGB,
  /** @public */ LAB,
  /** @public */ HSL,
  /** @public */ RYB,
  /** @public */ BlendResult,
  /** @public */ BlendOptions,
  /** @public */ HueMethod,
  BlendingMode,
} from './types.js';
export { BLENDING_MODES, isValidBlendingMode } from './types.js';
export { blendColors } from './blending.js';

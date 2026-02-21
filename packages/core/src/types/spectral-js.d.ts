/**
 * Type declarations for spectral.js
 *
 * spectral.js provides Kubelka-Munk theory-based color mixing.
 * This module has no official type definitions.
 */
declare module 'spectral.js' {
  /** A spectral color representation */
  export class Color {
    constructor(hex: string);
    toString(options?: { format?: string; method?: string }): string;
  }

  /** Mix colors using Kubelka-Munk theory */
  export function mix(
    ...colorPairs: Array<[Color, number]>
  ): Color;
}

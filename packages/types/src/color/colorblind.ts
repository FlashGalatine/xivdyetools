/**
 * @xivdyetools/types - Colorblindness Types
 *
 * Types for colorblindness simulation and accessibility checking.
 *
 * @module color/colorblind
 */

/**
 * Vision types supported by accessibility checker
 *
 * - `normal`: Standard color vision
 * - `deuteranopia`: Red-green colorblindness (green cone deficiency)
 * - `protanopia`: Red-green colorblindness (red cone deficiency)
 * - `tritanopia`: Blue-yellow colorblindness (blue cone deficiency)
 * - `achromatopsia`: Complete colorblindness (monochromacy)
 */
export type VisionType =
  | 'normal'
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'
  | 'achromatopsia';

/**
 * 3x3 transformation matrix for colorblindness simulation
 *
 * Used for RGB to RGB transformation using matrix multiplication.
 * [row][column] indexing: result[r] = matrix[0] * input, etc.
 */
export type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

/**
 * Colorblindness transformation matrices (Brettel 1997)
 *
 * These matrices simulate how colors appear to people with different
 * types of color vision deficiency.
 */
export interface ColorblindMatrices {
  /** Matrix for deuteranopia simulation */
  deuteranopia: Matrix3x3;
  /** Matrix for protanopia simulation */
  protanopia: Matrix3x3;
  /** Matrix for tritanopia simulation */
  tritanopia: Matrix3x3;
  /** Matrix for achromatopsia simulation */
  achromatopsia: Matrix3x3;
}

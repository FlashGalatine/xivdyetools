/**
 * Color Service - Wraps xivdyetools-core color operations
 */

import { ColorService, isValidHexColor } from '@xivdyetools/core'
import type { RGB, HSV } from '@/types'

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
  return ColorService.hexToRgb(hex)
}

/**
 * Convert hex color to HSV
 */
export function hexToHsv(hex: string): HSV {
  return ColorService.hexToHsv(hex)
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return ColorService.rgbToHex(r, g, b)
}

/**
 * Validate hex color format
 */
export function validateHexColor(hex: string): boolean {
  return isValidHexColor(hex)
}

/**
 * Normalize hex color (ensure # prefix and uppercase)
 */
export function normalizeHex(hex: string): string {
  if (!hex) return ''

  // Add # if missing
  let normalized = hex.startsWith('#') ? hex : `#${hex}`

  // Convert 3-digit to 6-digit
  if (normalized.length === 4) {
    const r = normalized[1]
    const g = normalized[2]
    const b = normalized[3]
    normalized = `#${r}${r}${g}${g}${b}${b}`
  }

  return normalized.toLowerCase()
}

export { isValidHexColor }

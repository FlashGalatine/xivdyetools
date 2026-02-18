/**
 * Color Converter
 * Per R-4: Focused class for color format conversions
 * Handles conversions between hex, RGB, and HSV color formats
 */

import type { RGB, HSV, HexColor, LAB, OKLAB, OKLCH, LCH, HSL } from '../../types/index.js';
import { createHexColor } from '../../types/index.js';
import { ErrorCode, AppError } from '../../types/index.js';

/**
 * DeltaE formula for color difference calculations
 * - cie76: Simple Euclidean distance in LAB space (fast)
 * - cie2000: CIEDE2000 formula (perceptually accurate, industry standard)
 * - oklab: OKLAB Euclidean distance (modern, simpler than cie2000, CSS standard)
 * - hyab: HyAB hybrid distance (best for large color differences/palette matching)
 */
export type DeltaEFormula = 'cie76' | 'cie2000' | 'oklab' | 'hyab';
import { RGB_MIN, RGB_MAX, HUE_MAX } from '../../constants/index.js';
import {
  clamp,
  round,
  isValidHexColor,
  isValidRGB,
  isValidHSV,
  LRUCache,
} from '../../utils/index.js';

/**
 * Configuration for ColorConverter caches
 */
export interface ColorConverterConfig {
  cacheSize?: number;
}

/**
 * Color format converter with LRU caching
 * Per R-4: Single Responsibility - format conversions only
 *
 * Refactored for testability: Supports dependency injection of cache configuration
 */
export class ColorConverter {
  // Instance caches (injectable for testing)
  private readonly hexToRgbCache: LRUCache<string, RGB>;
  private readonly rgbToHexCache: LRUCache<string, HexColor>;
  private readonly rgbToHsvCache: LRUCache<string, HSV>;
  private readonly hsvToRgbCache: LRUCache<string, RGB>;
  private readonly hexToHsvCache: LRUCache<string, HSV>;
  private readonly rgbToLabCache: LRUCache<string, LAB>;

  // Default singleton instance for static API compatibility
  // Per Issue #6: Eager initialization to avoid race conditions in concurrent scenarios
  private static defaultInstance: ColorConverter = new ColorConverter();

  /**
   * Constructor with optional cache configuration
   * @param config Configuration for cache sizes (default: 1000 entries per cache)
   */
  constructor(config: ColorConverterConfig = {}) {
    const cacheSize = config.cacheSize ?? 1000;
    this.hexToRgbCache = new LRUCache<string, RGB>(cacheSize);
    this.rgbToHexCache = new LRUCache<string, HexColor>(cacheSize);
    this.rgbToHsvCache = new LRUCache<string, HSV>(cacheSize);
    this.hsvToRgbCache = new LRUCache<string, RGB>(cacheSize);
    this.hexToHsvCache = new LRUCache<string, HSV>(cacheSize);
    this.rgbToLabCache = new LRUCache<string, LAB>(cacheSize);
  }

  /**
   * Get the default singleton instance
   * Per Issue #6: Returns eagerly-initialized instance to avoid race conditions
   */
  private static getDefault(): ColorConverter {
    return this.defaultInstance;
  }

  /**
   * Clear all caches (useful for testing or memory management)
   */
  clearCaches(): void {
    this.hexToRgbCache.clear();
    this.rgbToHexCache.clear();
    this.rgbToHsvCache.clear();
    this.hsvToRgbCache.clear();
    this.hexToHsvCache.clear();
    this.rgbToLabCache.clear();
  }

  /**
   * Static method: Clear all caches of the default instance
   */
  static clearCaches(): void {
    this.getDefault().clearCaches();
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getCacheStats(): {
    hexToRgb: number;
    rgbToHex: number;
    rgbToHsv: number;
    hsvToRgb: number;
    hexToHsv: number;
    rgbToLab: number;
  } {
    return {
      hexToRgb: this.hexToRgbCache.size,
      rgbToHex: this.rgbToHexCache.size,
      rgbToHsv: this.rgbToHsvCache.size,
      hsvToRgb: this.hsvToRgbCache.size,
      hexToHsv: this.hexToHsvCache.size,
      rgbToLab: this.rgbToLabCache.size,
    };
  }

  /**
   * Static method: Get cache statistics from default instance
   */
  static getCacheStats(): {
    hexToRgb: number;
    rgbToHex: number;
    rgbToHsv: number;
    hsvToRgb: number;
    hexToHsv: number;
    rgbToLab: number;
  } {
    return this.getDefault().getCacheStats();
  }

  /**
   * Convert hexadecimal color to RGB
   * Per P-1: Cached for performance
   * @example hexToRgb("#FF0000") -> { r: 255, g: 0, b: 0 }
   */
  hexToRgb(hex: string): RGB {
    if (!isValidHexColor(hex)) {
      throw new AppError(
        ErrorCode.INVALID_HEX_COLOR,
        `Invalid hex color: ${hex}. Use format #RRGGBB or #RGB`,
        'error'
      );
    }

    // Normalize hex for cache key
    let hexForCache = hex.toUpperCase().replace('#', '');
    if (hexForCache.length === 3) {
      hexForCache = hexForCache
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const cacheKey = hexForCache;

    // Check cache
    const cached = this.hexToRgbCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Remove # and expand shorthand (#RGB -> #RRGGBB)
    let normalizedHex = hex.replace('#', '');
    if (normalizedHex.length === 3) {
      normalizedHex = normalizedHex
        .split('')
        .map((char) => char + char)
        .join('');
    }

    const r = parseInt(normalizedHex.substring(0, 2), 16);
    const g = parseInt(normalizedHex.substring(2, 4), 16);
    const b = parseInt(normalizedHex.substring(4, 6), 16);

    const result = { r, g, b };
    // Cache result
    this.hexToRgbCache.set(cacheKey, result);
    return result;
  }

  /**
   * Static method: Convert hex to RGB using default instance
   */
  static hexToRgb(hex: string): RGB {
    return this.getDefault().hexToRgb(hex);
  }

  /**
   * Convert RGB to hexadecimal color
   * Per P-1: Cached for performance
   * @example rgbToHex(255, 0, 0) -> "#FF0000"
   */
  rgbToHex(r: number, g: number, b: number): HexColor {
    if (!isValidRGB(r, g, b)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        `Invalid RGB values: r=${r}, g=${g}, b=${b}. Values must be 0-255`,
        'error'
      );
    }

    // Create cache key
    const cacheKey = `${r},${g},${b}`;

    // Check cache
    const cached = this.rgbToHexCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const toHex = (value: number): string => {
      const hex = Math.round(value).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    const result = createHexColor(`#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase());
    // Cache result
    this.rgbToHexCache.set(cacheKey, result);
    return result;
  }

  /**
   * Static method: Convert RGB to hex using default instance
   */
  static rgbToHex(r: number, g: number, b: number): HexColor {
    return this.getDefault().rgbToHex(r, g, b);
  }

  /**
   * Convert RGB to HSV
   * Per P-1: Cached for performance, optimized single-pass min/max
   * @example rgbToHsv(255, 0, 0) -> { h: 0, s: 100, v: 100 }
   */
  rgbToHsv(r: number, g: number, b: number): HSV {
    if (!isValidRGB(r, g, b)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        `Invalid RGB values: r=${r}, g=${g}, b=${b}`,
        'error'
      );
    }

    // Create cache key
    const cacheKey = `${r},${g},${b}`;

    // Check cache
    const cached = this.rgbToHsvCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Per P-1: Optimized single-pass min/max calculation
    // Normalize RGB to 0-1 range
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    // Single-pass min/max (optimized)
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    // Calculate Value (brightness)
    const v = max * 100;

    // Calculate Saturation
    const s = max === 0 ? 0 : (delta / max) * 100;

    // Calculate Hue
    let h = 0;
    if (delta !== 0) {
      if (max === rNorm) {
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
      } else if (max === gNorm) {
        h = ((bNorm - rNorm) / delta + 2) * 60;
      } else {
        h = ((rNorm - gNorm) / delta + 4) * 60;
      }
    }

    const result = { h: round(h, 2), s: round(s, 2), v: round(v, 2) };
    // Cache result
    this.rgbToHsvCache.set(cacheKey, result);
    return result;
  }

  /**
   * Static method: Convert RGB to HSV using default instance
   */
  static rgbToHsv(r: number, g: number, b: number): HSV {
    return this.getDefault().rgbToHsv(r, g, b);
  }

  /**
   * Normalize hue to [0, 360) range.
   * CORE-BUG-001: Ensures consistent cache keys for equivalent hue values
   * (e.g., h=359.9999 and h=0.0001 both produce similar cache keys after rounding)
   * Also handles negative values and values >= 360.
   */
  private normalizeHue(h: number): number {
    return ((h % HUE_MAX) + HUE_MAX) % HUE_MAX;
  }

  /**
   * Convert HSV to RGB
   * Per P-1: Cached for performance
   * @example hsvToRgb(0, 100, 100) -> { r: 255, g: 0, b: 0 }
   */
  hsvToRgb(h: number, s: number, v: number): RGB {
    if (!isValidHSV(h, s, v)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        `Invalid HSV values: h=${h}, s=${s}, v=${v}`,
        'error'
      );
    }

    // CORE-BUG-001: Normalize hue BEFORE creating cache key
    // This ensures h=359.9999 and h=0.0001 produce consistent cache keys
    // after rounding, preventing cache thrashing for equivalent colors
    const hNormalized = this.normalizeHue(h);

    // Create cache key using consistent rounding (2 decimal places)
    // Per Issue #17: Use same round() utility as rgbToHsv for consistency
    const cacheKey = `${round(hNormalized, 2)},${round(s, 2)},${round(v, 2)}`;

    // Check cache
    const cached = this.hsvToRgbCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Normalize HSV (use already normalized hue)
    const hNorm = hNormalized / 60;
    const sNorm = s / 100;
    const vNorm = v / 100;

    const c = vNorm * sNorm;
    const x = c * (1 - Math.abs((hNorm % 2) - 1));
    const m = vNorm - c;

    let rNorm = 0,
      gNorm = 0,
      bNorm = 0;

    if (hNorm >= 0 && hNorm < 1) {
      [rNorm, gNorm, bNorm] = [c, x, 0];
    } else if (hNorm >= 1 && hNorm < 2) {
      [rNorm, gNorm, bNorm] = [x, c, 0];
    } else if (hNorm >= 2 && hNorm < 3) {
      [rNorm, gNorm, bNorm] = [0, c, x];
    } else if (hNorm >= 3 && hNorm < 4) {
      [rNorm, gNorm, bNorm] = [0, x, c];
    } else if (hNorm >= 4 && hNorm < 5) {
      [rNorm, gNorm, bNorm] = [x, 0, c];
    } else {
      [rNorm, gNorm, bNorm] = [c, 0, x];
    }

    const r = Math.round((rNorm + m) * 255);
    const g = Math.round((gNorm + m) * 255);
    const b = Math.round((bNorm + m) * 255);

    const result = {
      r: clamp(r, RGB_MIN, RGB_MAX),
      g: clamp(g, RGB_MIN, RGB_MAX),
      b: clamp(b, RGB_MIN, RGB_MAX),
    };
    // Cache result
    this.hsvToRgbCache.set(cacheKey, result);
    return result;
  }

  /**
   * Static method: Convert HSV to RGB using default instance
   */
  static hsvToRgb(h: number, s: number, v: number): RGB {
    return this.getDefault().hsvToRgb(h, s, v);
  }

  /**
   * Convert hex to HSV
   * Per P-1: Cached for performance
   */
  hexToHsv(hex: string): HSV {
    // Normalize hex for cache key
    let hexForCache = hex.toUpperCase().replace('#', '');
    if (hexForCache.length === 3) {
      hexForCache = hexForCache
        .split('')
        .map((c) => c + c)
        .join('');
    }
    const cacheKey = hexForCache;

    // Check cache
    const cached = this.hexToHsvCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const rgb = this.hexToRgb(hex);
    const result = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
    // Cache result
    this.hexToHsvCache.set(cacheKey, result);
    return result;
  }

  /**
   * Static method: Convert hex to HSV using default instance
   */
  static hexToHsv(hex: string): HSV {
    return this.getDefault().hexToHsv(hex);
  }

  /**
   * Convert HSV to hex
   */
  hsvToHex(h: number, s: number, v: number): HexColor {
    const rgb = this.hsvToRgb(h, s, v);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert HSV to hex using default instance
   */
  static hsvToHex(h: number, s: number, v: number): HexColor {
    return this.getDefault().hsvToHex(h, s, v);
  }

  /**
   * Normalize a hex color to #RRGGBB format
   */
  normalizeHex(hex: string): HexColor {
    const rgb = this.hexToRgb(hex);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Normalize hex using default instance
   */
  static normalizeHex(hex: string): HexColor {
    return this.getDefault().normalizeHex(hex);
  }

  /**
   * Calculate Euclidean distance between two RGB colors
   * Returns 0 for identical colors, ~441.67 for white vs black
   */
  getColorDistance(hex1: string, hex2: string): number {
    const rgb1 = this.hexToRgb(hex1);
    const rgb2 = this.hexToRgb(hex2);

    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;

    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /**
   * Static method: Calculate color distance using default instance
   */
  static getColorDistance(hex1: string, hex2: string): number {
    return this.getDefault().getColorDistance(hex1, hex2);
  }

  // ============================================================================
  // LAB Color Space Conversion
  // ============================================================================

  /**
   * Convert RGB to CIE XYZ color space (intermediate step for LAB)
   * Uses sRGB to XYZ conversion with D65 illuminant
   * @internal
   */
  private rgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
    // Normalize to 0-1 and apply sRGB gamma expansion
    let rLinear = r / 255;
    let gLinear = g / 255;
    let bLinear = b / 255;

    // sRGB gamma expansion (inverse companding)
    rLinear = rLinear > 0.04045 ? Math.pow((rLinear + 0.055) / 1.055, 2.4) : rLinear / 12.92;
    gLinear = gLinear > 0.04045 ? Math.pow((gLinear + 0.055) / 1.055, 2.4) : gLinear / 12.92;
    bLinear = bLinear > 0.04045 ? Math.pow((bLinear + 0.055) / 1.055, 2.4) : bLinear / 12.92;

    // sRGB to XYZ matrix (D65 illuminant)
    return {
      x: rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375,
      y: rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175,
      z: rLinear * 0.0193339 + gLinear * 0.119192 + bLinear * 0.9503041,
    };
  }

  /**
   * Convert RGB to CIE LAB color space
   * Per P-1: Cached for performance
   * @example rgbToLab(255, 0, 0) -> { L: 53.23, a: 80.11, b: 67.22 }
   */
  rgbToLab(r: number, g: number, b: number): LAB {
    if (!isValidRGB(r, g, b)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        `Invalid RGB values: r=${r}, g=${g}, b=${b}. Values must be 0-255`,
        'error'
      );
    }

    const cacheKey = `${r},${g},${b}`;
    const cached = this.rgbToLabCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // D65 reference white point
    const refX = 0.95047;
    const refY = 1.0;
    const refZ = 1.08883;

    const xyz = this.rgbToXyz(r, g, b);

    // Normalize by reference white
    let x = xyz.x / refX;
    let y = xyz.y / refY;
    let z = xyz.z / refZ;

    // Apply LAB transformation (cube root with linear segment for dark colors)
    const epsilon = 0.008856; // (6/29)^3
    const kappa = 903.3; // (29/3)^3

    x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
    y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
    z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;

    const result: LAB = {
      L: round(116 * y - 16, 4),
      a: round(500 * (x - y), 4),
      b: round(200 * (y - z), 4),
    };

    this.rgbToLabCache.set(cacheKey, result);
    return result;
  }

  /**
   * Static method: Convert RGB to LAB using default instance
   */
  static rgbToLab(r: number, g: number, b: number): LAB {
    return this.getDefault().rgbToLab(r, g, b);
  }

  /**
   * Convert hex color to CIE LAB
   * @example hexToLab("#FF0000") -> { L: 53.23, a: 80.11, b: 67.22 }
   */
  hexToLab(hex: string): LAB {
    const rgb = this.hexToRgb(hex);
    return this.rgbToLab(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert hex to LAB using default instance
   */
  static hexToLab(hex: string): LAB {
    return this.getDefault().hexToLab(hex);
  }

  /**
   * Convert CIE XYZ to RGB
   * Uses sRGB matrix and gamma companding (D65 illuminant)
   * @internal
   */
  private xyzToRgb(x: number, y: number, z: number): RGB {
    // XYZ to sRGB matrix (D65 illuminant)
    let rLinear = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    let gLinear = x * -0.969266 + y * 1.8760108 + z * 0.041556;
    let bLinear = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    // sRGB gamma companding
    rLinear = rLinear > 0.0031308 ? 1.055 * Math.pow(rLinear, 1 / 2.4) - 0.055 : 12.92 * rLinear;
    gLinear = gLinear > 0.0031308 ? 1.055 * Math.pow(gLinear, 1 / 2.4) - 0.055 : 12.92 * gLinear;
    bLinear = bLinear > 0.0031308 ? 1.055 * Math.pow(bLinear, 1 / 2.4) - 0.055 : 12.92 * bLinear;

    return {
      r: clamp(Math.round(rLinear * 255), RGB_MIN, RGB_MAX),
      g: clamp(Math.round(gLinear * 255), RGB_MIN, RGB_MAX),
      b: clamp(Math.round(bLinear * 255), RGB_MIN, RGB_MAX),
    };
  }

  /**
   * Convert CIE LAB to RGB
   * @example labToRgb(53.23, 80.11, 67.22) -> { r: 255, g: 0, b: 0 }
   */
  labToRgb(L: number, a: number, b: number): RGB {
    // D65 reference white point
    const refX = 0.95047;
    const refY = 1.0;
    const refZ = 1.08883;

    // LAB to XYZ
    let y = (L + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    // Reverse LAB transformation
    const epsilon = 0.008856; // (6/29)^3
    const kappa = 903.3; // (29/3)^3

    const x3 = x * x * x;
    const y3 = y * y * y;
    const z3 = z * z * z;

    x = x3 > epsilon ? x3 : (116 * x - 16) / kappa;
    y = L > kappa * epsilon ? y3 : L / kappa;
    z = z3 > epsilon ? z3 : (116 * z - 16) / kappa;

    // Apply reference white
    return this.xyzToRgb(x * refX, y * refY, z * refZ);
  }

  /**
   * Static method: Convert LAB to RGB using default instance
   */
  static labToRgb(L: number, a: number, b: number): RGB {
    return this.getDefault().labToRgb(L, a, b);
  }

  /**
   * Convert CIE LAB to hex color
   * @example labToHex(53.23, 80.11, 67.22) -> "#FF0000"
   */
  labToHex(L: number, a: number, b: number): HexColor {
    const rgb = this.labToRgb(L, a, b);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert LAB to hex using default instance
   */
  static labToHex(L: number, a: number, b: number): HexColor {
    return this.getDefault().labToHex(L, a, b);
  }

  // ============================================================================
  // DeltaE Color Difference Calculations
  // ============================================================================

  /**
   * Calculate DeltaE (CIE76) between two LAB colors
   * Simple Euclidean distance in LAB space
   * Fast but less perceptually accurate than CIE2000
   * @returns DeltaE value (0 = identical, <1 imperceptible, <3 barely noticeable, >5 clearly different)
   */
  getDeltaE76(lab1: LAB, lab2: LAB): number {
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    return Math.sqrt(dL * dL + da * da + db * db);
  }

  /**
   * Static method: Calculate DeltaE76 using default instance
   */
  static getDeltaE76(lab1: LAB, lab2: LAB): number {
    return this.getDefault().getDeltaE76(lab1, lab2);
  }

  /**
   * Calculate DeltaE (CIEDE2000) between two LAB colors
   * Industry standard for perceptual color difference
   * More accurate but computationally expensive
   * @returns DeltaE value (0 = identical, <1 imperceptible, <3 barely noticeable, >5 clearly different)
   */
  getDeltaE2000(lab1: LAB, lab2: LAB): number {
    const L1 = lab1.L,
      a1 = lab1.a,
      b1 = lab1.b;
    const L2 = lab2.L,
      a2 = lab2.a,
      b2 = lab2.b;

    // Weighting factors (all set to 1 for standard conditions)
    const kL = 1,
      kC = 1,
      kH = 1;

    // Calculate C' and h' for both colors
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cab = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));

    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);

    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);

    const h1p = this.hueAngle(a1p, b1);
    const h2p = this.hueAngle(a2p, b2);

    // Calculate deltas
    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp: number;
    if (C1p * C2p === 0) {
      dhp = 0;
    } else if (Math.abs(h2p - h1p) <= 180) {
      dhp = h2p - h1p;
    } else if (h2p - h1p > 180) {
      dhp = h2p - h1p - 360;
    } else {
      dhp = h2p - h1p + 360;
    }

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

    // Calculate CIEDE2000 components
    const Lp = (L1 + L2) / 2;
    const Cp = (C1p + C2p) / 2;

    let Hp: number;
    if (C1p * C2p === 0) {
      Hp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
      Hp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      Hp = (h1p + h2p + 360) / 2;
    } else {
      Hp = (h1p + h2p - 360) / 2;
    }

    const T =
      1 -
      0.17 * Math.cos(((Hp - 30) * Math.PI) / 180) +
      0.24 * Math.cos((2 * Hp * Math.PI) / 180) +
      0.32 * Math.cos(((3 * Hp + 6) * Math.PI) / 180) -
      0.2 * Math.cos(((4 * Hp - 63) * Math.PI) / 180);

    const dTheta = 30 * Math.exp(-Math.pow((Hp - 275) / 25, 2));

    const Rc = 2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)));

    const Sl = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
    const Sc = 1 + 0.045 * Cp;
    const Sh = 1 + 0.015 * Cp * T;

    const Rt = -Math.sin((2 * dTheta * Math.PI) / 180) * Rc;

    const dE = Math.sqrt(
      Math.pow(dLp / (kL * Sl), 2) +
        Math.pow(dCp / (kC * Sc), 2) +
        Math.pow(dHp / (kH * Sh), 2) +
        Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
    );

    return dE;
  }

  /**
   * Helper to calculate hue angle in degrees from a' and b'
   * @internal
   */
  private hueAngle(ap: number, bp: number): number {
    if (ap === 0 && bp === 0) {
      return 0;
    }
    const h = (Math.atan2(bp, ap) * 180) / Math.PI;
    return h >= 0 ? h : h + 360;
  }

  /**
   * Static method: Calculate DeltaE2000 using default instance
   */
  static getDeltaE2000(lab1: LAB, lab2: LAB): number {
    return this.getDefault().getDeltaE2000(lab1, lab2);
  }

  /**
   * Calculate DeltaE between two hex colors using specified formula
   *
   * Available formulas:
   * - cie76: LAB Euclidean (fast, fair accuracy)
   * - cie2000: CIEDE2000 (industry standard, accurate)
   * - oklab: OKLAB Euclidean (modern, simpler than cie2000, CSS standard)
   * - hyab: HyAB hybrid (best for large color differences/palette matching)
   *
   * @param hex1 First hex color
   * @param hex2 Second hex color
   * @param formula DeltaE formula to use (default: 'cie76')
   * @returns DeltaE value (scale varies by formula)
   */
  getDeltaE(hex1: string, hex2: string, formula: DeltaEFormula = 'cie76'): number {
    switch (formula) {
      case 'cie2000': {
        const lab1 = this.hexToLab(hex1);
        const lab2 = this.hexToLab(hex2);
        return this.getDeltaE2000(lab1, lab2);
      }
      case 'oklab':
        return this.getDeltaE_Oklab(hex1, hex2);
      case 'hyab':
        return this.getDeltaE_HyAB(hex1, hex2);
      case 'cie76':
      default: {
        const lab1 = this.hexToLab(hex1);
        const lab2 = this.hexToLab(hex2);
        return this.getDeltaE76(lab1, lab2);
      }
    }
  }

  /**
   * Static method: Calculate DeltaE using default instance
   */
  static getDeltaE(hex1: string, hex2: string, formula: DeltaEFormula = 'cie76'): number {
    return this.getDefault().getDeltaE(hex1, hex2, formula);
  }

  // ============================================================================
  // OKLAB-based Color Difference Calculations
  // ============================================================================

  /**
   * Calculate color difference using OKLAB Euclidean distance.
   *
   * OKLAB provides better perceptual uniformity than LAB with simpler math
   * than CIEDE2000. It fixes LAB's blue→purple hue shift issue.
   *
   * Adopted by Safari, Photoshop, and CSS Color Level 4.
   *
   * Reference: Björn Ottosson (2020) - "A perceptual color space for image processing"
   *
   * @param hex1 First color in hex format
   * @param hex2 Second color in hex format
   * @returns Distance value (0 = identical, scale ~0-0.5 for typical colors)
   *
   * @example getDeltaE_Oklab("#FF0000", "#00FF00") -> ~0.39
   */
  getDeltaE_Oklab(hex1: string, hex2: string): number {
    const lab1 = this.hexToOklab(hex1);
    const lab2 = this.hexToOklab(hex2);

    const dL = lab2.L - lab1.L;
    const da = lab2.a - lab1.a;
    const db = lab2.b - lab1.b;

    return Math.sqrt(dL * dL + da * da + db * db);
  }

  /**
   * Static method: Calculate OKLAB Euclidean distance using default instance
   */
  static getDeltaE_Oklab(hex1: string, hex2: string): number {
    return this.getDefault().getDeltaE_Oklab(hex1, hex2);
  }

  /**
   * Calculate color difference using HyAB (Hybrid) algorithm.
   *
   * HyAB uses taxicab distance for lightness and Euclidean for chroma.
   * Research shows it outperforms both Euclidean AND CIEDE2000 for large
   * color differences (>10 units), making it ideal for palette matching.
   *
   * Formula: ΔE_HyAB = |L₂ - L₁| + √[(a₂-a₁)² + (b₂-b₁)²]
   *
   * Reference: Abasi, Tehran & Fairchild (2019) -
   * "Distance metrics for very large color differences"
   *
   * @param hex1 First color in hex format
   * @param hex2 Second color in hex format
   * @param kL Lightness weight (default 1.0). Higher = prioritize lightness matching.
   *           Use kL > 1 for visibility-critical matching (armor, UI).
   *           Use kL < 1 to tolerate brightness differences (find vibrant alternatives).
   * @returns Distance value (0 = identical, scale ~0-1.5 for typical colors)
   *
   * @example getDeltaE_HyAB("#FF0000", "#800000") -> ~0.32
   * @example getDeltaE_HyAB("#FF0000", "#800000", 2.0) -> higher (emphasize brightness)
   */
  getDeltaE_HyAB(hex1: string, hex2: string, kL: number = 1.0): number {
    const lab1 = this.hexToOklab(hex1);
    const lab2 = this.hexToOklab(hex2);

    // Taxicab distance for lightness (weighted)
    const dL = Math.abs(lab2.L - lab1.L) * kL;

    // Euclidean distance for chroma plane
    const da = lab2.a - lab1.a;
    const db = lab2.b - lab1.b;
    const dChroma = Math.sqrt(da * da + db * db);

    return dL + dChroma;
  }

  /**
   * Static method: Calculate HyAB distance using default instance
   */
  static getDeltaE_HyAB(hex1: string, hex2: string, kL: number = 1.0): number {
    return this.getDefault().getDeltaE_HyAB(hex1, hex2, kL);
  }

  /**
   * Calculate color difference using OKLCH with customizable L/C/H weights.
   *
   * Allows users to prioritize different color attributes:
   * - Lightness (L): Brightness/darkness
   * - Chroma (C): Saturation/vividness
   * - Hue (H): The actual color (red, blue, green, etc.)
   *
   * @param hex1 First color in hex format
   * @param hex2 Second color in hex format
   * @param weights Object with kL, kC, kH weights (default 1.0 each)
   * @returns Distance value (0 = identical, higher = more different)
   *
   * @example getDeltaE_OklchWeighted("#FF0000", "#FF8000", { kH: 2.0 }) -> prioritizes hue match
   */
  getDeltaE_OklchWeighted(
    hex1: string,
    hex2: string,
    weights: { kL?: number; kC?: number; kH?: number } = {}
  ): number {
    const { kL = 1.0, kC = 1.0, kH = 1.0 } = weights;

    const lch1 = this.hexToOklch(hex1);
    const lch2 = this.hexToOklch(hex2);

    // Lightness difference
    const dL = (lch2.L - lch1.L) * kL;

    // Chroma difference
    const dC = (lch2.C - lch1.C) * kC;

    // Hue difference with wraparound (circular)
    let dH = lch2.h - lch1.h;
    if (dH > 180) dH -= 360;
    if (dH < -180) dH += 360;

    // Scale hue by average chroma for perceptual accuracy
    // (hue differences matter less for desaturated colors)
    const avgC = (lch1.C + lch2.C) / 2;
    const dHScaled = (dH / 180) * avgC * kH;

    return Math.sqrt(dL * dL + dC * dC + dHScaled * dHScaled);
  }

  /**
   * Static method: Calculate OKLCH weighted distance using default instance
   */
  static getDeltaE_OklchWeighted(
    hex1: string,
    hex2: string,
    weights: { kL?: number; kC?: number; kH?: number } = {}
  ): number {
    return this.getDefault().getDeltaE_OklchWeighted(hex1, hex2, weights);
  }

  // ============================================================================
  // OKLAB/OKLCH Color Space Conversion (Björn Ottosson, 2020)
  // ============================================================================

  /**
   * Convert sRGB component to linear RGB
   * Applies inverse gamma companding
   * @internal
   */
  private srgbToLinear(c: number): number {
    const normalized = c / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  }

  /**
   * Convert linear RGB component to sRGB
   * Applies gamma companding
   * @internal
   */
  private linearToSrgb(c: number): number {
    const clamped = Math.max(0, Math.min(1, c));
    const srgb =
      clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  }

  /**
   * Convert RGB to OKLAB color space
   *
   * OKLAB is a modern perceptually uniform color space that fixes issues
   * with CIELAB, particularly for blue colors. Blue + Yellow = Green in OKLAB.
   *
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @returns OKLAB color with L (0-1), a (~-0.4 to 0.4), b (~-0.4 to 0.4)
   *
   * @example rgbToOklab(255, 0, 0) -> { L: 0.628, a: 0.225, b: 0.126 }
   */
  rgbToOklab(r: number, g: number, b: number): OKLAB {
    if (!isValidRGB(r, g, b)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        `Invalid RGB values: r=${r}, g=${g}, b=${b}. Values must be 0-255`,
        'error'
      );
    }

    // Convert sRGB to linear RGB
    const rLin = this.srgbToLinear(r);
    const gLin = this.srgbToLinear(g);
    const bLin = this.srgbToLinear(b);

    // Linear RGB to LMS (using Oklab's specific matrix)
    const l = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
    const m = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
    const s = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

    // Apply cube root
    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);

    // LMS to Oklab
    return {
      L: round(0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot, 6),
      a: round(1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot, 6),
      b: round(0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot, 6),
    };
  }

  /**
   * Static method: Convert RGB to OKLAB using default instance
   */
  static rgbToOklab(r: number, g: number, b: number): OKLAB {
    return this.getDefault().rgbToOklab(r, g, b);
  }

  /**
   * Convert OKLAB to RGB color space
   *
   * @param L Lightness (0-1)
   * @param a Green-Red axis (~-0.4 to 0.4)
   * @param b Blue-Yellow axis (~-0.4 to 0.4)
   * @returns RGB color with values 0-255
   *
   * @example oklabToRgb(0.628, 0.225, 0.126) -> { r: 255, g: 0, b: 0 }
   */
  oklabToRgb(L: number, a: number, b: number): RGB {
    // Oklab to LMS
    const lRoot = L + 0.3963377774 * a + 0.2158037573 * b;
    const mRoot = L - 0.1055613458 * a - 0.0638541728 * b;
    const sRoot = L - 0.0894841775 * a - 1.291485548 * b;

    // Cube the roots
    const l = lRoot * lRoot * lRoot;
    const m = mRoot * mRoot * mRoot;
    const s = sRoot * sRoot * sRoot;

    // LMS to linear RGB
    const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    // Convert to sRGB
    return {
      r: clamp(this.linearToSrgb(rLin), RGB_MIN, RGB_MAX),
      g: clamp(this.linearToSrgb(gLin), RGB_MIN, RGB_MAX),
      b: clamp(this.linearToSrgb(bLin), RGB_MIN, RGB_MAX),
    };
  }

  /**
   * Static method: Convert OKLAB to RGB using default instance
   */
  static oklabToRgb(L: number, a: number, b: number): RGB {
    return this.getDefault().oklabToRgb(L, a, b);
  }

  /**
   * Convert hex color to OKLAB
   */
  hexToOklab(hex: string): OKLAB {
    const rgb = this.hexToRgb(hex);
    return this.rgbToOklab(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert hex to OKLAB using default instance
   */
  static hexToOklab(hex: string): OKLAB {
    return this.getDefault().hexToOklab(hex);
  }

  /**
   * Convert OKLAB to hex color
   */
  oklabToHex(L: number, a: number, b: number): HexColor {
    const rgb = this.oklabToRgb(L, a, b);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert OKLAB to hex using default instance
   */
  static oklabToHex(L: number, a: number, b: number): HexColor {
    return this.getDefault().oklabToHex(L, a, b);
  }

  /**
   * Convert RGB to OKLCH (cylindrical OKLAB)
   *
   * OKLCH expresses OKLAB in cylindrical coordinates for intuitive
   * hue manipulation. Ideal for gradient interpolation.
   *
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @returns OKLCH color with L (0-1), C (chroma, 0 to ~0.4), h (hue, 0-360)
   *
   * @example rgbToOklch(255, 0, 0) -> { L: 0.628, C: 0.258, h: 29.23 }
   */
  rgbToOklch(r: number, g: number, b: number): OKLCH {
    const oklab = this.rgbToOklab(r, g, b);

    // Convert to cylindrical coordinates
    const C = Math.sqrt(oklab.a * oklab.a + oklab.b * oklab.b);
    let h = Math.atan2(oklab.b, oklab.a) * (180 / Math.PI);
    if (h < 0) h += 360;

    return {
      L: oklab.L,
      C: round(C, 6),
      h: round(h, 4),
    };
  }

  /**
   * Static method: Convert RGB to OKLCH using default instance
   */
  static rgbToOklch(r: number, g: number, b: number): OKLCH {
    return this.getDefault().rgbToOklch(r, g, b);
  }

  /**
   * Convert OKLCH to RGB
   *
   * @param L Lightness (0-1)
   * @param C Chroma (0 to ~0.4)
   * @param h Hue angle (0-360 degrees)
   * @returns RGB color with values 0-255
   */
  oklchToRgb(L: number, C: number, h: number): RGB {
    // Convert from cylindrical to rectangular coordinates
    const hRad = h * (Math.PI / 180);
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    return this.oklabToRgb(L, a, b);
  }

  /**
   * Static method: Convert OKLCH to RGB using default instance
   */
  static oklchToRgb(L: number, C: number, h: number): RGB {
    return this.getDefault().oklchToRgb(L, C, h);
  }

  /**
   * Convert hex color to OKLCH
   */
  hexToOklch(hex: string): OKLCH {
    const rgb = this.hexToRgb(hex);
    return this.rgbToOklch(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert hex to OKLCH using default instance
   */
  static hexToOklch(hex: string): OKLCH {
    return this.getDefault().hexToOklch(hex);
  }

  /**
   * Convert OKLCH to hex color
   */
  oklchToHex(L: number, C: number, h: number): HexColor {
    const rgb = this.oklchToRgb(L, C, h);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert OKLCH to hex using default instance
   */
  static oklchToHex(L: number, C: number, h: number): HexColor {
    return this.getDefault().oklchToHex(L, C, h);
  }

  // ============================================================================
  // LCH Color Space Conversion (Cylindrical CIE LAB)
  // ============================================================================

  /**
   * Convert CIE LAB to LCH (cylindrical LAB)
   *
   * LCH expresses LAB in cylindrical coordinates for hue-based operations.
   *
   * @param L Lightness (0-100)
   * @param a Green-Red axis (~-128 to 127)
   * @param b Blue-Yellow axis (~-128 to 127)
   * @returns LCH color with L (0-100), C (chroma), h (hue, 0-360)
   */
  labToLch(L: number, a: number, b: number): LCH {
    const C = Math.sqrt(a * a + b * b);
    let h = Math.atan2(b, a) * (180 / Math.PI);
    if (h < 0) h += 360;

    return {
      L: round(L, 4),
      C: round(C, 4),
      h: round(h, 4),
    };
  }

  /**
   * Static method: Convert LAB to LCH using default instance
   */
  static labToLch(L: number, a: number, b: number): LCH {
    return this.getDefault().labToLch(L, a, b);
  }

  /**
   * Convert LCH to CIE LAB
   *
   * @param L Lightness (0-100)
   * @param C Chroma
   * @param h Hue angle (0-360 degrees)
   * @returns LAB color
   */
  lchToLab(L: number, C: number, h: number): LAB {
    const hRad = h * (Math.PI / 180);
    return {
      L: round(L, 4),
      a: round(C * Math.cos(hRad), 4),
      b: round(C * Math.sin(hRad), 4),
    };
  }

  /**
   * Static method: Convert LCH to LAB using default instance
   */
  static lchToLab(L: number, C: number, h: number): LAB {
    return this.getDefault().lchToLab(L, C, h);
  }

  /**
   * Convert RGB to LCH
   */
  rgbToLch(r: number, g: number, b: number): LCH {
    const lab = this.rgbToLab(r, g, b);
    return this.labToLch(lab.L, lab.a, lab.b);
  }

  /**
   * Static method: Convert RGB to LCH using default instance
   */
  static rgbToLch(r: number, g: number, b: number): LCH {
    return this.getDefault().rgbToLch(r, g, b);
  }

  /**
   * Convert LCH to RGB
   */
  lchToRgb(L: number, C: number, h: number): RGB {
    const lab = this.lchToLab(L, C, h);
    return this.labToRgb(lab.L, lab.a, lab.b);
  }

  /**
   * Static method: Convert LCH to RGB using default instance
   */
  static lchToRgb(L: number, C: number, h: number): RGB {
    return this.getDefault().lchToRgb(L, C, h);
  }

  /**
   * Convert hex color to LCH
   */
  hexToLch(hex: string): LCH {
    const rgb = this.hexToRgb(hex);
    return this.rgbToLch(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert hex to LCH using default instance
   */
  static hexToLch(hex: string): LCH {
    return this.getDefault().hexToLch(hex);
  }

  /**
   * Convert LCH to hex color
   */
  lchToHex(L: number, C: number, h: number): HexColor {
    const rgb = this.lchToRgb(L, C, h);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert LCH to hex using default instance
   */
  static lchToHex(L: number, C: number, h: number): HexColor {
    return this.getDefault().lchToHex(L, C, h);
  }

  // ============================================================================
  // HSL Color Space Conversion
  // ============================================================================

  /**
   * Convert RGB to HSL (Hue, Saturation, Lightness)
   *
   * HSL is similar to HSV but uses Lightness instead of Value.
   * Common in design tools like Photoshop, Figma, and CSS.
   *
   * @param r Red component (0-255)
   * @param g Green component (0-255)
   * @param b Blue component (0-255)
   * @returns HSL color with h (0-360), s (0-100), l (0-100)
   *
   * @example rgbToHsl(255, 0, 0) -> { h: 0, s: 100, l: 50 }
   */
  rgbToHsl(r: number, g: number, b: number): HSL {
    if (!isValidRGB(r, g, b)) {
      throw new AppError(
        ErrorCode.INVALID_RGB_VALUE,
        `Invalid RGB values: r=${r}, g=${g}, b=${b}. Values must be 0-255`,
        'error'
      );
    }

    // Normalize to 0-1
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    // Calculate Lightness
    const l = (max + min) / 2;

    // Calculate Saturation
    let s = 0;
    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
    }

    // Calculate Hue (same as HSV)
    let h = 0;
    if (delta !== 0) {
      if (max === rNorm) {
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
      } else if (max === gNorm) {
        h = ((bNorm - rNorm) / delta + 2) * 60;
      } else {
        h = ((rNorm - gNorm) / delta + 4) * 60;
      }
    }

    return {
      h: round(h, 2),
      s: round(s * 100, 2),
      l: round(l * 100, 2),
    };
  }

  /**
   * Static method: Convert RGB to HSL using default instance
   */
  static rgbToHsl(r: number, g: number, b: number): HSL {
    return this.getDefault().rgbToHsl(r, g, b);
  }

  /**
   * Convert HSL to RGB
   *
   * @param h Hue (0-360 degrees)
   * @param s Saturation (0-100 percent)
   * @param l Lightness (0-100 percent)
   * @returns RGB color with values 0-255
   *
   * @example hslToRgb(0, 100, 50) -> { r: 255, g: 0, b: 0 }
   */
  hslToRgb(h: number, s: number, l: number): RGB {
    // Normalize
    const hNorm = this.normalizeHue(h) / 360;
    const sNorm = clamp(s, 0, 100) / 100;
    const lNorm = clamp(l, 0, 100) / 100;

    let r: number, g: number, b: number;

    if (sNorm === 0) {
      // Achromatic (gray)
      r = g = b = lNorm;
    } else {
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;

      r = this.hueToRgbComponent(p, q, hNorm + 1 / 3);
      g = this.hueToRgbComponent(p, q, hNorm);
      b = this.hueToRgbComponent(p, q, hNorm - 1 / 3);
    }

    return {
      r: clamp(Math.round(r * 255), RGB_MIN, RGB_MAX),
      g: clamp(Math.round(g * 255), RGB_MIN, RGB_MAX),
      b: clamp(Math.round(b * 255), RGB_MIN, RGB_MAX),
    };
  }

  /**
   * Helper for HSL to RGB conversion
   * @internal
   */
  private hueToRgbComponent(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  /**
   * Static method: Convert HSL to RGB using default instance
   */
  static hslToRgb(h: number, s: number, l: number): RGB {
    return this.getDefault().hslToRgb(h, s, l);
  }

  /**
   * Convert hex color to HSL
   */
  hexToHsl(hex: string): HSL {
    const rgb = this.hexToRgb(hex);
    return this.rgbToHsl(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert hex to HSL using default instance
   */
  static hexToHsl(hex: string): HSL {
    return this.getDefault().hexToHsl(hex);
  }

  /**
   * Convert HSL to hex color
   */
  hslToHex(h: number, s: number, l: number): HexColor {
    const rgb = this.hslToRgb(h, s, l);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Static method: Convert HSL to hex using default instance
   */
  static hslToHex(h: number, s: number, l: number): HexColor {
    return this.getDefault().hslToHex(h, s, l);
  }
}

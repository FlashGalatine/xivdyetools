/**
 * @xivdyetools/core - Application Constants
 *
 * Centralized configuration and constant values
 *
 * @module constants
 */

import type { VisionType, ColorblindMatrices } from '../types/index.js';

// ============================================================================
// Color Conversion Constraints
// ============================================================================

/**
 * RGB value constraints
 */
export const RGB_MIN = 0;
export const RGB_MAX = 255;

/**
 * HSV value constraints
 */
export const HUE_MIN = 0;
export const HUE_MAX = 360;
export const SATURATION_MIN = 0;
export const SATURATION_MAX = 100;
export const VALUE_MIN = 0;
export const VALUE_MAX = 100;

/**
 * Color distance calculation mode
 */
export const COLOR_DISTANCE_MAX = Math.sqrt(255 ** 2 + 255 ** 2 + 255 ** 2); // ~441.67

// ============================================================================
// Vision Type Configuration
// ============================================================================

export const VISION_TYPES: readonly VisionType[] = [
    'normal',
    'deuteranopia',
    'protanopia',
    'tritanopia',
    'achromatopsia',
] as const;

export const VISION_TYPE_LABELS: Record<VisionType, string> = {
    normal: 'Normal Vision',
    deuteranopia: 'Deuteranopia (Red-Green Colorblindness)',
    protanopia: 'Protanopia (Red-Green Colorblindness)',
    tritanopia: 'Tritanopia (Blue-Yellow Colorblindness)',
    achromatopsia: 'Achromatopsia (Total Colorblindness)',
};

// ============================================================================
// Colorblindness Transformation Matrices (Brettel 1997)
// ============================================================================

/**
 * Brettel 1997 transformation matrices for colorblindness simulation
 * These matrices transform RGB values to simulate different types of colorblindness
 */
export const BRETTEL_MATRICES: ColorblindMatrices = {
    deuteranopia: [
        [0.625, 0.375, 0.0],
        [0.7, 0.3, 0.0],
        [0.0, 0.3, 0.7],
    ],
    protanopia: [
        [0.567, 0.433, 0.0],
        [0.558, 0.442, 0.0],
        [0.0, 0.242, 0.758],
    ],
    tritanopia: [
        [0.95, 0.05, 0.0],
        [0.0, 0.433, 0.567],
        [0.0, 0.475, 0.525],
    ],
    achromatopsia: [
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
        [0.299, 0.587, 0.114],
    ],
};

// ============================================================================
// Regular Expressions
// ============================================================================

/**
 * Regex patterns for validation
 */
export const PATTERNS = {
    HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    RGB_COLOR: /^rgb\(\d+,\s*\d+,\s*\d+\)$/,
} as const;

// ============================================================================
// API Configuration (Universalis)
// ============================================================================

/**
 * Universalis API configuration
 */
export const UNIVERSALIS_API_BASE = 'https://universalis.app/api/v2';
export const UNIVERSALIS_API_TIMEOUT = 5000; // milliseconds
export const UNIVERSALIS_API_RETRY_COUNT = 3;
export const UNIVERSALIS_API_RETRY_DELAY = 1000; // milliseconds

/**
 * API caching and rate limiting
 */
export const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const API_DEBOUNCE_DELAY = 500; // milliseconds
export const API_CACHE_VERSION = '1.0.0'; // Increment to invalidate all cached data
export const API_MAX_RESPONSE_SIZE = 1024 * 1024; // 1 MB maximum response size
export const API_RATE_LIMIT_DELAY = 200; // milliseconds between requests

/**
 * The image-worker rejection contract: every message image-worker can send
 * back for a bad image must map to a reason here, and our own failures must
 * not. The strings are the ones `apps/image-worker/src/validators.ts`,
 * `index.ts` and `photon.ts` actually emit (not paraphrases).
 */
import { describe, it, expect } from 'vitest';
import { imageInputReason, isImageInputError } from './image-input-errors.js';

describe('imageInputReason', () => {
  it.each([
    ['Only HTTPS URLs are allowed', 'url'],
    ['Only Discord CDN URLs are allowed for security', 'url'],
    ['Private network access is not allowed', 'url'],
    ['Invalid URL format', 'url'],
    ['No image URL provided', 'url'],
    ['Redirect without Location header', 'url'],
    ['Unsafe redirect target: Private network access is not allowed', 'url'],
    ['Image too large. Maximum size is 10MB', 'too_large'],
    ['Image too large (9000x9000). Maximum dimension is 4096px', 'too_large'],
    ['Image has too many pixels (17MP). Maximum is 16MP', 'too_large'],
    ['Unsupported image format. Use PNG, JPEG, GIF, WebP, or BMP', 'format'],
    ['Unsupported image format or unreadable image dimensions', 'format'],
    ['Image has invalid dimensions', 'format'],
    ['Failed to load image: corrupt PNG', 'format'],
    ['Image fetch timed out', 'timeout'],
    ['Failed to fetch image: HTTP 403', 'fetch'],
  ] as const)('%s → %s', (message, reason) => {
    expect(imageInputReason(new Error(message))).toBe(reason);
    expect(isImageInputError(new Error(message))).toBe(true);
  });

  it.each([
    'Image processing failed',
    'Image processing failed: HTTP 500',
    'IMAGE_WORKER binding is not configured',
    'Invalid JSON body',
    'Invalid maxDimension: expected an integer between 16 and 4096',
    'Failed to initialize SVG renderer: wasm',
    'fetch timeout', // the old marker — image-worker says "timed out"
    'SSRF blocked', // never emitted by image-worker
  ])('our own failure "%s" is not an input error', (message) => {
    expect(imageInputReason(new Error(message))).toBeNull();
    expect(isImageInputError(new Error(message))).toBe(false);
  });

  it('ignores non-Error values', () => {
    expect(imageInputReason('Image too large')).toBeNull();
    expect(isImageInputError(undefined)).toBe(false);
  });
});

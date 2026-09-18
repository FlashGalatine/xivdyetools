/**
 * Magic-byte sniffer parity tests (REFACTOR-008).
 *
 * The `detectImageFormat` block is ported from
 * `apps/image-worker/src/validators.test.ts`, which is the source of truth for
 * the table; the `sniffImageType` block covers the convenience wrapper
 * `apps/presets-api` adopts in Sprint 16, whose old three-format copy this
 * replaces.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import { detectImageFormat, sniffImageType, IMAGE_MAGIC_BYTES } from './index.js';
import type { ImageFormat } from './index.js';

/** Pad a header out to the 12 bytes every decision requires. */
function header(...bytes: number[]): Uint8Array {
  const out = new Uint8Array(12);
  out.set(bytes.slice(0, 12));
  return out;
}

const PNG = header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = header(0xff, 0xd8, 0xff, 0xe0);
const GIF = header(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const WEBP = header(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const BMP = header(0x42, 0x4d);

const SAMPLES: ReadonlyArray<readonly [ImageFormat, Uint8Array]> = [
  ['png', PNG],
  ['jpeg', JPEG],
  ['gif', GIF],
  ['webp', WEBP],
  ['bmp', BMP],
];

describe('IMAGE_MAGIC_BYTES', () => {
  it('carries image-worker’s table verbatim', () => {
    expect(IMAGE_MAGIC_BYTES).toEqual({
      png: [0x89, 0x50, 0x4e, 0x47],
      jpeg: [0xff, 0xd8, 0xff],
      gif: [0x47, 0x49, 0x46],
      webp: [0x52, 0x49, 0x46, 0x46],
      bmp: [0x42, 0x4d],
    });
  });

  it('has an entry for every format the type admits', () => {
    expect(Object.keys(IMAGE_MAGIC_BYTES).sort()).toEqual(['bmp', 'gif', 'jpeg', 'png', 'webp']);
  });
});

describe('detectImageFormat', () => {
  it('detects PNG', () => {
    expect(detectImageFormat(PNG)).toBe('png');
  });

  it('detects JPEG', () => {
    expect(detectImageFormat(JPEG)).toBe('jpeg');
  });

  it('detects GIF', () => {
    expect(detectImageFormat(GIF)).toBe('gif');
  });

  it('detects WebP', () => {
    expect(detectImageFormat(WEBP)).toBe('webp');
  });

  it('detects BMP', () => {
    expect(detectImageFormat(BMP)).toBe('bmp');
  });

  it('does not take a RIFF/AVI container for WebP', () => {
    const avi = header(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20);
    expect(detectImageFormat(avi)).toBeUndefined();
  });

  it('does not take a RIFF/WAVE container for WebP', () => {
    const wav = header(0x52, 0x49, 0x46, 0x46, 0x24, 0x08, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45);
    expect(detectImageFormat(wav)).toBeUndefined();
  });

  it('returns undefined for an unrecognised header', () => {
    expect(detectImageFormat(header(0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07))).toBeUndefined();
  });

  it('returns undefined for 11 bytes even when they are a valid PNG header', () => {
    expect(detectImageFormat(PNG.slice(0, 11))).toBeUndefined();
    expect(detectImageFormat(PNG.slice(0, 12))).toBe('png');
  });

  it('returns undefined for a 3-byte buffer', () => {
    expect(detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e]))).toBeUndefined();
  });

  it('ignores trailing bytes beyond the header', () => {
    const long = new Uint8Array(4096);
    long.set(PNG.slice(0, 8));
    expect(detectImageFormat(long)).toBe('png');
  });
});

describe('sniffImageType', () => {
  it.each(SAMPLES)('returns %s when no accept list is given', (format, bytes) => {
    expect(sniffImageType(bytes)).toBe(format);
  });

  it('returns null instead of undefined for an unrecognised header', () => {
    expect(sniffImageType(header(0x00, 0x01, 0x02, 0x03))).toBeNull();
  });

  it('returns null for a buffer shorter than 12 bytes', () => {
    expect(sniffImageType(PNG.slice(0, 11))).toBeNull();
  });

  it('returns a detected format that is on the accept list', () => {
    expect(sniffImageType(PNG, ['png', 'jpeg', 'webp'])).toBe('png');
    expect(sniffImageType(JPEG, ['png', 'jpeg', 'webp'])).toBe('jpeg');
    expect(sniffImageType(WEBP, ['png', 'jpeg', 'webp'])).toBe('webp');
  });

  it('returns null for a valid image whose format is not on the accept list', () => {
    // presets-api's pre-existing sniffer knew only these three, so GIF and BMP
    // must keep reading as "not an accepted image" there (REFACTOR-008).
    expect(sniffImageType(GIF, ['png', 'jpeg', 'webp'])).toBeNull();
    expect(sniffImageType(BMP, ['png', 'jpeg', 'webp'])).toBeNull();
  });

  it('accepts an empty list as "nothing is acceptable"', () => {
    expect(sniffImageType(PNG, [])).toBeNull();
  });

  it('narrows the return type to the accept list', () => {
    const accepted: 'png' | 'jpeg' | 'webp' | null = sniffImageType(PNG, [
      'png',
      'jpeg',
      'webp',
    ] as const);
    expect(accepted).toBe('png');
  });

  it('types the no-accept call as ImageFormat | null, not a narrowed literal', () => {
    // Type-only assertion (no runtime effect): before the two-overload fix, a
    // caller could write `sniffImageType<'png'>(bytes)` with no `accept` list
    // and the return type would be inferred/asserted as `'png' | null` for a
    // buffer that was actually a JPEG — the `format as T` cast had nothing to
    // check it against. With two overloads, the no-`accept` call only ever
    // resolves to the first (unparameterized) signature.
    expectTypeOf(sniffImageType(PNG)).toEqualTypeOf<ImageFormat | null>();

    // The `accept`-bearing overload still narrows to the supplied list.
    expectTypeOf(sniffImageType(PNG, ['png', 'jpeg'] as const)).toEqualTypeOf<
      'png' | 'jpeg' | null
    >();
  });
});

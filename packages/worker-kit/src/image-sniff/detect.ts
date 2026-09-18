/**
 * Magic-byte image format detection.
 *
 * REFACTOR-008 (docs/audits/2026-09-16-deep-dive): the table and the decision
 * order below are `apps/image-worker/src/validators.ts`'s, which is the source
 * of truth — `apps/presets-api`'s second copy recognised only three of the five
 * formats. The declared `Content-Type` is a hint, never the decision: a PNG
 * header on a 300 MB archive is the oldest trick there is, and a browser will
 * happily label anything `image/png`.
 *
 * @module
 */

/** Image container formats this sniffer can identify. */
export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp';

/**
 * Leading bytes that identify each format.
 *
 * `webp` is the RIFF container prefix only — RIFF is shared with WAV and AVI,
 * so the four `WEBP` bytes at offset 8 are checked separately.
 */
export const IMAGE_MAGIC_BYTES: Readonly<Record<ImageFormat, readonly number[]>> = {
  png: [0x89, 0x50, 0x4e, 0x47], // \x89PNG
  jpeg: [0xff, 0xd8, 0xff], // \xFF\xD8\xFF
  gif: [0x47, 0x49, 0x46], // GIF
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF (WEBP is checked at offset 8)
  bmp: [0x42, 0x4d], // BM
};

/**
 * Bytes required before any decision is made.
 *
 * Twelve, not four: the WebP check reads offsets 8–11, and a short buffer that
 * happened to start with `RIFF` would otherwise be decided on absent bytes.
 * Every format is held to the same precondition so the answer never depends on
 * how much of the file the caller happened to read.
 */
const MIN_SNIFF_BYTES = 12;

/** True when `bytes` starts with `magic`. */
function matchesMagicBytes(bytes: Uint8Array, magic: readonly number[]): boolean {
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Identify an image by its leading bytes.
 *
 * @param bytes - The first 12 or more bytes of the file
 * @returns The detected format, or `undefined` for anything else (including a
 *   buffer shorter than 12 bytes, and a RIFF container that is not WebP)
 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | undefined {
  if (bytes.length < MIN_SNIFF_BYTES) {
    return undefined;
  }

  if (matchesMagicBytes(bytes, IMAGE_MAGIC_BYTES.png)) {
    return 'png';
  }

  if (matchesMagicBytes(bytes, IMAGE_MAGIC_BYTES.jpeg)) {
    return 'jpeg';
  }

  if (matchesMagicBytes(bytes, IMAGE_MAGIC_BYTES.gif)) {
    return 'gif';
  }

  // RIFF....WEBP — the container alone is not enough, WAV and AVI share it.
  if (
    matchesMagicBytes(bytes, IMAGE_MAGIC_BYTES.webp) &&
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'webp';
  }

  if (matchesMagicBytes(bytes, IMAGE_MAGIC_BYTES.bmp)) {
    return 'bmp';
  }

  return undefined;
}

/**
 * Identify an image and narrow the answer to the formats a caller accepts.
 *
 * A convenience over the detector for the common case of a route that stores
 * or re-encodes only some of the five: pass the accepted list and an
 * unsupported-but-valid image is reported the same way as an unrecognised one.
 *
 * @param bytes - The first 12 or more bytes of the file
 * @param accept - Formats the caller supports; every format when omitted
 * @returns The detected format when accepted, otherwise `null`
 */
export function sniffImageType<T extends ImageFormat = ImageFormat>(
  bytes: Uint8Array,
  accept?: readonly T[]
): T | null {
  const format = detectImageFormat(bytes);
  if (format === undefined) {
    return null;
  }
  const narrowed = format as T;
  if (accept && !accept.includes(narrowed)) {
    return null;
  }
  return narrowed;
}

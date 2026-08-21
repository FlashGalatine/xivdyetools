/**
 * Header-only image dimension parsing.
 *
 * FINDING-004 (2026-08-21 security audit): `PhotonImage.new_from_byteslice`
 * decodes the entire image to RGBA before any size check could run, so a
 * small decompression bomb (a few MB that decode to gigabytes) killed the
 * isolate. These parsers read ONLY the container header — PNG IHDR, JPEG SOFn,
 * GIF logical screen, WebP VP8/VP8L/VP8X, BMP info header — so the decode path
 * can reject oversized images before allocating a pixel buffer.
 *
 * Every parser returns `undefined` (never throws) for input it cannot read;
 * the caller treats that as a rejection (fail closed).
 *
 * @module dimensions
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

function u16be(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1];
}
function u32be(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
}
function u16le(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8);
}
function u24le(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
}
function u32le(b: Uint8Array, i: number): number {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}
function tag(b: Uint8Array, i: number, s: string): boolean {
  if (b.length < i + s.length) return false;
  for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false;
  return true;
}
function ok(width: number, height: number): ImageDimensions | undefined {
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function readPng(b: Uint8Array): ImageDimensions | undefined {
  // signature(8) + length(4) + 'IHDR'(4) + width(4) + height(4)
  if (b.length < 24 || !tag(b, 12, 'IHDR')) return undefined;
  return ok(u32be(b, 16), u32be(b, 20));
}

function readJpeg(b: Uint8Array): ImageDimensions | undefined {
  let i = 2; // after SOI
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return undefined;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // Standalone markers (no length): RSTn, TEM, SOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8) {
      i += 2;
      continue;
    }
    // EOI or start of scan before any SOF → no dimensions available
    if (marker === 0xd9 || marker === 0xda) return undefined;
    const segLen = u16be(b, i + 2);
    if (segLen < 2) return undefined;
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 9 > b.length) return undefined;
      // precision(1) height(2) width(2)
      return ok(u16be(b, i + 7), u16be(b, i + 5));
    }
    i += 2 + segLen;
  }
  return undefined;
}

function readGif(b: Uint8Array): ImageDimensions | undefined {
  if (b.length < 10) return undefined;
  return ok(u16le(b, 6), u16le(b, 8));
}

function readBmp(b: Uint8Array): ImageDimensions | undefined {
  if (b.length < 26) return undefined;
  const w = u32le(b, 18) | 0; // signed
  const h = u32le(b, 22) | 0; // negative height = top-down bitmap
  return ok(Math.abs(w), Math.abs(h));
}

function readWebp(b: Uint8Array): ImageDimensions | undefined {
  if (b.length < 16 || !tag(b, 8, 'WEBP')) return undefined;
  if (tag(b, 12, 'VP8 ')) {
    // frame tag(3) + start code 9d 01 2a + width(2, 14 bits) + height(2, 14 bits)
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return undefined;
    return ok(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  if (tag(b, 12, 'VP8L')) {
    if (b.length < 25 || b[20] !== 0x2f) return undefined;
    const bits = u32le(b, 21);
    return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (tag(b, 12, 'VP8X')) {
    // flags(1) reserved(3) canvas width-1 (3) canvas height-1 (3)
    if (b.length < 30) return undefined;
    return ok(u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return undefined;
}

/**
 * Read width × height from an image file's container header without decoding.
 *
 * @returns the dimensions, or `undefined` if the format is unknown, the
 * header is truncated, or the dimensions are not where the format says they
 * are — callers must treat `undefined` as "reject".
 */
export function readImageDimensions(buffer: Uint8Array): ImageDimensions | undefined {
  const b = buffer;
  if (b.length < 12) return undefined;
  try {
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return readPng(b);
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return readJpeg(b);
    if (tag(b, 0, 'GIF8')) return readGif(b);
    if (tag(b, 0, 'RIFF')) return readWebp(b);
    if (b[0] === 0x42 && b[1] === 0x4d) return readBmp(b);
  } catch {
    return undefined;
  }
  return undefined;
}

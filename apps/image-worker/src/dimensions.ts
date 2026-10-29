/**
 * Header-only image dimension parsing.
 *
 * FINDING-004 (2026-08-21 security audit): `PhotonImage.new_from_byteslice`
 * decodes the entire image to RGBA before any size check could run, so a
 * small decompression bomb (a few MB that decode to gigabytes) killed the
 * isolate. These parsers read metadata without decoding pixels. GIF image
 * descriptors and WebP bitstreams must fit their checked canvas: the decoder
 * can allocate their buffers before applying its own generic size limits.
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
  // Require the complete signature and IHDR (13 data bytes plus CRC).
  if (
    b.length < 33 || !tag(b, 0, '\x89PNG\r\n\x1a\n') ||
    u32be(b, 8) !== 13 || !tag(b, 12, 'IHDR')
  ) return undefined;

  // FINDING-020: 16-bit decode needs larger intermediate pixel buffers than
  // the RGBA8 memory budget allows. Refuse it before Photon allocates them.
  const depth = b[24];
  const color = b[25];
  const subByteDepth = depth === 1 || depth === 2 || depth === 4;
  const supportedDepthAndColor =
    ((color === 0 || color === 3) && (subByteDepth || depth === 8)) ||
    ((color === 2 || color === 4 || color === 6) && depth === 8);
  if (!supportedDepthAndColor || b[26] !== 0 || b[27] !== 0 || b[28] > 1) return undefined;
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
  if (b.length < 13 || (!tag(b, 0, 'GIF87a') && !tag(b, 0, 'GIF89a'))) return undefined;
  const canvas = ok(u16le(b, 6), u16le(b, 8));
  if (!canvas) return undefined;
  let i = 13 + ((b[10] & 0x80) ? 3 * (2 << (b[10] & 7)) : 0);
  let seenImage = false;
  while (i < b.length) {
    const block = b[i++];
    if (block === 0x3b) return seenImage && i === b.length ? canvas : undefined;
    if (block === 0x21) {
      if (i >= b.length) return undefined;
      i++; // extension label; its contents are length-delimited sub-blocks
    } else if (block === 0x2c) {
      if (i + 9 > b.length) return undefined;
      const x = u16le(b, i);
      const y = u16le(b, i + 2);
      const width = u16le(b, i + 4);
      const height = u16le(b, i + 6);
      // GIF89a section 20 requires each image to fit the logical screen.
      // This permits smaller frames and offsets while bounding every decoder
      // frame allocation by the canvas that validators.ts caps.
      if (!width || !height || x + width > canvas.width || y + height > canvas.height) return undefined;
      const packed = b[i + 8];
      i += 9 + ((packed & 0x80) ? 3 * (2 << (packed & 7)) : 0);
      if (i >= b.length || b[i] < 2 || b[i] > 8) return undefined;
      i++; // LZW minimum code size; no compressed bytes are interpreted
      seenImage = true;
    } else {
      return undefined;
    }
    // Skip image data or extension sub-blocks without searching compressed
    // bytes for separators (which may also occur inside those bytes).
    for (;;) {
      if (i >= b.length) return undefined;
      const length = b[i++];
      if (length === 0) break;
      if (length > b.length - i) return undefined;
      i += length;
    }
  }
  return undefined;
}

function readBmp(b: Uint8Array): ImageDimensions | undefined {
  if (b.length < 26) return undefined;
  const w = u32le(b, 18) | 0; // signed
  const h = u32le(b, 22) | 0; // negative height = top-down bitmap
  return ok(Math.abs(w), Math.abs(h));
}

interface WebpChunk {
  data: number;
  end: number;
  next: number;
}

function webpChunk(b: Uint8Array, i: number, end: number): WebpChunk | undefined {
  if (end - i < 8) return undefined;
  const length = u32le(b, i + 4);
  const data = i + 8;
  if (length > end - data) return undefined;
  const dataEnd = data + length;
  const next = dataEnd + (length & 1);
  if (next > end || ((length & 1) && b[dataEnd] !== 0)) return undefined;
  return { data, end: dataEnd, next };
}

function webpBitstream(b: Uint8Array, i: number, chunk: WebpChunk): ImageDimensions | undefined {
  const p = chunk.data;
  if (tag(b, i, 'VP8 ')) {
    // frame tag(3) + start code 9d 01 2a + width(2, 14 bits) + height(2, 14 bits)
    if (chunk.end - p < 10 || (b[p] & 1) || !tag(b, p + 3, '\x9d\x01\x2a')) return undefined;
    return ok(u16le(b, p + 6) & 0x3fff, u16le(b, p + 8) & 0x3fff);
  }
  if (tag(b, i, 'VP8L')) {
    if (chunk.end - p < 5 || b[p] !== 0x2f) return undefined;
    const bits = u32le(b, p + 1);
    if (bits >>> 29) return undefined; // unsupported lossless version
    return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  return undefined;
}

function webpAlpha(b: Uint8Array, chunk: WebpChunk, dimensions: ImageDimensions): boolean {
  const header = b[chunk.data];
  if (chunk.end - chunk.data < 2 || (header & 0xc0) || (header & 3) > 1 || ((header >>> 4) & 3) > 1) return false;
  // Compressed ALPH uses implicit frame dimensions; uncompressed ALPH is one
  // byte per pixel. Neither has another independently sized pixel canvas.
  return (header & 3) === 1 || chunk.end - chunk.data === 1 + dimensions.width * dimensions.height;
}

function sameDimensions(a: ImageDimensions, b: ImageDimensions): boolean {
  return a.width === b.width && a.height === b.height;
}

function webpFrame(b: Uint8Array, chunk: WebpChunk, canvas: ImageDimensions): boolean {
  const p = chunk.data;
  if (chunk.end - p < 16) return false;
  const frame = { width: u24le(b, p + 6) + 1, height: u24le(b, p + 9) + 1 };
  if (2 * u24le(b, p) + frame.width > canvas.width ||
      2 * u24le(b, p + 3) + frame.height > canvas.height) return false;
  let alpha = false;
  let image = false;
  for (let i = p + 16; i < chunk.end;) {
    const sub = webpChunk(b, i, chunk.end);
    if (!sub) return false;
    if (tag(b, i, 'ALPH')) {
      if (alpha || image || !webpAlpha(b, sub, frame) || !tag(b, sub.next, 'VP8 ')) return false;
      alpha = true;
    } else if (tag(b, i, 'VP8 ') || tag(b, i, 'VP8L')) {
      const dimensions = webpBitstream(b, i, sub);
      if (image || !dimensions || !sameDimensions(dimensions, frame) || (alpha && tag(b, i, 'VP8L'))) return false;
      image = true;
    } else if (tag(b, i, 'VP8X') || tag(b, i, 'ANIM') || tag(b, i, 'ANMF')) {
      return false;
    }
    i = sub.next;
  }
  return image;
}

function readWebp(b: Uint8Array): ImageDimensions | undefined {
  if (b.length < 20 || !tag(b, 8, 'WEBP') || u32le(b, 4) !== b.length - 8) return undefined;
  let canvas: ImageDimensions | undefined;
  let extended = false;
  let animated = false;
  let animationHeader = false;
  let frame = false;
  let image = false;
  let alpha = false;
  for (let i = 12; i < b.length;) {
    const chunk = webpChunk(b, i, b.length);
    if (!chunk) return undefined;
    if (i === 12 && tag(b, i, 'VP8X')) {
      if (chunk.end - chunk.data !== 10) return undefined;
      extended = true;
      animated = (b[chunk.data] & 2) !== 0;
      canvas = ok(u24le(b, chunk.data + 4) + 1, u24le(b, chunk.data + 7) + 1);
    } else if (tag(b, i, 'ANIM')) {
      if (!animated || animationHeader || frame || image || chunk.end - chunk.data !== 6) return undefined;
      animationHeader = true;
    } else if (tag(b, i, 'ANMF')) {
      // image-0.24 can retain a decoded static payload AND its first animated
      // frame while scanning. Refuse the malformed mixture in either order.
      if (!animated || !animationHeader || image || !canvas || !webpFrame(b, chunk, canvas)) return undefined;
      frame = true;
    } else if (tag(b, i, 'ALPH')) {
      if (!extended || animated || alpha || image || !canvas || !webpAlpha(b, chunk, canvas) ||
          !tag(b, chunk.next, 'VP8 ')) return undefined;
      alpha = true;
    } else if (tag(b, i, 'VP8 ') || tag(b, i, 'VP8L')) {
      const dimensions = webpBitstream(b, i, chunk);
      if (animated || image || !dimensions || (alpha && tag(b, i, 'VP8L'))) return undefined;
      if (canvas && !sameDimensions(dimensions, canvas)) return undefined;
      canvas = dimensions;
      image = true;
    } else if (tag(b, i, 'VP8X') || i === 12) {
      return undefined;
    }
    i = chunk.next;
  }
  if (animated ? animationHeader && frame && !image : image) return canvas;
  return undefined;
}

/**
 * Read canvas dimensions and validate allocation-bearing metadata without
 * decoding. GIF descriptors must fit the logical screen; WebP bitstreams must
 * match their static canvas or contained animation frame. Thus the caller's
 * canvas caps also bound every independently declared frame dimension.
 *
 * @returns the dimensions, or `undefined` if the format is unknown, the
 * metadata is truncated, or the dimensions are not where the format says they
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

/**
 * Header-only image dimension parsing (FINDING-004, 2026-08-21 audit).
 *
 * The decode path must know width × height BEFORE handing bytes to photon, so
 * a decompression bomb (a few MB that decode to gigabytes of RGBA) is rejected
 * without ever allocating the pixel buffer. These parsers read container
 * headers only and never decode image data.
 */
import { describe, it, expect } from 'vitest';
import { readImageDimensions } from './dimensions.js';

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
function u16be(n: number): number[] {
  return [(n >>> 8) & 0xff, n & 0xff];
}
function u16le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function u32le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

export function pngHeader(width: number, height: number, bitDepth = 8, colorType = 6): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
    ...u32be(13), ...ascii('IHDR'), ...u32be(width), ...u32be(height),
    bitDepth, colorType, 0, 0, 0, // bit depth, colour type, compression, filter, interlace
    0, 0, 0, 0, // crc (unchecked)
  ]);
}

function jpegHeader(width: number, height: number, opts: { progressive?: boolean; app1?: boolean } = {}): Uint8Array {
  const sof = opts.progressive ? 0xc2 : 0xc0;
  const segments: number[] = [0xff, 0xd8];
  // APP0 JFIF
  const app0 = [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  segments.push(0xff, 0xe0, ...u16be(app0.length + 2), ...app0);
  if (opts.app1) {
    // a fat APP1 (EXIF) segment before SOF, as cameras emit
    const exif = new Array(300).fill(0);
    segments.push(0xff, 0xe1, ...u16be(exif.length + 2), ...exif);
  }
  // DQT (skipped by the parser)
  const dqt = new Array(65).fill(1);
  segments.push(0xff, 0xdb, ...u16be(dqt.length + 2), ...dqt);
  // SOFn: length, precision, height, width, components
  const sofBody = [8, ...u16be(height), ...u16be(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  segments.push(0xff, sof, ...u16be(sofBody.length + 2), ...sofBody);
  segments.push(0xff, 0xda, 0, 2); // SOS (truncated — parser must have stopped by now)
  return new Uint8Array(segments);
}

function gifFrame(width: number, height: number, x = 0, y = 0): number[] {
  return [0x2c, ...u16le(x), ...u16le(y), ...u16le(width), ...u16le(height), 0,
    2, 2, 0x44, 0x01, 0]; // minimal LZW sub-block; metadata tests never decode
}

function gifHeader(width: number, height: number, frames = gifFrame(width, height)): Uint8Array {
  return new Uint8Array([...ascii('GIF89a'), ...u16le(width), ...u16le(height),
    0x80, 0, 0, 0, 0, 0, 255, 255, 255, ...frames, 0x3b]);
}

function bmpHeader(width: number, height: number): Uint8Array {
  const b = new Array(30).fill(0);
  b[0] = 0x42; b[1] = 0x4d; // BM
  b.splice(18, 4, ...u32le(width));
  b.splice(22, 4, ...u32le(height >>> 0));
  return new Uint8Array(b);
}

function webpVp8(width: number, height: number): Uint8Array {
  // RIFF size WEBP 'VP8 ' size | frame tag(3) start code(3) width(2) height(2)
  const payload = [0x9d, 0x01, 0x2a, ...u16le(width & 0x3fff), ...u16le(height & 0x3fff)];
  const chunk = [...ascii('VP8 '), ...u32le(payload.length + 3), 0, 0, 0, ...payload];
  return new Uint8Array([...ascii('RIFF'), ...u32le(chunk.length + 4), ...ascii('WEBP'), ...chunk]);
}

function webpVp8l(width: number, height: number): Uint8Array {
  // signature 0x2f then 14 bits width-1, 14 bits height-1 (little-endian bitstream)
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  const payload = [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff];
  const chunk = webpChunk('VP8L', payload);
  return new Uint8Array([...ascii('RIFF'), ...u32le(chunk.length + 4), ...ascii('WEBP'), ...chunk]);
}

function webpChunk(name: string, payload: number[]): number[] {
  return [...ascii(name), ...u32le(payload.length), ...payload, ...(payload.length % 2 ? [0] : [])];
}

function webpExtended(width: number, height: number, chunks: number[], animated = false): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  const payload = [animated ? 2 : 0, 0, 0, 0, w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff];
  const chunk = [...webpChunk('VP8X', payload), ...chunks];
  return new Uint8Array([...ascii('RIFF'), ...u32le(chunk.length + 4), ...ascii('WEBP'), ...chunk]);
}

function webpVp8x(width: number, height: number): Uint8Array {
  return webpExtended(width, height, [...webpVp8l(width, height).subarray(12)]);
}

function webpFrame(width: number, height: number, payload: number[], x = 0, y = 0): number[] {
  const u24 = (n: number): number[] => u32le(n).slice(0, 3);
  return webpChunk('ANMF', [...u24(x / 2), ...u24(y / 2), ...u24(width - 1),
    ...u24(height - 1), 10, 0, 0, 0, ...payload]);
}

function animatedWebp(frames: number[], width = 64, height = 64): Uint8Array {
  return webpExtended(width, height, [...webpChunk('ANIM', [0, 0, 0, 0, 0, 0]), ...frames], true);
}

describe('readImageDimensions', () => {
  it('reads PNG IHDR', () => {
    expect(readImageDimensions(pngHeader(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readImageDimensions(pngHeader(20000, 20000))).toEqual({ width: 20000, height: 20000 });
  });

  it.each([
    [1, 0], [2, 0], [4, 0], [8, 0], [8, 2],
    [1, 3], [2, 3], [4, 3], [8, 3], [8, 4], [8, 6],
  ])('reads supported PNG depth %i / color type %i', (depth, color) => {
    expect(readImageDimensions(pngHeader(640, 480, depth, color))).toEqual({ width: 640, height: 480 });
  });

  it.each([0, 2, 4, 6])('refuses 16-bit PNG color type %i even at small dimensions', (color) => {
    expect(readImageDimensions(pngHeader(1, 1, 16, color))).toBeUndefined();
    expect(readImageDimensions(pngHeader(3072, 3072, 16, color))).toBeUndefined();
  });

  it.each([
    [0, 0], [3, 0], [32, 0], [1, 2], [2, 2], [4, 2],
    [16, 3], [1, 4], [2, 4], [4, 4], [1, 6], [2, 6], [4, 6],
    [8, 1], [8, 5], [8, 7], [8, 255],
  ])('refuses illegal PNG depth %i / color type %i', (depth, color) => {
    expect(readImageDimensions(pngHeader(640, 480, depth, color))).toBeUndefined();
  });

  it.each([24, 25, 26, 28, 29, 32])('refuses an incomplete %i-byte PNG IHDR', (length) => {
    expect(readImageDimensions(pngHeader(640, 480).subarray(0, length))).toBeUndefined();
  });

  it.each([
    [4, 0], // complete PNG signature required
    [11, 12], [11, 14], // IHDR payload length must be 13
    [12, 0], // IHDR must be the first chunk
    [26, 1], // unsupported compression method
    [27, 1], // unsupported filter method
    [28, 2], // invalid interlace method
  ])('refuses malformed PNG metadata at byte %i', (offset, value) => {
    const header = pngHeader(640, 480);
    header[offset] = value;
    expect(readImageDimensions(header)).toBeUndefined();
  });

  it('reads an Adam7 PNG header', () => {
    const header = pngHeader(640, 480);
    header[28] = 1;
    expect(readImageDimensions(header)).toEqual({ width: 640, height: 480 });
  });

  it('reads baseline and progressive JPEG SOF, skipping APPn/DQT segments', () => {
    expect(readImageDimensions(jpegHeader(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(readImageDimensions(jpegHeader(300, 200, { progressive: true, app1: true }))).toEqual({
      width: 300,
      height: 200,
    });
  });

  it('reads GIF logical screen', () => {
    expect(readImageDimensions(gifHeader(320, 240))).toEqual({ width: 320, height: 240 });
  });

  it('reads BMP info header', () => {
    expect(readImageDimensions(bmpHeader(800, 600))).toEqual({ width: 800, height: 600 });
  });

  it('reads WebP VP8, VP8L and VP8X', () => {
    expect(readImageDimensions(webpVp8(500, 300))).toEqual({ width: 500, height: 300 });
    expect(readImageDimensions(webpVp8l(1000, 2000))).toEqual({ width: 1000, height: 2000 });
    expect(readImageDimensions(webpVp8x(16383, 16383))).toEqual({ width: 16383, height: 16383 });
  });

  it('rejects GIF descriptors outside the logical screen, including a later frame', () => {
    for (const frames of [gifFrame(64, 64), gifFrame(4097, 1),
      [...gifFrame(1, 1), ...gifFrame(64, 64)], gifFrame(1, 1, 1, 0)]) {
      expect(readImageDimensions(gifHeader(1, 1, frames))).toBeUndefined();
    }
  });

  it('preserves GIF animation with contained subframes and offsets', () => {
    const frames = [...gifFrame(32, 16, 32, 48), 0x21, 0xfe, 3, 0x2c, 0xff, 0x3b, 0,
      ...gifFrame(1, 1, 63, 63)];
    expect(readImageDimensions(gifHeader(64, 64, frames))).toEqual({ width: 64, height: 64 });
  });

  it('rejects incomplete GIF descriptors, palettes and sub-blocks', () => {
    const gif = gifHeader(64, 64);
    for (const length of [12, 18, 20, 28, 30, 32, gif.length - 1]) {
      expect(readImageDimensions(gif.subarray(0, length))).toBeUndefined();
    }
    const localPalette = gifHeader(64, 64);
    localPalette[28] = 0x87; // 256-entry local palette is absent
    expect(readImageDimensions(localPalette)).toBeUndefined();
  });

  it.each(['VP8 ', 'VP8L'])('rejects extended static %s dimensions that disagree with the canvas', (kind) => {
    const image = kind === 'VP8 ' ? webpVp8 : webpVp8l;
    for (const [w, h] of [[64, 64], [4097, 1], [1, 2]]) {
      expect(readImageDimensions(webpExtended(1, 1, [...image(w, h).subarray(12)]))).toBeUndefined();
    }
  });

  it('checks nested animation bitstreams, including ALPH + VP8 and later frames', () => {
    const lossless = [...webpVp8l(64, 64).subarray(12)];
    const lossyAlpha = [...webpChunk('ALPH', [1, 0]), ...webpVp8(64, 64).subarray(12)];
    for (const payload of [lossless, lossyAlpha]) {
      expect(readImageDimensions(animatedWebp(webpFrame(1, 1, payload)))).toBeUndefined();
      expect(readImageDimensions(animatedWebp([
        ...webpFrame(1, 1, [...webpVp8l(1, 1).subarray(12)]), ...webpFrame(1, 1, payload),
      ]))).toBeUndefined();
    }
  });

  it('preserves animated WebP subframes, offsets, padding and alpha', () => {
    const frames = [...webpFrame(32, 16, [...webpVp8l(32, 16).subarray(12)], 32, 48),
      ...webpFrame(1, 1, [...webpChunk('ALPH', [1, 0]), ...webpVp8(1, 1).subarray(12)], 62, 62)];
    expect(readImageDimensions(animatedWebp(frames))).toEqual({ width: 64, height: 64 });
  });

  it('rejects mixed or duplicate WebP allocation payloads in either order', () => {
    const staticChunk = [...webpVp8l(64, 64).subarray(12)];
    const frame = webpFrame(64, 64, staticChunk);
    expect(readImageDimensions(webpExtended(64, 64, [...staticChunk, ...staticChunk]))).toBeUndefined();
    for (const chunks of [[...frame, ...staticChunk], [...staticChunk, ...frame]]) {
      expect(readImageDimensions(animatedWebp(chunks))).toBeUndefined();
    }
    expect(readImageDimensions(animatedWebp(webpFrame(64, 64, [...staticChunk, ...staticChunk])))).toBeUndefined();
  });

  it('preserves matching static extended VP8 and both alpha encodings', () => {
    const lossy = [...webpVp8(1, 1).subarray(12)];
    for (const payload of [lossy, [...webpChunk('ALPH', [0, 255]), ...lossy],
      [...webpChunk('ALPH', [1, 0]), ...lossy]]) {
      expect(readImageDimensions(webpExtended(1, 1, payload))).toEqual({ width: 1, height: 1 });
    }
  });

  it('rejects alpha chunks with absent, duplicate, wrong-sized or lossless partners', () => {
    const alpha = webpChunk('ALPH', [0, 255]);
    const lossy = [...webpVp8(1, 1).subarray(12)];
    const lossless = [...webpVp8l(1, 1).subarray(12)];
    for (const payload of [alpha, [...alpha, ...alpha, ...lossy], [...lossy, ...alpha],
      [...alpha, ...lossless], [...webpChunk('ALPH', [0]), ...lossy],
      [...webpChunk('ALPH', [0, 255, 255]), ...lossy], [...webpChunk('ALPH', [2, 0]), ...lossy]]) {
      expect(readImageDimensions(webpExtended(1, 1, payload))).toBeUndefined();
      expect(readImageDimensions(animatedWebp(webpFrame(1, 1, payload)))).toBeUndefined();
    }
  });

  it('requires animation metadata and contained frame rectangles', () => {
    const bitstream = [...webpVp8l(32, 32).subarray(12)];
    const frame = webpFrame(32, 32, bitstream);
    expect(readImageDimensions(webpExtended(64, 64, frame, true))).toBeUndefined();
    expect(readImageDimensions(webpExtended(64, 64, frame))).toBeUndefined();
    expect(readImageDimensions(animatedWebp([]))).toBeUndefined();
    expect(readImageDimensions(animatedWebp([
      ...webpChunk('ANIM', [0, 0, 0, 0, 0, 0]), ...frame,
    ]))).toBeUndefined();
    expect(readImageDimensions(animatedWebp(webpFrame(32, 32, bitstream, 34, 0)))).toBeUndefined();
    expect(readImageDimensions(animatedWebp(webpFrame(32, 32, bitstream, 0, 34)))).toBeUndefined();
  });

  it('checks chunk-local payload lengths and ignores length-delimited metadata safely', () => {
    const lossless = [...webpVp8l(1, 1).subarray(12)];
    const metadata = webpChunk('EXIF', ascii('VP8L\xff\xff\xff\xff'));
    expect(readImageDimensions(webpExtended(1, 1, [...metadata, ...lossless])))
      .toEqual({ width: 1, height: 1 });
    for (const payload of [webpChunk('VP8L', [0x2f]), webpChunk('VP8 ', [0, 0, 0]),
      webpChunk('VP8L', [0x2f, 0, 0, 0, 0xe0])]) {
      expect(readImageDimensions(webpExtended(1, 1, payload))).toBeUndefined();
      expect(readImageDimensions(animatedWebp(webpFrame(1, 1, payload)))).toBeUndefined();
    }
  });

  it('rejects WebP chunk length, padding and nested truncation mutations', () => {
    const valid = webpVp8x(64, 64);
    for (const [offset, value] of [[4, 0], [16, 9], [34, 0xff], [43, 1]]) {
      const bad = valid.slice();
      bad[offset] = value;
      expect(readImageDimensions(bad)).toBeUndefined();
    }
    for (let length = 12; length < valid.length; length++) {
      expect(readImageDimensions(valid.subarray(0, length))).toBeUndefined();
    }
    const nested = animatedWebp(webpFrame(1, 1, [...webpVp8l(1, 1).subarray(12)]));
    nested[72] = 0xff; // nested VP8L chunk size escapes ANMF
    expect(readImageDimensions(nested)).toBeUndefined();
    const sibling = animatedWebp([
      ...webpFrame(1, 1, [...webpVp8l(1, 1).subarray(12)]), ...webpChunk('EXIF', [0, 0, 0, 0]),
    ]);
    sibling[72] = 8; // escapes ANMF but remains inside the outer RIFF
    expect(readImageDimensions(sibling)).toBeUndefined();
  });

  // User-visible tightening in 1.3.5 (CHANGELOG Security): 1.3.4 passed both shapes to Photon.
  it('refuses bytes after a GIF trailer', () => {
    expect(readImageDimensions(gifHeader(64, 64))).toEqual({ width: 64, height: 64 });
    expect(readImageDimensions(new Uint8Array([...gifHeader(64, 64), 0]))).toBeUndefined();
  });

  it('refuses data appended after the RIFF payload', () => {
    expect(readImageDimensions(webpVp8(64, 64))).toEqual({ width: 64, height: 64 });
    expect(readImageDimensions(new Uint8Array([...webpVp8(64, 64), 0, 0]))).toBeUndefined();
  });

  it('returns undefined for unknown or truncated input instead of throwing', () => {
    expect(readImageDimensions(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(readImageDimensions(pngHeader(10, 10).subarray(0, 20))).toBeUndefined();
    expect(readImageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBeUndefined();
    expect(readImageDimensions(new Uint8Array(0))).toBeUndefined();
  });
});

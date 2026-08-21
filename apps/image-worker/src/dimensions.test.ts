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

export function pngHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature
    ...u32be(13), ...ascii('IHDR'), ...u32be(width), ...u32be(height),
    8, 6, 0, 0, 0, // bit depth, colour type, compression, filter, interlace
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

function gifHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([...ascii('GIF89a'), ...u16le(width), ...u16le(height), 0, 0, 0, 0x2c]);
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
  const chunk = [...ascii('VP8L'), ...u32le(payload.length), ...payload];
  return new Uint8Array([...ascii('RIFF'), ...u32le(chunk.length + 4), ...ascii('WEBP'), ...chunk]);
}

function webpVp8x(width: number, height: number): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  const payload = [0, 0, 0, 0, w & 0xff, (w >>> 8) & 0xff, (w >>> 16) & 0xff, h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff];
  const chunk = [...ascii('VP8X'), ...u32le(payload.length), ...payload];
  return new Uint8Array([...ascii('RIFF'), ...u32le(chunk.length + 4), ...ascii('WEBP'), ...chunk]);
}

describe('readImageDimensions', () => {
  it('reads PNG IHDR', () => {
    expect(readImageDimensions(pngHeader(640, 480))).toEqual({ width: 640, height: 480 });
    expect(readImageDimensions(pngHeader(20000, 20000))).toEqual({ width: 20000, height: 20000 });
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

  it('returns undefined for unknown or truncated input instead of throwing', () => {
    expect(readImageDimensions(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(readImageDimensions(pngHeader(10, 10).subarray(0, 20))).toBeUndefined();
    expect(readImageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBeUndefined();
    expect(readImageDimensions(new Uint8Array(0))).toBeUndefined();
  });
});

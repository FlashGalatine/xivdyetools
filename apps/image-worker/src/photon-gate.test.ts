/**
 * Pre-decode dimension gate (FINDING-004, 2026-08-21 audit).
 *
 * `processImageForExtraction` / `processImageForThumbnail` must reject an
 * image whose container header declares more than MAX_IMAGE_DIMENSION per
 * side or MAX_PIXEL_COUNT pixels BEFORE `PhotonImage.new_from_byteslice`
 * runs — that call decodes to full RGBA and is what a decompression bomb kills.
 * `maxDimension` from the request must also be validated before use.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMockPhotonImage = (width = 100, height = 100) => ({
  get_width: () => width,
  get_height: () => height,
  get_raw_pixels: () => new Uint8Array([255, 0, 0, 255]),
  get_bytes: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  get_bytes_webp: () => new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  free: vi.fn(),
});
const mockImage = createMockPhotonImage();

vi.mock('@cf-wasm/photon', () => ({
  PhotonImage: { new_from_byteslice: vi.fn(() => mockImage) },
  SamplingFilter: { Lanczos3: 0 },
  resize: vi.fn(() => mockImage),
  crop: vi.fn(() => mockImage),
}));

import { PhotonImage } from '@cf-wasm/photon';
import { processImageForExtraction, processImageForThumbnail } from './photon.js';

/** Minimal PNG header (signature + IHDR) declaring width × height. */
function pngHeader(width: number, height: number): Uint8Array {
  const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32(13), 0x49, 0x48, 0x44, 0x52, ...u32(width), ...u32(height),
    8, 6, 0, 0, 0, 0, 0, 0, 0,
  ]);
}

describe('pre-decode dimension gate', () => {
  beforeEach(() => {
    vi.mocked(PhotonImage.new_from_byteslice).mockClear();
  });

  it('rejects an oversized PNG header before decoding (extraction)', async () => {
    await expect(processImageForExtraction(pngHeader(20000, 20000))).rejects.toThrow(/too large/);
    expect(PhotonImage.new_from_byteslice).not.toHaveBeenCalled();
  });

  it('rejects a pixel-count bomb (e.g. 4096x4097) before decoding (thumbnail)', () => {
    expect(() => processImageForThumbnail(pngHeader(4096, 4097))).toThrow(/too large|too many pixels/);
    expect(PhotonImage.new_from_byteslice).not.toHaveBeenCalled();
  });

  it('rejects input whose dimensions cannot be read instead of decoding blind', async () => {
    await expect(processImageForExtraction(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/format|dimensions/i);
    expect(PhotonImage.new_from_byteslice).not.toHaveBeenCalled();
  });

  it('still decodes an in-limit image', async () => {
    const result = await processImageForExtraction(pngHeader(640, 480));
    expect(result.width).toBe(100);
    // decode happened (loadImage; resizeImage's no-op copy path may call it again)
    expect(PhotonImage.new_from_byteslice).toHaveBeenCalled();
  });

  it('rejects an invalid maxDimension before decoding', async () => {
    for (const bad of [0, -5, 1.5, NaN, Infinity, 100000] as number[]) {
      await expect(processImageForExtraction(pngHeader(64, 64), { maxDimension: bad })).rejects.toThrow(
        /maxDimension/,
      );
    }
    expect(PhotonImage.new_from_byteslice).not.toHaveBeenCalled();
  });
});

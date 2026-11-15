/**
 * OPT-001 (2026-11-06 Rust-opportunities audit): the k-means assignment step
 * now accumulates per-cluster counts and sums instead of member arrays, and
 * ranks centroids by squared distance when every channel is a byte. Both are
 * meant to change nothing a caller can observe.
 *
 * This file pins that: `extractPalette` must return exactly what the previous
 * implementation (copied below as the oracle) returns for the same random
 * draws — same colors, same pixel counts, same dominance, same order, same
 * object shapes — on byte, fractional, out-of-range, tie-heavy, flat and
 * sampled inputs.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { RGB } from '@xivdyetools/types';
import { PaletteService, type ExtractedColor } from '../PaletteService.js';

// ---------------------------------------------------------------------------
// Seeded draws, shared by the service (through Math.random) and the oracle
// ---------------------------------------------------------------------------

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Oracle: the k-means as it stood before OPT-001, Math.random → `random`
// ---------------------------------------------------------------------------

function oracleDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function oracleMean(colors: RGB[]): RGB {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (const c of colors) {
    sumR += c.r;
    sumG += c.g;
    sumB += c.b;
  }
  return {
    r: Math.round(sumR / colors.length),
    g: Math.round(sumG / colors.length),
    b: Math.round(sumB / colors.length),
  };
}

function oracleInit(pixels: RGB[], k: number, random: () => number): RGB[] {
  const centroids: RGB[] = [{ ...pixels[Math.floor(random() * pixels.length)] }];
  const minDistances = new Array<number>(pixels.length);
  for (let j = 0; j < pixels.length; j++) minDistances[j] = oracleDistance(pixels[j], centroids[0]);
  for (let i = 1; i < k; i++) {
    let total = 0;
    for (let j = 0; j < pixels.length; j++) total += minDistances[j] * minDistances[j];
    let selected = 0;
    if (total === 0) {
      selected = Math.floor(random() * pixels.length);
    } else {
      let threshold = random() * total;
      for (let j = 0; j < pixels.length; j++) {
        threshold -= minDistances[j] * minDistances[j];
        if (threshold <= 0) {
          selected = j;
          break;
        }
      }
    }
    centroids.push({ ...pixels[selected] });
    const next = centroids[centroids.length - 1];
    for (let j = 0; j < pixels.length; j++) {
      const d = oracleDistance(pixels[j], next);
      if (d < minDistances[j]) minDistances[j] = d;
    }
  }
  return centroids;
}

function oracleAssign(pixels: RGB[], centroids: RGB[]): RGB[][] {
  const clusters: RGB[][] = centroids.map(() => []);
  for (const pixel of pixels) {
    let minDist = Infinity;
    let nearest = 0;
    for (let j = 0; j < centroids.length; j++) {
      const d = oracleDistance(pixel, centroids[j]);
      if (d < minDist) {
        minDist = d;
        nearest = j;
      }
    }
    clusters[nearest].push(pixel);
  }
  return clusters;
}

function oracleExtract(
  input: RGB[],
  colorCount: number,
  maxIterations: number,
  maxSamples: number,
  random: () => number,
): ExtractedColor[] {
  // samplePixels (unchanged by OPT-001)
  let pixels = input;
  if (input.length > maxSamples) {
    pixels = [];
    for (let i = 0; i < maxSamples; i++) {
      pixels.push(input[Math.round((i * (input.length - 1)) / (maxSamples - 1))]);
    }
  }

  // countDistinctColors (unchanged by OPT-001)
  const seen = new Set<string>();
  for (const p of pixels) {
    if (seen.size >= colorCount) break;
    seen.add(`${p.r},${p.g},${p.b}`);
  }

  let centroids = oracleInit(pixels, seen.size, random);
  for (let iter = 0; iter < maxIterations; iter++) {
    const clusters = oracleAssign(pixels, centroids);
    const next: RGB[] = [];
    let maxMovement = 0;
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length === 0) {
        next.push({ ...centroids[i] });
      } else {
        const mean = oracleMean(clusters[i]);
        const movement = oracleDistance(centroids[i], mean);
        if (movement > maxMovement) maxMovement = movement;
        next.push(mean);
      }
    }
    centroids = next;
    if (maxMovement < 1.0) break;
  }
  const sizes = oracleAssign(pixels, centroids).map((c) => c.length);

  // extractPalette's result shaping (unchanged by OPT-001)
  const total = sizes.reduce((sum, size) => sum + size, 0);
  return centroids
    .map((color, i) => ({
      color,
      dominance: total > 0 ? Math.round((sizes[i] / total) * 100) : 0,
      pixelCount: sizes[i],
    }))
    .filter((extracted) => extracted.pixelCount > 0)
    .sort((a, b) => b.dominance - a.dominance);
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function uniformBytes(n: number, seed: number): RGB[] {
  const r = lcg(seed);
  return Array.from({ length: n }, () => ({
    r: Math.floor(r() * 256),
    g: Math.floor(r() * 256),
    b: Math.floor(r() * 256),
  }));
}

/** Eight weighted color blobs plus 10% noise — a stand-in for a screenshot. */
function blobBytes(n: number, seed: number): RGB[] {
  const r = lcg(seed);
  const centres = Array.from({ length: 8 }, () => [r() * 255, r() * 255, r() * 255, 0.2 + r()]);
  const totalWeight = centres.reduce((sum, c) => sum + c[3], 0);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const jitter = () => (r() + r() + r() - 1.5) * 18;
  return Array.from({ length: n }, () => {
    if (r() < 0.1) {
      return { r: Math.floor(r() * 256), g: Math.floor(r() * 256), b: Math.floor(r() * 256) };
    }
    let t = r() * totalWeight;
    let centre = centres[0];
    for (const c of centres) {
      t -= c[3];
      if (t <= 0) {
        centre = c;
        break;
      }
    }
    return { r: clamp(centre[0] + jitter()), g: clamp(centre[1] + jitter()), b: clamp(centre[2] + jitter()) };
  });
}

function fractional(n: number, seed: number): RGB[] {
  const r = lcg(seed);
  return Array.from({ length: n }, () => ({ r: r() * 255, g: r() * 255, b: r() * 255 }));
}

/** Whole numbers outside 0-255, which must not take the byte path. */
function outOfRange(n: number, seed: number): RGB[] {
  const r = lcg(seed);
  return Array.from({ length: n }, () => ({
    r: Math.floor(r() * 600) - 150,
    g: Math.floor(r() * 600) - 150,
    b: Math.floor(r() * 600) - 150,
  }));
}

/**
 * A small lattice with every point duplicated many times: most pixels sit
 * exactly halfway between two candidate centroids, so the first-centroid-wins
 * tie rule decides their cluster on every pass.
 */
function tieLattice(): RGB[] {
  const out: RGB[] = [];
  for (let rep = 0; rep < 40; rep++) {
    for (let x = 0; x <= 40; x += 10) {
      for (let y = 0; y <= 40; y += 20) {
        out.push({ r: x, g: y, b: (x + y) % 30 });
      }
    }
  }
  return out;
}

const CASES: Array<{ name: string; pixels: RGB[] }> = [
  { name: 'uniform bytes', pixels: uniformBytes(4000, 1) },
  { name: 'clustered bytes', pixels: blobBytes(4000, 2) },
  { name: 'fractional channels', pixels: fractional(3000, 3) },
  { name: 'whole numbers outside 0-255', pixels: outOfRange(3000, 4) },
  { name: 'equidistant lattice (ties)', pixels: tieLattice() },
  {
    name: 'four flat colors',
    pixels: Array.from({ length: 2000 }, (_, i) =>
      [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }, { r: 128, g: 128, b: 128 }][i % 4],
    ),
  },
  {
    name: 'bytes with one fractional pixel',
    pixels: [...blobBytes(2000, 5), { r: 12.5, g: 40, b: 200 }],
  },
  { name: 'single pixel', pixels: [{ r: 10, g: 20, b: 30 }] },
];

const SEEDS = [11, 2026, 91403];

describe('PaletteService k-means parity with the pre-OPT-001 implementation', () => {
  const service = new PaletteService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function extractWithSeed(pixels: RGB[], seed: number, options: Required<Pick<Parameters<PaletteService['extractPalette']>[1] & object, 'colorCount' | 'maxIterations' | 'maxSamples'>>): ExtractedColor[] {
    vi.spyOn(Math, 'random').mockImplementation(lcg(seed));
    try {
      return service.extractPalette(pixels, options);
    } finally {
      vi.restoreAllMocks();
    }
  }

  for (const { name, pixels } of CASES) {
    for (const colorCount of [1, 4, 10]) {
      for (const maxIterations of [1, 25, 100]) {
        it(`${name}: ${colorCount} colors, ${maxIterations} iterations`, () => {
          for (const seed of SEEDS) {
            const options = { colorCount, maxIterations, maxSamples: 10000 };
            const expected = oracleExtract(pixels, colorCount, maxIterations, 10000, lcg(seed));
            expect(extractWithSeed(pixels, seed, options)).toEqual(expected);
          }
        });
      }
    }
  }

  it('matches through the sampling step (input larger than maxSamples)', () => {
    const pixels = blobBytes(12000, 6);
    for (const seed of SEEDS) {
      const expected = oracleExtract(pixels, 6, 25, 5000, lcg(seed));
      expect(extractWithSeed(pixels, seed, { colorCount: 6, maxIterations: 25, maxSamples: 5000 })).toEqual(expected);
    }
  });

  it('keeps the object shape of a centroid that never received pixels', () => {
    // Pixels carrying an extra field: k-means++ copies whole pixel objects, and
    // a centroid left empty keeps that copy. The oracle and the service must
    // agree on those objects too, not just on r/g/b.
    const pixels = blobBytes(1500, 7).map((p, i) => ({ ...p, a: i % 2 === 0 ? 255 : 254 }));
    for (const seed of SEEDS) {
      const expected = oracleExtract(pixels, 10, 3, 10000, lcg(seed));
      expect(extractWithSeed(pixels, seed, { colorCount: 10, maxIterations: 3, maxSamples: 10000 })).toStrictEqual(expected);
    }
  });

  it('skips the square root in the assignment step only for byte input', () => {
    const n = 1000;
    const k = 4;
    // One Lloyd pass plus the final count pass = 2·n·k assignment distances.
    const assignmentDistances = 2 * n * k;

    const sqrtFor = (pixels: RGB[]): number => {
      vi.spyOn(Math, 'random').mockImplementation(lcg(5));
      const sqrt = vi.spyOn(Math, 'sqrt');
      try {
        service.extractPalette(pixels, { colorCount: k, maxIterations: 1, maxSamples: 10000 });
        return sqrt.mock.calls.length;
      } finally {
        vi.restoreAllMocks();
      }
    };

    // k-means++ and centroid movement still take square roots (about n·k),
    // but byte input must not add the assignment step's 2·n·k on top.
    expect(sqrtFor(uniformBytes(n, 8))).toBeLessThan(assignmentDistances);
    expect(sqrtFor(fractional(n, 8))).toBeGreaterThanOrEqual(assignmentDistances);
  });
});

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const repo = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const core = await import(pathToFileURL(resolve(repo, 'packages/core/dist/index.js')));
const { PaletteService, DyeService, dyeDatabase, ColorService } = core;
const palette = new PaletteService();
const dyes = new DyeService(dyeDatabase);

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pixels(count) {
  const random = randomGenerator(20261106);
  return Array.from({ length: count }, () => ({
    r: Math.floor(random() * 256),
    g: Math.floor(random() * 256),
    b: Math.floor(random() * 256),
  }));
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    minMs: sorted[0],
    maxMs: sorted.at(-1),
  };
}

const results = [];
function measure(name, operation, validate, parameters) {
  const samples = [];
  const originalRandom = Math.random;
  try {
    for (let iteration = 0; iteration < 35; iteration++) {
      Math.random = randomGenerator(91403);
      const start = performance.now();
      const value = operation();
      const elapsed = performance.now() - start;
      validate(value);
      if (iteration >= 5) samples.push(elapsed);
    }
  } finally {
    Math.random = originalRandom;
  }
  results.push({ name, parameters, ...summarize(samples), samplesMs: samples });
}

const source10k = pixels(10000);
const source65k = pixels(65536);
const source100k = pixels(100000);
const fourColors = Array.from({ length: 10000 }, (_, i) =>
  [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 }, { r: 128, g: 128, b: 128 }][i % 4]);

for (const [name, source, options] of [
  ['palette-10k-k4-default', source10k, {}],
  ['palette-10k-k10-i25', source10k, { colorCount: 10 }],
  ['palette-10k-k10-i100', source10k, { colorCount: 10, maxIterations: 100 }],
  ['palette-65k-sampled10k', source65k, {}],
  ['palette-four-colors', fourColors, {}],
  ['palette-100k-explicit-stress', source100k, { colorCount: 10, maxSamples: 100000 }],
]) {
  measure(name, () => palette.extractPalette(source, options), result => {
    assert(result.length > 0 && result.length <= (options.colorCount ?? 4));
    assert.equal(result.reduce((sum, entry) => sum + entry.pixelCount, 0),
      Math.min(source.length, options.maxSamples ?? 10000));
  }, { inputPixels: source.length, options });
}

const colors = source10k.slice(0, 125).map(p => ColorService.rgbToHex(p.r, p.g, p.b));
for (const method of ['rgb', 'ciede2000']) {
  for (const count of [1, 10, 125]) {
    measure(`match-${method}-${count}`, () => colors.slice(0, count).map(color =>
      dyes.findClosestDye(color, { matchingMethod: method })), matches => {
      assert.equal(matches.length, count);
      assert(matches.every(Boolean));
    }, { targets: count, dyes: dyeDatabase.length, matchingMethod: method, cache: 'warm' });
  }
}

const rgba = new Uint8Array(256 * 256 * 4);
for (let index = 0; index < source65k.length; index++) {
  const pixel = source65k[index];
  rgba.set([pixel.r, pixel.g, pixel.b, 255], index * 4);
}
measure('rgba-to-rgb-objects-256-square', () => {
  const converted = [];
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index + 3] >= 128) {
      converted.push({ r: rgba[index], g: rgba[index + 1], b: rgba[index + 2] });
    }
  }
  return converted;
}, result => assert.equal(result.length, 65536), { note: 'Synthetic equivalent of the caller conversion loop' });

writeFileSync(output, JSON.stringify({
  recordedAt: new Date().toISOString(),
  commit: execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  platform: platform(),
  arch: arch(),
  cpu: cpus()[0].model,
  warmups: 5,
  measuredIterations: 30,
  scope: 'Current TypeScript implementation only, synthetic predecoded inputs, one process. No Rust comparison or production latency/memory claim.',
  results,
}, null, 2) + '\n');
console.table(results.map(({ name, medianMs, p95Ms }) => ({ name, medianMs, p95Ms })));

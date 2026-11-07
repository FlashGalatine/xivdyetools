// Comparative k-means measurement for OPT-001 (2026-11-07 addendum).
//
// usage: node benchmark-rust-comparison.mjs <repo-root> <kernel.wasm> <output.json> [kernel-simd.wasm]
//
// Variants, all driven by the same seeded LCG in place of Math.random:
//   coreBuilt        packages/core/dist PaletteService.extractPalette (Math.random stubbed), RGB[] in
//   current          verbatim copy of core's k-means helpers, RGB[] in (kernel only)
//   packedTS         Float64Array input, per-cluster counts/sums, no per-pass allocation
//   packedTSFromRGB  packedTS including the RGB[] -> Float64Array packing
//   packedTSSquared  packedTS comparing squared distances in the assignment loop only
//   wasm             Rust kernel (evidence/rust-kernel), one coarse call incl. the JS -> linear-memory copy
//   wasmFromRGB      wasm including RGB[] packing
//   wasmSquared      Rust kernel_sq
//   wasmSimd         optional +simd128 build of the same kernel
// Every variant must reproduce `current` exactly (centroids and cluster sizes) before it is timed,
// and `current` must reproduce coreBuilt's palette exactly.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const [repoArg, wasmArg, outArg, simdArg] = process.argv.slice(2);
const repo = resolve(repoArg);
const core = await import(pathToFileURL(resolve(repo, 'packages/core/dist/index.js')));
const palette = new core.PaletteService();

const SEED = 424242;
const THRESHOLD = 1.0; // core default convergenceThreshold
const WARMUPS = 5;
const RUNS = 30;

const lcg = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

// ---------- current: PaletteService.ts k-means helpers, copied verbatim (Math.random -> rnd) ----------
function rgbDistance(a, b) {
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
function rgbMean(colors) {
  let r = 0, g = 0, b = 0;
  for (const c of colors) { r += c.r; g += c.g; b += c.b; }
  return { r: Math.round(r / colors.length), g: Math.round(g / colors.length), b: Math.round(b / colors.length) };
}
function kMeansPlusPlusInit(pixels, k, rnd) {
  const centroids = [{ ...pixels[Math.floor(rnd() * pixels.length)] }];
  const minDistances = new Array(pixels.length);
  for (let j = 0; j < pixels.length; j++) minDistances[j] = rgbDistance(pixels[j], centroids[0]);
  for (let i = 1; i < k; i++) {
    let total = 0;
    for (let j = 0; j < pixels.length; j++) total += minDistances[j] * minDistances[j];
    let selected = 0;
    if (total === 0) selected = Math.floor(rnd() * pixels.length);
    else {
      let threshold = rnd() * total;
      for (let j = 0; j < pixels.length; j++) {
        threshold -= minDistances[j] * minDistances[j];
        if (threshold <= 0) { selected = j; break; }
      }
    }
    centroids.push({ ...pixels[selected] });
    const next = centroids[centroids.length - 1];
    for (let j = 0; j < pixels.length; j++) {
      const d = rgbDistance(pixels[j], next);
      if (d < minDistances[j]) minDistances[j] = d;
    }
  }
  return centroids;
}
function assignToClusters(pixels, centroids) {
  const assignments = new Array(pixels.length);
  const clusters = centroids.map(() => []);
  for (let i = 0; i < pixels.length; i++) {
    let minDist = Infinity, nearest = 0;
    for (let j = 0; j < centroids.length; j++) {
      const d = rgbDistance(pixels[i], centroids[j]);
      if (d < minDist) { minDist = d; nearest = j; }
    }
    assignments[i] = nearest;
    clusters[nearest].push(pixels[i]);
  }
  return { assignments, clusters };
}
function updateCentroids(centroids, clusters) {
  const newCentroids = [];
  let maxMovement = 0;
  for (let i = 0; i < centroids.length; i++) {
    if (clusters[i].length === 0) newCentroids.push({ ...centroids[i] });
    else {
      const c = rgbMean(clusters[i]);
      const movement = rgbDistance(centroids[i], c);
      if (movement > maxMovement) maxMovement = movement;
      newCentroids.push(c);
    }
  }
  return { newCentroids, maxMovement };
}
function countDistinctColors(pixels, limit) {
  const seen = new Set();
  for (const p of pixels) { if (seen.size >= limit) break; seen.add(`${p.r},${p.g},${p.b}`); }
  return seen.size;
}
function current(pixels, k, maxIterations, rnd) {
  let centroids = kMeansPlusPlusInit(pixels, countDistinctColors(pixels, k), rnd);
  let iterations = 0;
  for (let it = 0; it < maxIterations; it++) {
    iterations++;
    const { clusters } = assignToClusters(pixels, centroids);
    const { newCentroids, maxMovement } = updateCentroids(centroids, clusters);
    centroids = newCentroids;
    if (maxMovement < THRESHOLD) break;
  }
  const { clusters } = assignToClusters(pixels, centroids);
  return { centroids, sizes: clusters.map((c) => c.length), iterations };
}

// ---------- packed TypeScript ----------
function packedTS(p, n, k, maxIterations, rnd, squared = false) {
  const seen = [];
  for (let i = 0; i < n && seen.length < k; i++) {
    const r = p[i * 3], g = p[i * 3 + 1], b = p[i * 3 + 2];
    if (!seen.some((s) => s[0] === r && s[1] === g && s[2] === b)) seen.push([r, g, b]);
  }
  const ek = seen.length;
  const c = new Float64Array(ek * 3);
  const first = Math.floor(rnd() * n);
  c[0] = p[first * 3]; c[1] = p[first * 3 + 1]; c[2] = p[first * 3 + 2];
  const nearest = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const dr = p[j * 3] - c[0], dg = p[j * 3 + 1] - c[1], db = p[j * 3 + 2] - c[2];
    nearest[j] = Math.sqrt(dr * dr + dg * dg + db * db);
  }
  for (let i = 1; i < ek; i++) {
    let total = 0;
    for (let j = 0; j < n; j++) total += nearest[j] * nearest[j];
    let selected = 0;
    if (total === 0) selected = Math.floor(rnd() * n);
    else {
      let t = rnd() * total;
      for (let j = 0; j < n; j++) { t -= nearest[j] * nearest[j]; if (t <= 0) { selected = j; break; } }
    }
    const cr = p[selected * 3], cg = p[selected * 3 + 1], cb = p[selected * 3 + 2];
    c[i * 3] = cr; c[i * 3 + 1] = cg; c[i * 3 + 2] = cb;
    for (let j = 0; j < n; j++) {
      const dr = p[j * 3] - cr, dg = p[j * 3 + 1] - cg, db = p[j * 3 + 2] - cb;
      const d = Math.sqrt(dr * dr + dg * dg + db * db);
      if (d < nearest[j]) nearest[j] = d;
    }
  }
  const counts = new Uint32Array(ek);
  const sums = new Float64Array(ek * 3);
  const assign = () => {
    counts.fill(0); sums.fill(0);
    for (let i = 0; i < n; i++) {
      const r = p[i * 3], g = p[i * 3 + 1], b = p[i * 3 + 2];
      let best = Infinity, bi = 0;
      for (let j = 0; j < ek; j++) {
        const dr = r - c[j * 3], dg = g - c[j * 3 + 1], db = b - c[j * 3 + 2];
        const d = squared ? dr * dr + dg * dg + db * db : Math.sqrt(dr * dr + dg * dg + db * db);
        if (d < best) { best = d; bi = j; }
      }
      counts[bi]++; sums[bi * 3] += r; sums[bi * 3 + 1] += g; sums[bi * 3 + 2] += b;
    }
  };
  for (let it = 0; it < maxIterations; it++) {
    assign();
    let maxMovement = 0;
    for (let j = 0; j < ek; j++) {
      if (counts[j] === 0) continue;
      const nr = Math.round(sums[j * 3] / counts[j]), ng = Math.round(sums[j * 3 + 1] / counts[j]), nb = Math.round(sums[j * 3 + 2] / counts[j]);
      const dr = c[j * 3] - nr, dg = c[j * 3 + 1] - ng, db = c[j * 3 + 2] - nb;
      const movement = Math.sqrt(dr * dr + dg * dg + db * db);
      if (movement > maxMovement) maxMovement = movement;
      c[j * 3] = nr; c[j * 3 + 1] = ng; c[j * 3 + 2] = nb;
    }
    if (maxMovement < THRESHOLD) break;
  }
  assign();
  const centroids = [];
  for (let j = 0; j < ek; j++) centroids.push({ r: c[j * 3], g: c[j * 3 + 1], b: c[j * 3 + 2] });
  return { centroids, sizes: Array.from(counts) };
}
const pack = (pixels) => {
  const a = new Float64Array(pixels.length * 3);
  for (let i = 0; i < pixels.length; i++) { a[i * 3] = pixels[i].r; a[i * 3 + 1] = pixels[i].g; a[i * 3 + 2] = pixels[i].b; }
  return a;
};

// ---------- Rust/WASM: one coarse call, raw extern "C" ABI (no wasm-bindgen glue) ----------
async function loadKernel(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes);
  const x = instance.exports;
  let capacity = 0, ptr = 0;
  const outPtr = x.alloc_f64(40);
  return (name) => (packed, n, k, maxIterations, seed) => {
    if (n * 3 > capacity) { if (capacity) x.free_f64(ptr, capacity); capacity = n * 3; ptr = x.alloc_f64(capacity); }
    new Float64Array(x.memory.buffer, ptr, n * 3).set(packed.subarray(0, n * 3));
    const ek = x[name](ptr, n, k, maxIterations, THRESHOLD, seed, outPtr);
    const o = new Float64Array(x.memory.buffer, outPtr, k * 4);
    const centroids = [];
    for (let j = 0; j < ek; j++) centroids.push({ r: o[j * 3], g: o[j * 3 + 1], b: o[j * 3 + 2] });
    return { centroids, sizes: Array.from(o.subarray(k * 3, k * 3 + ek)) };
  };
}

// ---------- core built artifact, Math.random replaced for the call ----------
function coreBuilt(pixels, k, maxIterations) {
  const original = Math.random;
  Math.random = lcg(SEED);
  try {
    return palette.extractPalette(pixels, { colorCount: k, maxIterations, maxSamples: pixels.length, convergenceThreshold: THRESHOLD });
  } finally {
    Math.random = original;
  }
}
// The shaping extractPalette applies after kMeansClustering (rounded dominance, empty clusters dropped, stable sort).
function shape({ centroids, sizes }) {
  const total = sizes.reduce((s, x) => s + x, 0);
  return centroids
    .map((color, i) => ({ color, dominance: total > 0 ? Math.round((sizes[i] / total) * 100) : 0, pixelCount: sizes[i] }))
    .filter((e) => e.pixelCount > 0)
    .sort((a, b) => b.dominance - a.dominance);
}

// ---------- synthetic inputs ----------
function uniform(n, seed) {
  const r = lcg(seed);
  return Array.from({ length: n }, () => ({ r: Math.floor(r() * 256), g: Math.floor(r() * 256), b: Math.floor(r() * 256) }));
}
// Eight weighted blobs (sum of three uniforms, +/- 27 per channel) plus 10% uniform noise, integer channels.
function blobs(n, seed) {
  const r = lcg(seed);
  const centres = Array.from({ length: 8 }, () => [r() * 255, r() * 255, r() * 255, 0.2 + r()]);
  const totalWeight = centres.reduce((s, c) => s + c[3], 0);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const jitter = () => (r() + r() + r() - 1.5) * 18;
  return Array.from({ length: n }, () => {
    if (r() < 0.1) return { r: Math.floor(r() * 256), g: Math.floor(r() * 256), b: Math.floor(r() * 256) };
    let t = r() * totalWeight, c = centres[0];
    for (const x of centres) { t -= x[3]; if (t <= 0) { c = x; break; } }
    return { r: clamp(c[0] + jitter()), g: clamp(c[1] + jitter()), b: clamp(c[2] + jitter()) };
  });
}
function fractional(n, seed) {
  const r = lcg(seed);
  return Array.from({ length: n }, () => ({ r: r() * 255, g: r() * 255, b: r() * 255 }));
}

function time(fn) {
  for (let i = 0; i < WARMUPS; i++) fn();
  const samples = [];
  for (let i = 0; i < RUNS; i++) { const s = performance.now(); fn(); samples.push(performance.now() - s); }
  const sorted = [...samples].sort((a, b) => a - b);
  return { upperMedianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], samples };
}

const wasmBytes = readFileSync(resolve(wasmArg));
const startup = [];
for (let i = 0; i < 10; i++) {
  const s = performance.now();
  await WebAssembly.instantiate(await WebAssembly.compile(wasmBytes));
  startup.push(performance.now() - s);
}
startup.sort((a, b) => a - b);
const kernel = await loadKernel(wasmBytes);
const wasm = kernel('kmeans');
const wasmSquared = kernel('kmeans_sq');
const wasmSimd = simdArg ? (await loadKernel(readFileSync(resolve(simdArg))))('kmeans') : null;

const cases = [
  { name: 'uniform 10k, 4 colors', make: () => uniform(10000, 1), k: 4 },
  { name: 'uniform 10k, 10 colors', make: () => uniform(10000, 1), k: 10 },
  { name: 'blobs 10k, 4 colors', make: () => blobs(10000, 2), k: 4 },
  { name: 'blobs 10k, 10 colors', make: () => blobs(10000, 2), k: 10 },
  { name: 'fractional 10k, 10 colors', make: () => fractional(10000, 3), k: 10 },
  { name: 'uniform 100k, 10 colors', make: () => uniform(100000, 4), k: 10 },
];
const MAX_ITERATIONS = 25; // core default and the Discord adapter's explicit value

const results = [];
for (const c of cases) {
  const px = c.make();
  const n = px.length;
  const packed = pack(px);
  const reference = current(px, c.k, MAX_ITERATIONS, lcg(SEED));
  const plain = { centroids: reference.centroids, sizes: reference.sizes };
  assert.deepEqual(coreBuilt(px, c.k, MAX_ITERATIONS), shape(plain), `${c.name}: copy differs from built core`);
  const variants = {
    coreBuilt: () => coreBuilt(px, c.k, MAX_ITERATIONS),
    current: () => current(px, c.k, MAX_ITERATIONS, lcg(SEED)),
    packedTS: () => packedTS(packed, n, c.k, MAX_ITERATIONS, lcg(SEED)),
    packedTSFromRGB: () => packedTS(pack(px), n, c.k, MAX_ITERATIONS, lcg(SEED)),
    packedTSSquared: () => packedTS(packed, n, c.k, MAX_ITERATIONS, lcg(SEED), true),
    wasm: () => wasm(packed, n, c.k, MAX_ITERATIONS, SEED),
    wasmFromRGB: () => wasm(pack(px), n, c.k, MAX_ITERATIONS, SEED),
    wasmSquared: () => wasmSquared(packed, n, c.k, MAX_ITERATIONS, SEED),
    ...(wasmSimd ? { wasmSimd: () => wasmSimd(packed, n, c.k, MAX_ITERATIONS, SEED) } : {}),
  };
  const parity = {};
  for (const [name, fn] of Object.entries(variants)) {
    if (name === 'coreBuilt' || name === 'current') continue;
    const r = fn();
    parity[name] = JSON.stringify([r.centroids, r.sizes]) === JSON.stringify([plain.centroids, plain.sizes]);
    assert.ok(parity[name], `${c.name}: ${name} differs from current`);
  }
  const timings = {};
  for (const [name, fn] of Object.entries(variants)) timings[name] = time(fn);
  results.push({ case: c.name, samples: n, colors: c.k, maxIterations: MAX_ITERATIONS, iterations: reference.iterations, effectiveK: reference.centroids.length, parity, timings });
}

let rustc = null;
try { rustc = execFileSync('rustc', ['--version'], { encoding: 'utf8' }).trim(); } catch { /* optional */ }
const output = {
  recordedAt: new Date().toISOString(),
  commit: execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  environment: { node: process.version, v8: process.versions.v8, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, rustc },
  kernel: { bytes: wasmBytes.length, sha256: createHash('sha256').update(wasmBytes).digest('hex'), compileInstantiateMedianMs: startup[5], simd: Boolean(wasmSimd) },
  method: { seed: SEED, convergenceThreshold: THRESHOLD, warmups: WARMUPS, runs: RUNS, median: 'upper median (16th of 30 ordered samples)', p95: 'nearest rank' },
  results,
};
writeFileSync(resolve(outArg), JSON.stringify(output, null, 2) + '\n');

const cols = ['coreBuilt', 'current', 'packedTS', 'packedTSFromRGB', 'packedTSSquared', 'wasm', 'wasmFromRGB', 'wasmSquared', ...(wasmSimd ? ['wasmSimd'] : [])];
console.log(`node ${process.version} | ${platform()} ${arch()} | ${cpus()[0]?.model} | ${rustc ?? 'rustc n/a'}`);
console.log(`kernel ${wasmBytes.length} bytes, compile+instantiate median ${startup[5].toFixed(2)} ms`);
console.log('parity: built core == current copy == every variant (centroids and sizes, exact) on all cases\n');
console.log('upper median ms'.padEnd(27) + 'iters' + cols.map((c) => c.padStart(16)).join(''));
for (const r of results) console.log(r.case.padEnd(27) + String(r.iterations).padStart(5) + cols.map((c) => r.timings[c].upperMedianMs.toFixed(2).padStart(16)).join(''));
console.log('\np95 ms'.padEnd(28) + '     ' + cols.map((c) => c.padStart(16)).join(''));
for (const r of results) console.log(r.case.padEnd(27) + '     ' + cols.map((c) => r.timings[c].p95Ms.toFixed(2).padStart(16)).join(''));

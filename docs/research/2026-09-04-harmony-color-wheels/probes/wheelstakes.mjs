#!/usr/bin/env node
/* Throwaway: quantify how many harmony partners change under RYB / OKLCH wheels. */
import { readFileSync } from 'node:fs';

const DYES_PATH =
  process.argv[2] ||
  new URL('../../../../packages/core/src/data/dyes.json', import.meta.url);

// ---------- sRGB / HSV ----------
const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const clamp255 = (x) => Math.max(0, Math.min(255, Math.round(x)));
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');

function rgbToHsv(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}
function hsvToRgb(h, s, v) {
  const S = s / 100, V = v / 100;
  const c = V * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = V - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const hexToHsv = (hex) => rgbToHsv(...hexToRgb(hex));
const hsvToHex = (h, s, v) => rgbToHex(...hsvToRgb(((h % 360) + 360) % 360, s, v));

// ---------- CIELab / CIEDE2000 ----------
const srgbToLinear = (c) => {
  const cc = c / 255;
  return cc <= 0.04045 ? cc / 12.92 : Math.pow((cc + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (c) =>
  255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function rgbToLab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  let Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  let Z = R * 0.0193339 + G * 0.119192 + B * 0.9503041;
  X /= 0.95047; Y /= 1.0; Z /= 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const hexToLab = (hex) => rgbToLab(...hexToRgb(hex));

function ciede2000(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const kL = 1, kC = 1, kH = 1;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const C7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const deg = (r) => (r * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;
  const hp = (ap, bp) => {
    if (ap === 0 && bp === 0) return 0;
    let h = deg(Math.atan2(bp, ap));
    if (h < 0) h += 360;
    return h;
  };
  const h1p = hp(a1p, b1), h2p = hp(a2p, b2);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) dhp = 0;
  else {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else {
    const d = Math.abs(h1p - h2p);
    const s = h1p + h2p;
    if (d <= 180) hbp = s / 2;
    else hbp = s < 360 ? (s + 360) / 2 : (s - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hbp - 30)) +
    0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) -
    0.2 * Math.cos(rad(4 * hbp - 63));
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Cbp7 = Math.pow(Cbp, 7);
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    Math.pow(dLp / (kL * Sl), 2) +
      Math.pow(dCp / (kC * Sc), 2) +
      Math.pow(dHp / (kH * Sh), 2) +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
  );
}

// ---------- OKLab / OKLCH ----------
function rgbToOklab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToLinearRgb(L, a, b) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (lin, eps = 1 / 512) => lin.every((c) => c >= -eps && c <= 1 + eps);
function oklabToHexClip(L, a, b) {
  const lin = oklabToLinearRgb(L, a, b);
  return rgbToHex(...lin.map((c) => linearToSrgb(Math.max(0, Math.min(1, c)))));
}
const oklchToHexClip = (L, C, h) =>
  oklabToHexClip(L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180));

const deltaEOK = (o1, o2) =>
  Math.hypot(o1[0] - o2[0], o1[1] - o2[1], o1[2] - o2[2]);

/** CSS Color 4 style gamut map: binary-search chroma, keep L and H, JND 0.02 in OKLab. */
function oklchToHexCss4(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const lab = (c) => [L, c * Math.cos(hr), c * Math.sin(hr)];
  if (L >= 1) return '#ffffff';
  if (L <= 0) return '#000000';
  if (inGamut(oklabToLinearRgb(...lab(C)))) return oklabToHexClip(...lab(C));
  let lo = 0, hi = C;
  const JND = 0.02;
  while (hi - lo > 0.0001) {
    const mid = (lo + hi) / 2;
    const cand = lab(mid);
    if (inGamut(oklabToLinearRgb(...cand))) lo = mid;
    else {
      // CSS Color 4: if the clipped version is within the JND of the candidate, accept.
      const clippedHex = oklabToHexClip(...cand);
      const clippedOk = rgbToOklab(...hexToRgb(clippedHex));
      if (deltaEOK(clippedOk, cand) < JND) return clippedHex;
      hi = mid;
    }
  }
  return oklabToHexClip(...lab(lo));
}

// ---------- RYB hue warp (Nodebox / Itten table, x = RYB angle, y = RGB hue) ----------
const RYB_WHEEL = [
  [0, 0], [15, 8], [30, 17], [45, 26], [60, 34], [75, 41], [90, 48], [105, 54],
  [120, 60], [135, 81], [150, 103], [165, 123], [180, 138], [195, 155],
  [210, 171], [225, 187], [240, 204], [255, 219], [270, 234], [285, 251],
  [300, 267], [315, 282], [330, 298], [345, 329], [360, 360],
];
/** RGB/HSV hue -> RYB wheel angle */
function rgbHueToRyb(h) {
  h = ((h % 360) + 360) % 360;
  for (let i = 0; i < RYB_WHEEL.length - 1; i++) {
    const [x0, y0] = RYB_WHEEL[i], [x1, y1] = RYB_WHEEL[i + 1];
    if (h >= y0 && h <= y1) return (x0 + ((x1 - x0) * (h - y0)) / (y1 - y0)) % 360;
  }
  return h;
}
/** RYB wheel angle -> RGB/HSV hue */
function rybToRgbHue(a) {
  a = ((a % 360) + 360) % 360;
  for (let i = 0; i < RYB_WHEEL.length - 1; i++) {
    const [x0, y0] = RYB_WHEEL[i], [x1, y1] = RYB_WHEEL[i + 1];
    if (a >= x0 && a <= x1) return (y0 + ((y1 - y0) * (a - x0)) / (x1 - x0)) % 360;
  }
  return a;
}

// ---------- data ----------
const raw = JSON.parse(readFileSync(DYES_PATH, 'utf8'));
const list = Array.isArray(raw) ? raw : raw.dyes || Object.values(raw);
const dyes = list
  .filter((d) => d && d.hex && d.category !== 'Facewear')
  .map((d) => ({
    id: d.stainID,
    name: d.name?.en ?? d.name,
    hex: '#' + String(d.hex).replace('#', '').toLowerCase(),
  }));
const labOf = new Map(dyes.map((d) => [d.id, hexToLab(d.hex)]));
const okOf = new Map(dyes.map((d) => [d.id, rgbToOklab(...hexToRgb(d.hex))]));

function nearest(targetHex, excludeId, metric) {
  const tl = hexToLab(targetHex);
  const to = rgbToOklab(...hexToRgb(targetHex));
  let best = null, bestD = Infinity;
  for (const d of dyes) {
    if (d.id === excludeId) continue;
    const dist = metric === 'ok' ? deltaEOK(to, okOf.get(d.id)) : ciede2000(tl, labOf.get(d.id));
    if (dist < bestD) { bestD = dist; best = d; }
  }
  return { dye: best, dist: bestD };
}

const HARMONIES = {
  complementary: [180],
  analogous: [30, 330],
  triadic: [120, 240],
};

function targetFor(wheel, baseHex, offset) {
  const hsv = hexToHsv(baseHex);
  if (wheel === 'rgb') return hsvToHex(hsv.h + offset, hsv.s, hsv.v);
  if (wheel === 'ryb') {
    const h2 = rybToRgbHue(rgbHueToRyb(hsv.h) + offset);
    return hsvToHex(h2, hsv.s, hsv.v);
  }
  const ok = rgbToOklab(...hexToRgb(baseHex));
  const L = ok[0], C = Math.hypot(ok[1], ok[2]);
  let H = (Math.atan2(ok[2], ok[1]) * 180) / Math.PI;
  if (H < 0) H += 360;
  if (wheel === 'oklch') return oklchToHexCss4(L, C, H + offset);
  if (wheel === 'oklch-clip') return oklchToHexClip(L, C, H + offset);
  throw new Error('wheel? ' + wheel);
}

// ---------- experiment ----------
const WHEELS = ['ryb', 'oklch', 'oklch-clip'];
const rows = [];
let gamutDiff = 0, gamutTotal = 0;

for (const [hname, offsets] of Object.entries(HARMONIES)) {
  const stats = {};
  for (const w of WHEELS) stats[w] = { changed: 0, total: 0, sumDe: 0, maxDe: 0, sumHue: 0 };
  for (const base of dyes) {
    for (const off of offsets) {
      const baseTarget = targetFor('rgb', base.hex, off);
      const basePick = nearest(baseTarget, base.id, 'de2000');
      for (const w of WHEELS) {
        const t = targetFor(w, base.hex, off);
        const p = nearest(t, base.id, 'de2000');
        const s = stats[w];
        s.total++;
        // how far the TARGET moved in hue
        const dh = Math.abs(hexToHsv(t).h - hexToHsv(baseTarget).h);
        s.sumHue += Math.min(dh, 360 - dh);
        if (p.dye.id !== basePick.dye.id) {
          s.changed++;
          const de = ciede2000(labOf.get(p.dye.id), labOf.get(basePick.dye.id));
          s.sumDe += de;
          s.maxDe = Math.max(s.maxDe, de);
        }
        if (w === 'oklch') {
          gamutTotal++;
          if (t !== targetFor('oklch-clip', base.hex, off)) gamutDiff++;
        }
      }
    }
  }
  rows.push({ harmony: hname, stats });
}

const pct = (a, b) => ((100 * a) / b).toFixed(1) + '%';
console.log(`dyes considered: ${dyes.length}`);
console.log('');
console.log('| harmony | wheel | slots | partner changed | mean ΔE00 when changed | max ΔE00 | mean target hue shift |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
  for (const w of WHEELS) {
    const s = r.stats[w];
    console.log(
      `| ${r.harmony} | ${w} | ${s.total} | ${s.changed} (${pct(s.changed, s.total)}) | ` +
        `${s.changed ? (s.sumDe / s.changed).toFixed(2) : '-'} | ${s.maxDe.toFixed(2)} | ` +
        `${(s.sumHue / s.total).toFixed(1)}° |`
    );
  }
}

// aggregate
console.log('');
for (const w of WHEELS) {
  let c = 0, t = 0, sd = 0;
  for (const r of rows) { c += r.stats[w].changed; t += r.stats[w].total; sd += r.stats[w].sumDe; }
  console.log(`ALL (${w}): ${c}/${t} = ${pct(c, t)} changed, mean ΔE00 when changed ${(sd / (c || 1)).toFixed(2)}`);
}
console.log('');
console.log(`CSS4 chroma-reduction vs naive clip differ on ${gamutDiff}/${gamutTotal} targets (${pct(gamutDiff, gamutTotal)})`);

// ---------- Q3: same OKLCH geometry, ranked by ΔEOK instead of ΔE00 ----------
{
  let changed = 0, total = 0, sumDe = 0;
  for (const [, offsets] of Object.entries(HARMONIES)) {
    for (const base of dyes) {
      for (const off of offsets) {
        const t = targetFor('oklch', base.hex, off);
        const a = nearest(t, base.id, 'de2000');
        const b = nearest(t, base.id, 'ok');
        total++;
        if (a.dye.id !== b.dye.id) {
          changed++;
          sumDe += ciede2000(labOf.get(a.dye.id), labOf.get(b.dye.id));
        }
      }
    }
  }
  console.log(
    `\nMETRIC swap on the SAME OKLCH target (ΔE00 vs ΔEOK ranking): ${changed}/${total} = ${pct(changed, total)} differ, mean ΔE00 between the two picks ${(sumDe / (changed || 1)).toFixed(2)}`
  );
}

// ---------- greys sanity ----------
{
  const greys = dyes.filter((d) => hexToHsv(d.hex).s < 3);
  let bad = 0;
  for (const d of greys) for (const w of ['rgb', 'ryb', 'oklch']) {
    const t = targetFor(w, d.hex, 180);
    if (hexToHsv(t).s > 3.5) bad++;
  }
  console.log(`\ngrey-stability: ${greys.length} near-grey dyes; ${bad} rotated targets gained saturation >3.5%`);
  for (const d of greys.slice(0, 6)) {
    console.log(`   ${d.name} ${d.hex} -> rgb ${targetFor('rgb', d.hex, 180)} ryb ${targetFor('ryb', d.hex, 180)} oklch ${targetFor('oklch', d.hex, 180)}`);
  }
}

// ---------- warp invertibility + monotonicity ----------
{
  let maxErr = 0, mono = true, prev = -1;
  for (let i = 0; i < 3600; i++) {
    const h = i / 10;
    const rt = rybToRgbHue(rgbHueToRyb(h));
    const err = Math.min(Math.abs(rt - h), 360 - Math.abs(rt - h));
    maxErr = Math.max(maxErr, err);
    const a = rgbHueToRyb(h);
    if (a < prev - 1e-9) mono = false;
    prev = a;
  }
  console.log(`\nRYB warp: max round-trip error ${maxErr.toExponential(2)}°, monotonic=${mono}`);
  const samples = [0, 30, 60, 120, 180, 240, 300];
  console.log('  hsv->ryb: ' + samples.map((h) => `${h}->${rgbHueToRyb(h).toFixed(1)}`).join('  '));
  console.log('  ryb->hsv: ' + samples.map((h) => `${h}->${rybToRgbHue(h).toFixed(1)}`).join('  '));
  console.log('  RYB complement of red(hsv 0) = hsv ' + rybToRgbHue(rgbHueToRyb(0) + 180).toFixed(1));
  console.log('  RYB triad of red = hsv ' + [120, 240].map((o) => rybToRgbHue(rgbHueToRyb(0) + o).toFixed(1)).join(', '));
}

#!/usr/bin/env tsx
/**
 * Derives `src/data/munsell-hues.json` — the Munsell hue wheel's 40 anchors —
 * from the Munsell renotation data, which is NOT vendored in this repository.
 *
 *   curl -fsSL -o /tmp/munsell/real.dat http://www.rit-mcsl.org/MunsellRenotation/real.dat
 *   pnpm --filter @xivdyetools/core run build:munsell -- /tmp/munsell/real.dat
 *
 * Provenance, licence reasoning and attribution: `packages/core/NOTICE` and
 * `docs/research/2026-09-04-harmony-color-wheels/07-munsell-licence-check.md`.
 *
 * Method (spec §2.1 / §2.3): for each of the 40 principal hues take the row at
 * VALUE 6 / CHROMA 8 (the one sample point present for all 40), convert its
 * xyY (Illuminant C, Y in 0–100) → XYZ → Bradford C→D65 → linear sRGB →
 * gamma-encoded sRGB WITHOUT clipping → HSV hue. The wheel angle is the ASTM
 * hue number × 3.6°. `normalizeWarpTable` then sorts, unwraps, monotonises
 * and re-zeroes so sRGB 0° ↦ wheel 0°, like every other warp wheel.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeWarpTable } from '../src/services/dye/wheels/hue-warp.js';

const VALUE = 6;
const CHROMA = 8;

/** ASTM D1535 hue-family codes: R=7 YR=6 Y=5 GY=4 G=3 BG=2 B=1 PB=10 P=9 RP=8. */
const HUE_CODES: Record<string, number> = { R: 7, YR: 6, Y: 5, GY: 4, G: 3, BG: 2, B: 1, PB: 10, P: 9, RP: 8 };

/** 5R → 5, 5Y → 25, 5G → 45, 5B → 65, 5P → 85, 10RP → 100 (≡ 0). */
function astmHue(step: number, family: string): number {
  const code = HUE_CODES[family];
  if (code === undefined) throw new Error(`Unknown Munsell hue family: ${family}`);
  return 10 * ((((7 - code) % 10) + 10) % 10) + step;
}

// Bradford chromatic adaptation, Illuminant C → D65 (Lindbloom,
// http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html). Verified
// indirectly by the cross-check in Step 7: a wrong matrix moves hues by
// degrees, and the gate there is 1°.
const BRADFORD_C_TO_D65 = [
  [0.9904476, -0.0071683, -0.0116156],
  [-0.0123712, 1.015595, -0.0029282],
  [-0.0035635, 0.0067263, 0.9218669],
];
// XYZ (D65) → linear sRGB (IEC 61966-2-1).
const XYZ_TO_LINEAR_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
];

function mul(m: number[][], v: [number, number, number]): [number, number, number] {
  return [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as [number, number, number];
}

/** sRGB transfer function extended to negative and >1 values (no clipping). */
function encode(c: number): number {
  const a = Math.abs(c);
  const e = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055;
  return Math.sign(c) * e;
}

function hsvHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function main(): void {
  const src = process.argv[2];
  if (!src) {
    console.error('usage: build-munsell-hues.ts <path to real.dat>');
    process.exit(2);
  }
  const lines = readFileSync(src, 'utf-8').split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].trim().split(/\s+/);
  if (header.join(' ') !== 'h V C x y Y') {
    throw new Error(`Unexpected header: ${header.join(' ')}`);
  }

  const anchors: Array<{ notation: string; astm: number; hsvHue: number; inGamut: boolean }> = [];
  for (const line of lines.slice(1)) {
    const [h, V, C, x, y, Y] = line.trim().split(/\s+/);
    if (Number(V) !== VALUE || Number(C) !== CHROMA) continue;
    const m = /^([\d.]+)([A-Z]+)$/.exec(h);
    if (!m) throw new Error(`Cannot parse hue notation: ${h}`);
    const step = Number(m[1]);
    const family = m[2];
    const xx = Number(x);
    const yy = Number(y);
    const YY = Number(Y) / 100;
    const xyz: [number, number, number] = [(xx * YY) / yy, YY, ((1 - xx - yy) * YY) / yy];
    const lin = mul(XYZ_TO_LINEAR_SRGB, mul(BRADFORD_C_TO_D65, xyz));
    const enc = lin.map(encode) as [number, number, number];
    anchors.push({
      notation: h,
      astm: astmHue(step, family),
      hsvHue: hsvHue(...enc),
      inGamut: lin.every((v) => v >= -1e-6 && v <= 1 + 1e-6),
    });
  }

  if (anchors.length !== 40) {
    throw new Error(`Expected 40 rows at V=${VALUE} C=${CHROMA}, found ${anchors.length}`);
  }

  const raw = anchors.map((a) => [a.astm * 3.6, a.hsvHue] as const);
  const table = normalizeWarpTable(raw, 'munsell', { maxCorrectionDeg: 1 });

  // Recover each anchor's wheel angle from the normalised table: the pair whose
  // HSV column equals the anchor's hue.
  const withWheel = anchors
    .map((a) => {
      const row = table.find(([, hsv]) => Math.abs(hsv - a.hsvHue) < 1e-9);
      if (!row) throw new Error(`Anchor ${a.notation} not found in the normalised table`);
      return { notation: a.notation, astm: a.astm, wheelAngle: row[0], hsvHue: a.hsvHue, inGamut: a.inGamut };
    })
    .sort((a, b) => a.wheelAngle - b.wheelAngle);

  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/munsell-hues.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        $comment:
          'Generated by scripts/build-munsell-hues.ts from the Munsell renotation data (RIT MCSL real.dat, ' +
          'Newhall, Nickerson & Judd 1943) at Value 6 / Chroma 8. Attribution: packages/core/NOTICE. Do not edit by hand.',
        value: VALUE,
        chroma: CHROMA,
        anchors: withWheel,
        table,
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );

  const outOfGamut = withWheel.filter((a) => !a.inGamut).map((a) => a.notation);
  console.log(`Wrote ${withWheel.length} anchors to ${outPath}`);
  console.log(`Outside sRGB at V${VALUE}/C${CHROMA} (hue still valid): ${outOfGamut.join(', ') || 'none'}`);
  console.table(withWheel.map(({ notation, astm, wheelAngle, hsvHue }) => ({ notation, astm, wheelAngle: +wheelAngle.toFixed(3), hsvHue: +hsvHue.toFixed(3) })));
}

main();

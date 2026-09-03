// Repro for core-color-01: does the RYB blend mode lose green?
import { blendColors } from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/core/dist/blending/index.js';
import {
  rgbToRyb,
  rybToRgb,
} from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/core/dist/blending/conversions.js';

const num = (v) => (typeof v === 'number' ? v.toFixed(3) : String(v));
const show = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${num(v)}`)
    .join(' ');
const hexOf = (v) =>
  typeof v === 'string'
    ? v
    : v && typeof v === 'object' && 'hex' in v
      ? v.hex
      : JSON.stringify(v);

console.log('--- rgbToRyb / rybToRgb round trip ---');
for (const [name, rgb] of [
  ['pure green  #00FF00', { r: 0, g: 255, b: 0 }],
  ['pure blue   #0000FF', { r: 0, g: 0, b: 255 }],
  ['pure red    #FF0000', { r: 255, g: 0, b: 0 }],
  ['yellow      #FFFF00', { r: 255, g: 255, b: 0 }],
  ['mid green   #40A040', { r: 64, g: 160, b: 64 }],
  ['olive       #808000', { r: 128, g: 128, b: 0 }],
]) {
  const ryb = rgbToRyb(rgb);
  const back = rybToRgb(ryb);
  console.log(`${name}  ->  RYB(${show(ryb)})  ->  RGB(${show(back)})`);
}

console.log('\n--- blendColors(x, x, ryb) : blending a colour with ITSELF ---');
for (const hex of ['#00FF00', '#FF0000', '#0000FF', '#FFFF00', '#40A040', '#7FBF7F']) {
  const out = hexOf(blendColors(hex, hex, 'ryb'));
  const same = String(out).toLowerCase() === hex.toLowerCase();
  console.log(`${hex} + ${hex}  ->  ${out}${same ? '' : '   <-- CHANGED'}`);
}

console.log('\n--- the same self-blends in rgb mode, for contrast ---');
for (const hex of ['#00FF00', '#40A040']) {
  console.log(`${hex} + ${hex}  ->  ${hexOf(blendColors(hex, hex, 'rgb'))}`);
}

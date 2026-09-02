// Compares core's TWO RYB implementations on the same inputs.
//  A) blending/conversions.ts  -> used by bot-logic /mix and /gradient
//  B) RybColorMixer (behind ColorService.mixColorsRyb) -> used by the web mixer
import { blendColors } from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/core/dist/blending/index.js';
import { RybColorMixer } from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/core/dist/services/color/RybColorMixer.js';

const hexOf = (v) => (typeof v === 'string' ? v : v && v.hex ? v.hex : JSON.stringify(v));
const call = (fn) => {
  try {
    return hexOf(fn());
  } catch (e) {
    return 'THREW ' + e.message;
  }
};

const cases = [
  ['green + green', '#00FF00', '#00FF00'],
  ['midgreen + midgreen', '#40A040', '#40A040'],
  ['blue + yellow (want greenish)', '#0000FF', '#FFFF00'],
  ['red + red', '#FF0000', '#FF0000'],
  ['teal + teal', '#008080', '#008080'],
];

console.log('case                            | A) core/blending      | B) RybColorMixer');
console.log('--------------------------------|-----------------------|------------------');
for (const [name, a, b] of cases) {
  const A = call(() => blendColors(a, b, 'ryb', 0.5));
  const B = call(() => RybColorMixer.mixColors(a, b, 0.5));
  console.log(`${name.padEnd(31)} | ${String(A).padEnd(21)} | ${B}`);
}

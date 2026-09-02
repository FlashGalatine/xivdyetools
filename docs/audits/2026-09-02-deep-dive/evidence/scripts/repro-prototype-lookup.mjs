// Repro: do allowlist lookups written as `key in OBJ` / `OBJ[key]` walk Object.prototype?
import { normalizeMatchingMethod } from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/core/dist/types/index.js';
import { resolveCssColorName } from 'file:///C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/packages/bot-logic/dist/css-colors.js';

const probes = ['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty'];

console.log('=== core: normalizeMatchingMethod (should always return a MatchingMethod string) ===');
for (const p of probes) {
  const out = normalizeMatchingMethod(p);
  console.log(`  ${p.padEnd(16)} -> ${typeof out.padEnd === 'function' ? out : `[${typeof out}] ${String(out).slice(0, 40)}`}`);
}
console.log('  (control) ciede2000  ->', normalizeMatchingMethod('ciede2000'));
console.log('  (control) nonsense   ->', normalizeMatchingMethod('nonsense'));

console.log('\n=== bot-logic: resolveCssColorName (should return #RRGGBB or null) ===');
for (const p of probes) {
  const out = resolveCssColorName(p);
  console.log(`  ${p.padEnd(16)} -> [${typeof out}] ${String(out).slice(0, 40)}`);
}
console.log('  (control) red        ->', resolveCssColorName('red'));
console.log('  (control) notacolour ->', resolveCssColorName('notacolour'));

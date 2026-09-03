// i18n-dynamic-families.mjs — the web-app orphan gate is deliberately generous: any key under a
// dynamic template prefix counts as live. This buckets every key by the RULE that saved it, so the
// prefix/suffix families (invisible to the gate) can be checked by hand.
// Run: node docs/audits/2026-09-01-dead-code/evidence/scripts/i18n-dynamic-families.mjs
import { findUnusedKeys } from 'file:///C:/dev/XIVProjects/xivdyetools/apps/web-app/scripts/analyze-unused-keys.js';

const r = findUnusedKeys({
  srcDir: 'C:/dev/XIVProjects/xivdyetools/apps/web-app/src',
});
const byReason = new Map();
for (const [key, reason] of Object.entries(r.reasons)) {
  if (!reason || reason === 'literal') continue;
  if (!byReason.has(reason)) byReason.set(reason, []);
  byReason.get(reason).push(key);
}
console.log(`total=${r.total} used=${r.used} unused=${r.unused.length}`);
console.log(`keys saved by a NON-literal rule: ${[...byReason.values()].reduce((n, a) => n + a.length, 0)}\n`);
for (const [reason, keys] of [...byReason].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${reason}  (${keys.length})`);
  for (const k of keys) console.log(`    ${k}`);
}

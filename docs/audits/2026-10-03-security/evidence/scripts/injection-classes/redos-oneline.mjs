// Probe: chara-gposers.ts:101 text() regex /\s*[\r\n]+\s*/g on a whitespace run with no newline
const re = /\s*[\r\n]+\s*/g;
for (const n of [5000, 10000, 20000, 40000]) {
  const s = ' '.repeat(n) + 'x';
  const t = performance.now();
  s.replace(re, ' ');
  console.log(n, (performance.now() - t).toFixed(1) + 'ms');
}

// Probe: chara-gposers.ts:101 text() regex /\s*[\r\n]+\s*/g is quadratic on a whitespace run with no newline.
for (const n of [10000, 20000, 40000, 60000]) {
  const s = ' '.repeat(n) + 'x';
  const t = Date.now();
  s.replace(/\s*[\r\n]+\s*/g, ' ');
  console.log(n, Date.now() - t, 'ms');
}

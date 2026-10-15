/** Bounded read-only probes. Usage: node --import tsx <script> <source-root> [pose-files...] */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [sourceRoot, ...samplePaths] = process.argv.slice(2);
if (!sourceRoot) throw new Error('Supply the source checkout root as the first argument.');
const parserPath = resolve(sourceRoot, 'packages/core/src/services/chara/chara-parser.ts');
const { parseCharaFile } = await import(pathToFileURL(parserPath).href);
const results = [];

function probe(label, text, expected) {
  const row = { label, bytes: Buffer.byteLength(text), expected };
  try {
    const parsed = parseCharaFile(text);
    row.outcome = 'accepted';
    row.slotCount = parsed.slots.length;
    row.gearDyeCount = parsed.gearDyes.length;
    row.producer = parsed.producer;
    row.nickname = parsed.nickname;
  } catch (error) {
    row.outcome = 'rejected';
    row.errorName = error.name;
    row.message = String(error.message).slice(0, 700);
  }
  row.matchesExpected = row.outcome === expected;
  results.push(row);
}

for (const samplePath of samplePaths) {
  const text = await readFile(samplePath, 'utf8');
  probe(basename(samplePath), text, 'rejected');
}
probe('minimal colour field', '{"Skintone":1}', 'accepted');
probe('current null-only compatibility', '{"Skintone":null}', 'accepted');
probe('prototype key discarded', '{"Skintone":1,"__proto__":{"auditProbePolluted":true}}', 'accepted');
const prototypeUnchanged = !Object.hasOwn(Object.prototype, 'auditProbePolluted');
probe('HTML-shaped nickname retained as data', '{"Skintone":1,"Nickname":"<b>audit probe</b>"}', 'accepted');
probe('deep malformed index', '{"Skintone":' + '['.repeat(10_000) + '0' + ']'.repeat(10_000) + '}', 'rejected');

console.log(JSON.stringify({ prototypeUnchanged, results }, null, 2));
if (!prototypeUnchanged || results.some((row) => !row.matchesExpected)) process.exitCode = 1;

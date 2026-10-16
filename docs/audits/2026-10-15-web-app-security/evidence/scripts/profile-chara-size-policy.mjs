/** Read-only corpus statistics and small policy probes. No image decoding, writes or network. */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [sourceRoot, corpusRoot] = process.argv.slice(2);
if (!sourceRoot || !corpusRoot) throw new Error('Usage: node --import tsx <script> <source-root> <corpus-root>');
const { parseCharaFile } = await import(pathToFileURL(resolve(sourceRoot,
  'packages/core/src/services/chara/chara-parser.ts')).href);
const cap = 8 * 1024;
const knownProducers = new Set(['Anamnesis Character File', 'Ktisis Character File', 'Ktisis/Anamnesis Character File']);
const producerOf = (value) => knownProducers.has(value) ? value : value == null ? 'unspecified' : 'other';
const byteSize = (text) => Buffer.byteLength(text, 'utf8');
const percentile = (values, fraction) => values[Math.max(0, Math.ceil(values.length * fraction) - 1)];
function summary(values) {
  if (!values.length) return { count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, minBytes: sorted[0], medianBytes: percentile(sorted, 0.5),
    p95Bytes: percentile(sorted, 0.95), maxBytes: sorted.at(-1),
    over8000Bytes: sorted.filter((value) => value > 8000).length,
    over8192Bytes: sorted.filter((value) => value > cap).length };
}

const files = (await readdir(corpusRoot, { withFileTypes: true }))
  .filter((file) => file.isFile() && file.name.toLowerCase().endsWith('.chara'))
  .map((file) => file.name).sort();
const sizes = [], noImageSizes = [], imageSizes = [], hashes = [], oversized = [];
const imageStates = { absent: 0, null: 0, emptyString: 0, nonemptyString: 0, otherType: 0 };
const producerSizes = new Map();
let parsePassed = 0, parseFailed = 0, totalBytes = 0;
for (const filename of files) {
  const bytes = await readFile(resolve(corpusRoot, filename));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  hashes.push(sha256);
  totalBytes += bytes.length;
  sizes.push(bytes.length);
  const text = bytes.toString('utf8');
  const document = JSON.parse(text);
  const producer = producerOf(document.TypeName);
  const group = producerSizes.get(producer) ?? [];
  group.push(bytes.length);
  producerSizes.set(producer, group);
  const image = document.Base64Image;
  const state = !Object.hasOwn(document, 'Base64Image') ? 'absent' : image === null ? 'null'
    : image === '' ? 'emptyString' : typeof image === 'string' ? 'nonemptyString' : 'otherType';
  imageStates[state]++;
  const carriesImageValue = state === 'nonemptyString' || state === 'otherType';
  (carriesImageValue ? imageSizes : noImageSizes).push(bytes.length);
  try { parseCharaFile(text); parsePassed++; } catch { parseFailed++; }
  if (bytes.length > cap) {
    const withoutImage = { ...document };
    delete withoutImage.Base64Image;
    oversized.push({ sha256, bytes: bytes.length, producer, imageState: state,
      imageCharacters: typeof image === 'string' ? image.length : null,
      withoutImageCompactBytes: byteSize(JSON.stringify(withoutImage)),
      withoutImagePrettyBytes: byteSize(JSON.stringify(withoutImage, null, 2)) });
  }
}

const baseline = { TypeName: 'Anamnesis Character File', Skintone: 0 };
const parsedBaseline = JSON.stringify(parseCharaFile(JSON.stringify(baseline)));
const probes = [];
for (const [label, image] of [
  ['null image placeholder', null], ['empty image placeholder', ''],
  ['non-image text in Base64Image', 'NOT_AN_IMAGE_AUDIT_MARKER'],
  ['base64 of non-image text', Buffer.from('audit-only non-image data').toString('base64')],
]) {
  const text = JSON.stringify({ ...baseline, Base64Image: image });
  const parsedUnchanged = JSON.stringify(parseCharaFile(text)) === parsedBaseline;
  probes.push({ label, bytes: byteSize(text), proposedCapAccepts: byteSize(text) <= cap,
    currentParserAccepts: true, imageOmittedFromParsedOutput: parsedUnchanged,
    passed: byteSize(text) <= cap && parsedUnchanged });
}
for (const size of [cap - 1, cap, cap + 1]) {
  const empty = JSON.stringify({ ...baseline, Description: '' });
  const text = JSON.stringify({ ...baseline, Description: 'a'.repeat(size - byteSize(empty)) });
  const parsedUnchanged = JSON.stringify(parseCharaFile(text)) === parsedBaseline;
  probes.push({ label: `proposed byte boundary ${size}`, bytes: byteSize(text),
    proposedCapAccepts: byteSize(text) <= cap, currentParserAccepts: true,
    passed: byteSize(text) === size && parsedUnchanged });
}
const utf8Text = JSON.stringify({ ...baseline, Description: '界'.repeat(3000) });
probes.push({ label: 'UTF-8 bytes differ from string length', bytes: byteSize(utf8Text),
  jsStringLength: utf8Text.length, proposedCapAccepts: byteSize(utf8Text) <= cap,
  passed: utf8Text.length < cap && byteSize(utf8Text) > cap });
const nested = '{"Skintone":' + '['.repeat(10_000) + '0' + ']'.repeat(10_000) + '}';
probes.push({ label: 'previous nested diagnostic reproducer exceeds proposed cap', bytes: byteSize(nested),
  proposedCapAccepts: byteSize(nested) <= cap, passed: byteSize(nested) > cap });

console.log(JSON.stringify({
  scope: 'top-level .chara files only; no source files modified or image payloads decoded',
  proposedCapBytes: cap, corpusDigestSha256: createHash('sha256').update(hashes.sort().join('\n')).digest('hex'),
  totalBytes, uniqueContentHashes: new Set(hashes).size, corpus: summary(sizes),
  withoutNonemptyImage: summary(noImageSizes), withImageValue: summary(imageSizes), imageStates,
  byProducer: Object.fromEntries([...producerSizes].map(([key, values]) => [key, summary(values)])),
  currentParser: { passed: parsePassed, failed: parseFailed }, oversized, probes,
  limit: 'The cap is simulated, not implemented. Passing a size check does not validate content or establish safety.',
}, null, 2));
if (probes.some((probe) => !probe.passed) || parseFailed) process.exitCode = 1;

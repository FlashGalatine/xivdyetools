/** Read-only local probes; downloads and gear lookups are mocked. No Discord messages are sent. */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [sourceRoot, ...samplePaths] = process.argv.slice(2);
if (!sourceRoot) throw new Error('Usage: node --import tsx <script> <source-root> [pose-files...]');
const source = (path) => import(pathToFileURL(resolve(sourceRoot, path)).href);
const { checkCharaAttachment, downloadCharaAttachment } = await source('apps/discord-worker/src/utils/chara-attachment.ts');
const { executeGlamour } = await source('packages/bot-logic/src/commands/glamour.ts');
const { executeSwatch } = await source('packages/bot-logic/src/commands/swatch.ts');
const { createTranslator } = await source('packages/bot-logic/src/i18n/index.ts');
const translator = createTranslator('en');
const originalFetch = globalThis.fetch;
const results = [];
const cap = 1_048_576;
const cdn = 'https://cdn.discordapp.com/attachments/1/2/audit-file';
const deniedNetwork = async () => { throw new Error('Unexpected real network call in audit probe'); };
globalThis.fetch = deniedNetwork;

function interaction(filename, size = 100, url = cdn) {
  return { data: { name: 'glamour', options: [{ name: 'file', type: 11, value: 'audit-attachment' }],
    resolved: { attachments: { 'audit-attachment': { filename, size, url, content_type: 'application/octet-stream' } } } } };
}

function record(label, passed, evidence) {
  results.push({ label, passed, ...evidence });
}

async function inspectDocument(label, filename, text, expectedKind = 'AppError INVALID_INPUT') {
  let downloads = 0;
  let resolveCalls = 0;
  let fetchOptions;
  const guard = checkCharaAttachment(interaction(filename, Buffer.byteLength(text)), translator);
  globalThis.fetch = async (_url, options) => {
    downloads++;
    fetchOptions = { redirect: options.redirect, timeoutSignal: options.signal instanceof AbortSignal };
    return new Response(text);
  };
  const downloaded = guard.ok ? await downloadCharaAttachment(guard.url, translator) : null;
  globalThis.fetch = deniedNetwork;
  const logs = [];
  const logger = { warn: (message) => logs.push(message) };
  const glamour = downloaded?.ok ? await executeGlamour({ fileText: downloaded.text, locale: 'en', logger,
    resolve: async () => { resolveCalls++; return { items: {}, glasses: null }; } }) : null;
  const swatch = downloaded?.ok ? await executeSwatch({ fileText: downloaded.text, locale: 'en', logger }) : null;
  const fixedError = translator.t('card.swatchParseError', { message: translator.t('card.charaFileReason.unreadable') });
  const passed = guard.ok && downloaded?.ok && downloads === 1 && resolveCalls === 0 &&
    glamour?.error === 'PARSE_FAILED' && swatch?.error === 'PARSE_FAILED' &&
    glamour.errorMessage === fixedError && swatch.errorMessage === fixedError &&
    fetchOptions.redirect === 'manual' && fetchOptions.timeoutSignal &&
    logs.length === 2 && logs[0] === `[glamour] parse failed: ${expectedKind}` &&
    logs[1] === `[swatch] parse failed: ${expectedKind}`;
  record(label, passed, { bytes: Buffer.byteLength(text), guardAccepted: guard.ok, downloads, fetchOptions,
    glamourError: glamour?.error, swatchError: swatch?.error,
    publicMessage: glamour?.errorMessage, resolveCalls, logs });
}

try {
  for (const filename of ['audit.pose', 'audit.png', 'audit.txt', 'audit.CHARA']) {
    const result = checkCharaAttachment(interaction(filename), translator);
    record(`extension precheck: ${filename}`, result.ok, { guardAccepted: result.ok });
  }
  for (const url of ['https://example.invalid/audit.chara', 'http://cdn.discordapp.com/audit.chara',
    'https://cdn.discordapp.com.example.invalid/audit.chara']) {
    const result = checkCharaAttachment(interaction('audit.chara', 100, url), translator);
    record(`URL rejected: ${url}`, !result.ok, { guardAccepted: result.ok });
  }
  const large = checkCharaAttachment(interaction('audit.chara', cap + 1), translator);
  record('declared oversize refused', !large.ok, { guardAccepted: large.ok });

  for (const samplePath of samplePaths) {
    const text = await readFile(samplePath, 'utf8');
    await inspectDocument(basename(samplePath), basename(samplePath), text);
    await inspectDocument(`${basename(samplePath)} renamed .chara`, 'renamed.chara', text);
  }
  await inspectDocument('deep malformed index', 'nested.chara',
    '{"Skintone":' + '['.repeat(10_000) + '0' + ']'.repeat(10_000) + '}', 'RangeError');
  await inspectDocument('private malformed value', 'private.chara', '{"Skintone":"PRIVATE_PROBE_MARKER @everyone <b>"}');

  globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://example.invalid/' } });
  const redirect = await downloadCharaAttachment(cdn, translator);
  record('redirect response refused', !redirect.ok, { refused: !redirect.ok });

  let cancelled = false;
  let chunks = 0;
  globalThis.fetch = async () => new Response(new ReadableStream({
    pull(controller) { chunks++; controller.enqueue(new Uint8Array(65_536)); },
    cancel() { cancelled = true; },
  }));
  const streamed = await downloadCharaAttachment(cdn, translator);
  record('undeclared oversize stream refused and cancelled', !streamed.ok && cancelled && chunks <= 18,
    { refused: !streamed.ok, cancelled, chunksProduced: chunks });
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({ network: 'mocked only', scope: 'source helpers and command logic; not a live Worker or rendered response', results }, null, 2));
if (results.some((row) => !row.passed)) process.exitCode = 1;

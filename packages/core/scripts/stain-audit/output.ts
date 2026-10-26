import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { compareStains, parseLocalCatalog } from './compare.js';
import {
  AUDIT_LIMITS,
  canonicalPins,
  completeSnapshot,
  integer,
  record,
  STAIN_ENDPOINT,
  STAIN_FIELDS,
  text,
  validatePage,
} from './model.js';
import type { Capture, CapturedPage, Comparison, LocalInputs, Pins } from './model.js';

export interface Provenance {
  mode: 'latest' | 'pinned' | 'replay';
  capturedAt: string;
  generatedAt: string;
  sourceRevision: string | null;
  sourceDirty: boolean | null;
  sourceFiles: { path: string; sha256: string }[];
  replayedFrom?: string;
}
export interface BundleInputs {
  capture: Capture;
  localInputs: LocalInputs;
  provenance?: Provenance;
  manifestSha256?: string;
}
interface FileDescriptor {
  file: string;
  bytes: number;
  sha256: string;
}
const INPUT_FILES = {
  dyesJson: 'inputs/dyes.json',
  namesCsv: 'inputs/dyenames.csv',
  rulesJson: 'inputs/rules.json',
} as const;
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';
function hash(body: string | Uint8Array): string {
  return createHash('sha256').update(body).digest('hex');
}
function descriptor(file: string, body: string): FileDescriptor {
  const bytes = Buffer.byteLength(body);
  if (bytes > AUDIT_LIMITS.maxBytes)
    throw new Error(`Artifact ${file} exceeds the 2 MiB file limit`);
  return { file, bytes, sha256: hash(body) };
}
function validateDescriptor(value: unknown, file: string): FileDescriptor {
  const input = record(value, 'file descriptor');
  if (input.file !== file) throw new Error(`Invalid bundle-relative file path: expected ${file}`);
  const sha256 = text(input.sha256, 'SHA-256');
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('Invalid SHA-256');
  return { file, sha256, bytes: integer(input.bytes, 'file bytes', AUDIT_LIMITS.maxBytes) };
}
function readProvenance(value: unknown): Provenance {
  const p = record(value, 'provenance');
  if (p.mode !== 'latest' && p.mode !== 'pinned' && p.mode !== 'replay')
    throw new Error('Invalid operation mode');
  const capturedAt = text(p.capturedAt, 'capture timestamp');
  const generatedAt = text(p.generatedAt, 'generation timestamp');
  if (!Number.isFinite(Date.parse(capturedAt)) || !Number.isFinite(Date.parse(generatedAt)))
    throw new Error('Invalid provenance timestamps');
  const sourceRevision =
    p.sourceRevision === null ? null : text(p.sourceRevision, 'source revision');
  if (sourceRevision !== null && !/^[0-9a-f]{40}$/.test(sourceRevision))
    throw new Error('Invalid source revision');
  if (p.sourceDirty !== null && typeof p.sourceDirty !== 'boolean')
    throw new Error('Invalid source dirty-state');
  if (!Array.isArray(p.sourceFiles)) throw new Error('Invalid source file provenance');
  const sourceFiles = p.sourceFiles.map((v: unknown) => {
    const source = record(v, 'source file');
    const path = text(source.path, 'source path');
    const sha256 = text(source.sha256, 'source hash');
    if (!path || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error('Invalid source file provenance');
    return { path, sha256 };
  });
  const replayedFrom =
    p.replayedFrom === undefined ? undefined : text(p.replayedFrom, 'replay source manifest hash');
  if (replayedFrom !== undefined && !/^[0-9a-f]{64}$/.test(replayedFrom))
    throw new Error('Invalid replay source hash');
  return {
    mode: p.mode,
    capturedAt,
    generatedAt,
    sourceRevision,
    sourceDirty: p.sourceDirty,
    sourceFiles,
    ...(replayedFrom === undefined ? {} : { replayedFrom }),
  };
}
function checkUrl(value: string, index: number, pins: Pins, after?: number): void {
  const url = new URL(value);
  if (url.origin + url.pathname !== STAIN_ENDPOINT || url.username || url.password || url.hash)
    throw new Error('Invalid Stain request endpoint');
  const allowed = ['fields', 'language', 'limit', 'after', 'version', 'schema'];
  for (const key of url.searchParams.keys())
    if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
      throw new Error('Unexpected/duplicate Stain request parameter');
  if (
    url.searchParams.get('fields') !== STAIN_FIELDS ||
    url.searchParams.get('limit') !== String(AUDIT_LIMITS.pageRows)
  )
    throw new Error('Invalid request projection or page limit');
  if (url.searchParams.has('language') && url.searchParams.get('language') !== 'en')
    throw new Error('Invalid base language');
  if (url.searchParams.get('after') !== (after === undefined ? null : String(after)))
    throw new Error('Invalid pagination cursor');
  const version = url.searchParams.get('version');
  const schema = url.searchParams.get('schema');
  if (index > 0 || version !== null || schema !== null)
    if (version !== pins.version || schema !== pins.schema)
      throw new Error('Request version/schema pin mismatch');
}
function validateCapture(capture: Capture): Capture {
  if (capture.pages.length < 2 || capture.pages.length > AUDIT_LIMITS.maxPages)
    throw new Error('Invalid/incomplete page count');
  const pins = canonicalPins(capture.snapshot.pins);
  let after: number | undefined;
  const pages = capture.pages.map((p, index): CapturedPage => {
    descriptor(`raw/stain-page-${String(index + 1).padStart(4, '0')}.json`, p.body);
    if (
      p.status !== 200 ||
      p.attempts < 1 ||
      integer(p.attempts, 'attempts') > AUDIT_LIMITS.maxAttempts
    )
      throw new Error('Invalid successful page status/attempt count');
    checkUrl(p.url, index, pins, after);
    const page = validatePage(JSON.parse(p.body) as unknown, pins);
    if (json(page) !== json(p.page)) throw new Error('Raw/parsed page mismatch');
    after = page.rows.at(-1)?.stainID;
    return { ...p, page };
  });
  const snapshot = completeSnapshot(pages.map((p) => p.page));
  if (json(snapshot) !== json(capture.snapshot))
    throw new Error('Raw/normalized snapshot mismatch');
  return { pages, snapshot };
}
async function boundedRead(base: string, file: string): Promise<string> {
  const path = await fs.realpath(resolve(base, file));
  const child = relative(base, path);
  if (child === '..' || child.startsWith('..' + sep) || isAbsolute(child))
    throw new Error(`Bundle file escapes outside capture: ${file}`);
  const handle = await fs.open(path, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > AUDIT_LIMITS.maxBytes)
      throw new Error(`Invalid file/byte limit: ${file}`);
    const buffer = Buffer.alloc(AUDIT_LIMITS.maxBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > AUDIT_LIMITS.maxBytes) throw new Error(`Byte limit exceeded: ${file}`);
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      buffer.subarray(0, offset),
    );
  } finally {
    await handle.close();
  }
}
async function verifiedRead(base: string, value: unknown, file: string): Promise<string> {
  const d = validateDescriptor(value, file);
  const body = await boundedRead(base, d.file);
  if (Buffer.byteLength(body) !== d.bytes || hash(body) !== d.sha256)
    throw new Error(`Input integrity/hash/bytes mismatch: ${d.file}`);
  return body;
}
export async function readAuditBundle(directory: string): Promise<BundleInputs> {
  const base = await fs.realpath(directory);
  const manifestText = await boundedRead(base, 'manifest.json');
  const manifest = record(JSON.parse(manifestText) as unknown, 'manifest');
  if (manifest.formatVersion !== 1 || manifest.status !== 'complete')
    throw new Error('Unsupported bundle format or incomplete capture');
  const pins = canonicalPins(manifest.pins);
  const provenance = readProvenance(manifest.provenance);
  if (
    !Array.isArray(manifest.pages) ||
    manifest.pages.length < 2 ||
    manifest.pages.length > AUDIT_LIMITS.maxPages
  )
    throw new Error('Invalid/incomplete page count');
  const pages: CapturedPage[] = [];
  for (const [i, value] of manifest.pages.entries()) {
    const d = record(value, 'page descriptor');
    const body = await verifiedRead(
      base,
      d,
      `raw/stain-page-${String(i + 1).padStart(4, '0')}.json`,
    );
    pages.push({
      url: text(d.url, 'page URL'),
      status: integer(d.status, 'HTTP status'),
      attempts: integer(d.attempts, 'attempts'),
      body,
      page: validatePage(JSON.parse(body) as unknown, pins),
    });
  }
  const capture = validateCapture({ pages, snapshot: completeSnapshot(pages.map((p) => p.page)) });
  const inputs = record(manifest.inputs, 'input descriptors');
  const localInputs: LocalInputs = {
    dyesJson: await verifiedRead(base, inputs.dyesJson, INPUT_FILES.dyesJson),
    namesCsv: await verifiedRead(base, inputs.namesCsv, INPUT_FILES.namesCsv),
    rulesJson: await verifiedRead(base, inputs.rulesJson, INPUT_FILES.rulesJson),
  };
  const expected = json(compareStains(capture.snapshot, parseLocalCatalog(localInputs)));
  const reports = record(manifest.reports, 'report descriptors');
  const saved = await verifiedRead(base, reports.json, 'report.json');
  await verifiedRead(base, reports.markdown, 'REPORT.md');
  if (saved !== expected) throw new Error('Saved semantic report does not match validated inputs');
  return { capture, localInputs, provenance, manifestSha256: hash(manifestText) };
}
function cell(value: string | number | boolean | number[]): string {
  const source = Array.isArray(value) ? JSON.stringify(value) : String(value);
  return source
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;')
    .replaceAll('`', '&#96;')
    .replace(/[\r\n]+/g, ' ');
}
function markdown(comparison: Comparison): string {
  const lines = [
    '# Stain audit report',
    '',
    'Manual review required. Named rows are candidates, not proof of release or obtainability. This command accepts no data changes.',
    '',
    `Game: ${cell(comparison.pins.version)}; schema: ${cell(comparison.pins.schema)}.`,
    '',
    `${comparison.counts.sheetRows} sheet rows; ${comparison.counts.candidates} named candidates; ${comparison.counts.localDyes} local dyes.`,
    '',
    `Added candidates: ${comparison.addedCandidateIds.length}. Missing local rows: ${comparison.missingLocalIds.length}. Unnamed local rows: ${comparison.unnamedLocalIds.length}.`,
    '',
    `Missing local IDs: ${comparison.missingLocalIds.join(', ') || 'none'}. Unnamed local IDs: ${comparison.unnamedLocalIds.join(', ') || 'none'}.`,
    '',
    '## Added candidates',
    '',
    'Supply reviewed ko/zh names, category, acquisition, consolidation class and compatible legacy identity before adoption. No obtainability is inferred.',
    '',
    '| Stain ID | en | ja | de | fr | Color | Metallic | Housing | Item links |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of comparison.addedCandidates)
    lines.push(
      `| ${row.stainID} | ${cell(row.names.en)} | ${cell(row.names.ja)} | ${cell(row.names.de)} | ${cell(row.names.fr)} | #${row.color.toString(16).padStart(6, '0')} | ${row.isMetallic} | ${row.isHousingApplicable} | ${cell(row.items.map((item) => `${item.itemID}: ${item.name}`).join('; '))} |`,
    );
  lines.push(
    '',
    '## Differences requiring review',
    '',
    '| Stain ID | Field | Locale | Local | Upstream | Kind |',
    '|---|---|---|---|---|---|',
  );
  for (const d of comparison.differences)
    lines.push(
      `| ${d.stainID} | ${d.field} | ${d.locale ?? ''} | ${cell(d.local)} | ${cell(d.upstream)} | ${d.kind} |`,
    );
  lines.push(
    '',
    '## Source issues',
    '',
    'Korean and Chinese names are not supplied by this upstream. The saved CSV retains them.',
    '',
    '| Key | Issue | Locale |',
    '|---|---|---|',
  );
  for (const issue of comparison.sourceIssues)
    lines.push(`| ${issue.key} | ${cell(issue.code)} | ${issue.locale ?? ''} |`);
  lines.push(
    '',
    '## Excluded rows',
    '',
    ...comparison.excludedRows.map((row) => `- ${row.stainID}: ${row.classification}`),
    '',
    '## Observed Item links',
    '',
    '| Stain ID | Items (evidence only) |',
    '|---|---|',
  );
  for (const row of comparison.observedItems)
    lines.push(
      `| ${row.stainID} | ${cell(row.items.map((item) => `${item.itemID}: ${item.name}`).join('; '))} |`,
    );
  lines.push(
    '',
    'Raw pages: [raw/](raw/). Saved local inputs: [inputs/](inputs/). Provenance and hashes: [manifest.json](manifest.json).',
    '',
  );
  return lines.join('\n');
}
export async function writeAuditBundle(
  directory: string,
  inputs: BundleInputs,
  comparison: Comparison,
  provenance: Provenance,
): Promise<void> {
  const capture = validateCapture(inputs.capture);
  const actual = compareStains(capture.snapshot, parseLocalCatalog(inputs.localInputs));
  if (json(actual) !== json(comparison))
    throw new Error('Comparison does not match capture/local inputs');
  const bodies = new Map<string, string>();
  const pages = capture.pages.map((p, i) => {
    const file = `raw/stain-page-${String(i + 1).padStart(4, '0')}.json`;
    bodies.set(file, p.body);
    return { ...descriptor(file, p.body), url: p.url, status: p.status, attempts: p.attempts };
  });
  const local = Object.fromEntries(
    (Object.keys(INPUT_FILES) as (keyof LocalInputs)[]).map((key) => {
      const file = INPUT_FILES[key];
      const body = inputs.localInputs[key];
      bodies.set(file, body);
      return [key, descriptor(file, body)];
    }),
  );
  const reportJson = json(actual);
  const reportMarkdown = markdown(actual);
  bodies.set('report.json', reportJson);
  bodies.set('REPORT.md', reportMarkdown);
  const manifest = {
    formatVersion: 1,
    status: 'complete',
    pins: capture.snapshot.pins,
    provenance: readProvenance(provenance),
    pages,
    inputs: local,
    reports: {
      json: descriptor('report.json', reportJson),
      markdown: descriptor('REPORT.md', reportMarkdown),
    },
  };
  const manifestBody = json(manifest);
  descriptor('manifest.json', manifestBody);
  await fs.mkdir(directory);
  await fs.mkdir(join(directory, 'raw'));
  await fs.mkdir(join(directory, 'inputs'));
  for (const [file, body] of bodies)
    await fs.writeFile(join(directory, file), body, { encoding: 'utf8', flag: 'wx' });
  // The seal is deliberately last. Interrupted output is never a replay source.
  await fs.writeFile(join(directory, 'manifest.json'), manifestBody, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compareStains, parseLocalCatalog } from './compare.js';
import {
  completeSnapshot,
  STAIN_ENDPOINT,
  STAIN_FIELDS,
  validatePage,
  type Capture,
} from './model.js';
import { readAuditBundle, writeAuditBundle, type BundleInputs, type Provenance } from './output.js';

let root: string;
const provenance: Provenance = {
  mode: 'pinned',
  capturedAt: '2026-10-20T22:40:01.423Z',
  generatedAt: '2026-10-20T23:00:00.000Z',
  sourceRevision: 'b98c8584a85f5dc50b4b4392c508cc627ef004d6',
  sourceDirty: false,
  sourceFiles: [],
};
async function fixture(): Promise<BundleInputs> {
  const read = (file: string) =>
    fs.readFile(new URL(`./fixtures/2026-10-20/${file}`, import.meta.url), 'utf8');
  const bodies = await Promise.all(
    [1, 2, 3].map((n) => read(`stain-page-${String(n).padStart(4, '0')}.json`)),
  );
  const parsed = bodies.map((body) => validatePage(JSON.parse(body) as unknown));
  const capture: Capture = {
    snapshot: completeSnapshot(parsed),
    pages: parsed.map((page, i) => {
      const url = new URL(STAIN_ENDPOINT);
      url.searchParams.set('fields', STAIN_FIELDS);
      url.searchParams.set('language', 'en');
      url.searchParams.set('limit', '100');
      url.searchParams.set('version', page.pins.version);
      url.searchParams.set('schema', page.pins.schema);
      if (i) url.searchParams.set('after', String(parsed[i - 1].rows.at(-1)?.stainID));
      return { page, body: bodies[i], attempts: 1, status: 200, url: url.href };
    }),
  };
  return {
    capture,
    localInputs: {
      dyesJson: await read('dyes.json'),
      namesCsv: await read('dyenames.csv'),
      rulesJson: await read('rules.json'),
    },
  };
}
function report(inputs: BundleInputs) {
  return compareStains(inputs.capture.snapshot, parseLocalCatalog(inputs.localInputs));
}
async function save(directory: string, inputs?: BundleInputs): Promise<void> {
  const data = inputs ?? (await fixture());
  await writeAuditBundle(directory, data, report(data), provenance);
}
type Manifest = {
  formatVersion: number;
  pins: { version: string; schema: string };
  pages: { file: string; url: string }[];
  inputs: Record<string, { file: string; bytes: number; sha256: string }>;
};
async function manifest(directory: string): Promise<Manifest> {
  return JSON.parse(await fs.readFile(join(directory, 'manifest.json'), 'utf8')) as Manifest;
}
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'xiv-stain-output-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe('auditable bundle and offline replay', () => {
  it('replays the same semantic report bytes with raw and six-language inputs intact', async () => {
    const first = join(root, 'first');
    const second = join(root, 'second');
    await save(first);
    const replay = await readAuditBundle(first);
    expect(replay.capture.snapshot.rows).toHaveLength(129);
    expect(replay.localInputs.namesCsv).toBe((await fixture()).localInputs.namesCsv);
    await writeAuditBundle(second, replay, report(replay), {
      ...provenance,
      mode: 'replay',
      generatedAt: '2026-10-21T00:00:00.000Z',
    });
    expect(await fs.readFile(join(first, 'report.json'), 'utf8')).toBe(
      await fs.readFile(join(second, 'report.json'), 'utf8'),
    );
    expect(await fs.readFile(join(first, 'raw/stain-page-0003.json'), 'utf8')).toBe(
      (await fixture()).capture.pages[2].body,
    );
  });
  it.each([
    [
      'unknown format',
      (m: Manifest) => {
        m.formatVersion = 999;
      },
    ],
    [
      'pin mismatch',
      (m: Manifest) => {
        m.pins.version = '1111111111111111';
      },
    ],
    [
      'missing terminal page',
      (m: Manifest) => {
        m.pages.pop();
      },
    ],
    [
      'reordered pages',
      (m: Manifest) => {
        m.pages.reverse();
      },
    ],
    [
      'trailing pages',
      (m: Manifest) => {
        m.pages.push(m.pages[0]);
      },
    ],
    [
      'path traversal',
      (m: Manifest) => {
        m.pages[0].file = '../elsewhere.json';
      },
    ],
    [
      'known ID allowlist',
      (m: Manifest) => {
        m.pages[0].url += '&rows=1,2';
      },
    ],
    [
      'wrong pagination cursor',
      (m: Manifest) => {
        m.pages[1].url = m.pages[1].url.replace('after=99', 'after=1');
      },
    ],
  ] as const)('rejects %s in replay metadata', async (_label, change) => {
    const dir = join(root, 'bundle');
    await save(dir);
    const m = await manifest(dir);
    change(m);
    await fs.writeFile(join(dir, 'manifest.json'), JSON.stringify(m));
    await expect(readAuditBundle(dir)).rejects.toThrow();
  });
  it('rejects altered bytes and malformed local sources even with refreshed hashes', async () => {
    const dir = join(root, 'bundle');
    await save(dir);
    await fs.appendFile(join(dir, 'raw/stain-page-0001.json'), ' ');
    await expect(readAuditBundle(dir)).rejects.toThrow(/hash|bytes|integrity/i);
    const other = join(root, 'other');
    await save(other);
    const m = await manifest(other);
    const bad = '{}';
    await fs.writeFile(join(other, 'inputs/dyes.json'), bad);
    m.inputs.dyesJson.bytes = Buffer.byteLength(bad);
    m.inputs.dyesJson.sha256 = createHash('sha256').update(bad).digest('hex');
    await fs.writeFile(join(other, 'manifest.json'), JSON.stringify(m));
    await expect(readAuditBundle(other)).rejects.toThrow(/array|catalog/i);
  });
  it('rejects a symlink escaping the selected capture directory', async () => {
    const dir = join(root, 'bundle');
    await save(dir);
    const outside = join(root, 'outside');
    await fs.rename(join(dir, 'raw'), outside);
    await fs.symlink(outside, join(dir, 'raw'), 'junction');
    await expect(readAuditBundle(dir)).rejects.toThrow(/outside|escape|symlink/i);
  });
  it('refuses existing outputs without changing their contents', async () => {
    const dir = join(root, 'exists');
    await fs.mkdir(dir);
    await fs.writeFile(join(dir, 'keep.txt'), 'keep');
    await expect(save(dir)).rejects.toThrow(/exist/i);
    expect(await fs.readdir(dir)).toEqual(['keep.txt']);
    expect(await fs.readFile(join(dir, 'keep.txt'), 'utf8')).toBe('keep');
  });
  it('leaves no complete manifest after an interrupted write', async () => {
    const original = fs.writeFile;
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
      if (typeof args[0] === 'string' && args[0].endsWith('REPORT.md'))
        throw new Error('simulated disk failure');
      return original(...args);
    });
    const dir = join(root, 'partial');
    await expect(save(dir)).rejects.toThrow(/simulated disk/i);
    await expect(fs.access(join(dir, 'raw/stain-page-0001.json'))).resolves.toBeUndefined();
    await expect(fs.access(join(dir, 'manifest.json'))).rejects.toThrow();
    await expect(readAuditBundle(dir)).rejects.toThrow();
  });
  it('rejects inconsistent raw/normalized snapshots before creating output', async () => {
    const data = await fixture();
    data.capture.pages[0].body = '{}';
    const dir = join(root, 'invalid');
    await expect(save(dir, data)).rejects.toThrow();
    await expect(fs.access(dir)).rejects.toThrow();
  });
  it('escapes upstream table text and shows additions with their names and evidence', async () => {
    const data = await fixture();
    const wire = JSON.parse(data.capture.pages[1].body) as {
      rows: { row_id: number; fields: Record<string, unknown> }[];
    };
    wire.rows.find((row) => row.row_id === 126)!.fields.Name = '<script>|new\nrow';
    data.capture.pages[1].body = JSON.stringify(wire);
    data.capture.pages[1].page = validatePage(wire);
    data.capture.snapshot = completeSnapshot(data.capture.pages.map((page) => page.page));
    const dir = join(root, 'new');
    await save(dir, data);
    const md = await fs.readFile(join(dir, 'REPORT.md'), 'utf8');
    expect(md).toContain('&lt;script&gt;');
    expect(md).toContain('&#124;');
    expect(md).not.toContain('<script>');
    expect(md).toContain('126');
    expect(md).toContain('Manual review');
    const json = JSON.parse(await fs.readFile(join(dir, 'report.json'), 'utf8')) as {
      addedCandidates: { stainID: number; names: { en: string }; color: number }[];
    };
    expect(json.addedCandidates[0]).toMatchObject({
      stainID: 126,
      names: { en: '<script>|new\nrow' },
      color: 0,
    });
  });
});

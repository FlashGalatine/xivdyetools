/**
 * An interrupted cache write must never leave a torn envelope at the final path.
 * Kept apart from upstream.test.ts so the node:fs/promises mock stays isolated.
 */
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcquisitionSource } from '../../scripts/acquisition/upstream.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: vi.fn(actual.writeFile) };
});

const pins = { version: '0874aee069e1e7c4', schema: `exdschema@2:rev:${'a'.repeat(40)}` };
const row = { ...pins, row_id: 1, fields: { Name: 'Gil' } };
const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const dirs: string[] = [];
async function cacheDir() {
  const dir = await mkdtemp(join(tmpdir(), 'acquisition-cache-write-'));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  vi.mocked(writeFile).mockReset();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('cache write', () => {
  it('leaves no torn envelope when the write is interrupted', async () => {
    const real = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    vi.mocked(writeFile).mockImplementationOnce(async (path, data, options) => {
      const text = typeof data === 'string' ? data : String(data as Buffer);
      await real.writeFile(path, text.slice(0, Math.floor(text.length / 2)), options);
      throw new Error('simulated interrupted write');
    });
    const dir = await cacheDir();
    await expect(
      new AcquisitionSource({ ...pins, fetch: async () => jsonResponse(row), cacheDir: dir }).get(
        'sheet/Item/1',
        { fields: 'Name' },
      ),
    ).rejects.toThrow(/simulated interrupted write/);
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(
      new AcquisitionSource({ ...pins, fetch, cacheDir: dir, offline: true }).get('sheet/Item/1', {
        fields: 'Name',
      }),
    ).rejects.toThrow(/Offline acquisition cache miss/);
    expect(fetch).not.toHaveBeenCalled();
    expect(await readdir(dir)).toEqual([]);
  });
});

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { writeAcquisitionOutput } from '../../scripts/acquisition/output.js';

const paths: string[] = [];
afterEach(() => {
  for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true });
});
const names = ['acquisition.en.json', 'facewear-unlocks.json', 'acquisition.meta.json'];
function setup() {
  const path = mkdtempSync(join(tmpdir(), 'acquisition-output-'));
  paths.push(path);
  for (const name of names) writeFileSync(join(path, name), 'original');
  return path;
}
const read = (path: string) => names.map((name) => readFileSync(join(path, name), 'utf8'));

it('leaves all existing outputs intact when the final upstream review fails', async () => {
  const path = setup();
  await expect(
    writeAcquisitionOutput(
      path,
      { acquisition: 'new table', facewear: 'new mapping', meta: 'new metadata' },
      async () => {
        throw new Error('XIVAPI schema changed during review');
      },
    ),
  ).rejects.toThrow('schema changed');
  expect(read(path)).toEqual(['original', 'original', 'original']);
});

it('adopts all three exact outputs only after review finishes', async () => {
  const path = setup();
  await writeAcquisitionOutput(
    path,
    { acquisition: 'new table', facewear: 'new mapping', meta: 'new metadata' },
    async () => {
      await Promise.resolve();
      expect(read(path)).toEqual(['original', 'original', 'original']);
    },
  );
  expect(read(path)).toEqual(['new table', 'new mapping', 'new metadata']);
});

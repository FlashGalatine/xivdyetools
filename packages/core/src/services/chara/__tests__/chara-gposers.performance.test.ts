import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('formats a million internal spaces through the public source API within a bounded subprocess', () => {
  // No newline exists: the old /\s*[\r\n]+\s*/ search retries at every space.
  // Keep this isolated so a regression is killed instead of hanging Vitest.
  const source = new URL('../chara-gposers.ts', import.meta.url).href;
  const script = `
    import { gposersGroups } from ${JSON.stringify(source)};
    const input = 'A' + ' '.repeat(1_000_000) + 'B';
    const started = performance.now();
    const groups = gposersGroups({ Body: { name: input } });
    const value = groups[0][0].value;
    process.stdout.write(JSON.stringify({
      length: value.length,
      first: value[0],
      last: value.at(-1),
      unchanged: value === input,
      elapsedMs: performance.now() - started,
    }));
  `;
  const started = performance.now();
  const child = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', script],
    {
      cwd: fileURLToPath(new URL('../../../../', import.meta.url)),
      encoding: 'utf8',
      timeout: 10_000,
      killSignal: 'SIGKILL',
      windowsHide: true,
      maxBuffer: 64 * 1024,
    },
  );
  const elapsedMs = performance.now() - started;
  const diagnostic = `child elapsed=${elapsedMs.toFixed(0)}ms; status=${child.status}; stderr=${child.stderr}`;
  expect(child.error, diagnostic).toBeUndefined();
  expect(child.status, diagnostic).toBe(0);
  const output = JSON.parse(child.stdout) as {
    length: number;
    first: string;
    last: string;
    unchanged: boolean;
    elapsedMs: number;
  };
  expect(output).toMatchObject({ length: 1_000_002, first: 'A', last: 'B', unchanged: true });
  console.info(
    `GPOSERS source probe: ${elapsedMs.toFixed(0)}ms child, ${output.elapsedMs.toFixed(2)}ms formatting`,
  );
}, 20_000);

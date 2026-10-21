/** @entrypoint Manual maintenance command: pnpm --filter @xivdyetools/core run audit:dyes. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { METALLIC_STAIN_IDS } from '../src/config/dye-vocabulary.js';
import { CONSOLIDATED_IDS } from '../src/config/consolidated-ids.js';
import { compareStains, parseLocalCatalog } from './stain-audit/compare.js';
import { AUDIT_LIMITS, canonicalPins } from './stain-audit/model.js';
import { fetchStainCapture, type FetchSelection } from './stain-audit/fetch.js';
import {
  readAuditBundle,
  writeAuditBundle,
  type BundleInputs,
  type Provenance,
} from './stain-audit/output.js';

const coreRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = resolve(coreRoot, '../..');
const usage =
  'Usage: audit:dyes (--latest | --version KEY --schema REV | --snapshot DIR) --out NEW_DIR';
class UsageError extends Error {}
function options(
  args: string[],
): { out: string; selection: FetchSelection | { mode: 'replay'; snapshot: string } } | null {
  if (args.length === 1 && args[0] === '--help') return null;
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (
      !['--latest', '--version', '--schema', '--snapshot', '--out'].includes(key) ||
      flags.has(key)
    )
      throw new UsageError('Unknown or duplicate option');
    if (key === '--latest') {
      flags.set(key, 'true');
      continue;
    }
    const value = args[++i];
    if (!value?.trim() || value.startsWith('--')) throw new UsageError(`Missing value for ${key}`);
    flags.set(key, value);
  }
  const out = flags.get('--out');
  if (!out) throw new UsageError('--out is required');
  const modes =
    Number(flags.has('--latest')) +
    Number(flags.has('--snapshot')) +
    Number(flags.has('--version') || flags.has('--schema'));
  if (modes !== 1) throw new UsageError('Choose exactly one input mode');
  if (flags.has('--latest')) return { out: resolve(repoRoot, out), selection: { mode: 'latest' } };
  if (flags.has('--snapshot'))
    return {
      out: resolve(repoRoot, out),
      selection: { mode: 'replay', snapshot: resolve(repoRoot, flags.get('--snapshot')!) },
    };
  try {
    return {
      out: resolve(repoRoot, out),
      selection: {
        mode: 'pinned',
        pins: canonicalPins({ version: flags.get('--version'), schema: flags.get('--schema') }),
      },
    };
  } catch (error) {
    throw new UsageError('Both concrete --version and canonical --schema pins are required', {
      cause: error,
    });
  }
}
async function sourceFile(path: string): Promise<string> {
  const full = resolve(repoRoot, path);
  const stat = await fs.stat(full);
  if (!stat.isFile() || stat.size > AUDIT_LIMITS.maxBytes)
    throw new Error(`Source file exceeds size limit: ${path}`);
  const body = await fs.readFile(full);
  if (body.length > AUDIT_LIMITS.maxBytes)
    throw new Error(`Source file exceeds size limit: ${path}`);
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(body);
}
function revision(): { sourceRevision: string | null; sourceDirty: boolean | null } {
  try {
    const opts = {
      cwd: repoRoot,
      encoding: 'utf8' as const,
      stdio: ['ignore', 'pipe', 'ignore'] as ['ignore', 'pipe', 'ignore'],
      timeout: 5_000,
    };
    return {
      sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], opts).trim(),
      sourceDirty: !!execFileSync(
        'git',
        ['status', '--porcelain', '--untracked-files=normal'],
        opts,
      ).trim(),
    };
  } catch {
    return { sourceRevision: null, sourceDirty: null };
  }
}
async function main(): Promise<number> {
  try {
    const parsed = options(process.argv.slice(2));
    if (!parsed) {
      console.log(usage);
      console.log(
        'Offline --snapshot replays saved upstream AND local inputs. No data is adopted. Paths are relative to the repository root.',
      );
      return 0;
    }
    try {
      await fs.lstat(parsed.out);
      throw new Error(`Output already exists: ${parsed.out}`);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    const parent = await fs.stat(dirname(parsed.out));
    if (!parent.isDirectory()) throw new Error('Output parent must be an existing directory');
    let inputs: BundleInputs;
    let provenance: Provenance;
    const startedAt = new Date().toISOString();
    if (parsed.selection.mode === 'replay') {
      inputs = await readAuditBundle(parsed.selection.snapshot);
      if (!inputs.provenance || !inputs.manifestSha256)
        throw new Error('Missing replay provenance');
      provenance = {
        ...inputs.provenance,
        mode: 'replay',
        generatedAt: startedAt,
        replayedFrom: inputs.manifestSha256,
      };
    } else {
      const paths = [
        'packages/core/src/data/dyes.json',
        'packages/core/dyenames.csv',
        'packages/core/src/config/dye-vocabulary.ts',
        'packages/core/src/config/consolidated-ids.ts',
      ];
      const sources = await Promise.all(paths.map(sourceFile));
      const localInputs = {
        dyesJson: sources[0],
        namesCsv: sources[1],
        rulesJson:
          JSON.stringify(
            {
              metallicStainIds: [...METALLIC_STAIN_IDS].sort((a, b) => a - b),
              consolidatedIds: CONSOLIDATED_IDS,
            },
            null,
            2,
          ) + '\n',
      };
      parseLocalCatalog(localInputs);
      const git = revision();
      const capture = await fetchStainCapture(parsed.selection, {
        fetch: globalThis.fetch,
        now: () => Date.now(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });
      inputs = { capture, localInputs };
      provenance = {
        mode: parsed.selection.mode,
        capturedAt: startedAt,
        generatedAt: new Date().toISOString(),
        ...git,
        sourceFiles: paths.map((path, i) => ({
          path,
          sha256: createHash('sha256').update(sources[i]).digest('hex'),
        })),
      };
    }
    const comparison = compareStains(
      inputs.capture.snapshot,
      parseLocalCatalog(inputs.localInputs),
    );
    await writeAuditBundle(parsed.out, inputs, comparison, provenance);
    console.log(
      `Complete Stain audit: ${comparison.counts.sheetRows} rows, ${comparison.counts.candidates} candidates, ${comparison.addedCandidateIds.length} added; ${comparison.missingLocalIds.length} absent, ${comparison.unnamedLocalIds.length} unnamed local rows; ${comparison.differences.length} differences, ${comparison.sourceIssues.length} source issues.`,
    );
    console.log(
      `Version ${comparison.pins.version}; schema ${comparison.pins.schema}. Manual review required. Report: ${parsed.out}`,
    );
    return 0;
  } catch (error) {
    console.error(
      `${error instanceof Error ? error.message : 'Unknown audit failure'}${error instanceof UsageError ? '\n' + usage : ''}`,
    );
    return error instanceof UsageError ? 2 : 1;
  }
}
void main().then((code) => {
  process.exitCode = code;
});

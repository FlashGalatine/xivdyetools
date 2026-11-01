/**
 * FINDING-049: build artifacts are data, never publisher code. This helper uses
 * only Node built-ins, so the OIDC job needs no repo install.
 * Hashes bind the handoff, not build honesty: a compromised builder can still
 * create malicious package contents and matching hashes.
 * @entrypoint invoked directly by publish-packages.yml (Node 22 strip-types).
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const TIER_ORDER = ['types', 'logger', 'auth', 'core', 'worker-kit', 'svg', 'bot-logic'].map(
  (name) => `@xivdyetools/${name}`,
);
const REGISTRY = 'https://registry.npmjs.org/';
const PNPM_VERSION = '11.17.0';
const SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;
type JsonObject = Record<string, unknown>;
export interface Identity {
  repository: string;
  sha: string;
  runId: string;
  runAttempt: string;
}
export interface ReleaseOptions {
  sourceRoot: string;
  artifactRoot: string;
  selected: string[];
  identity: Identity;
}
interface ReleaseEntry {
  name: string;
  version: string;
  filename: string;
  sha256: string;
}
export interface VerifiedPackage extends ReleaseEntry {
  tarball: string;
  internalDependencies: Record<string, string>;
}
export interface PublishOperations {
  queryExactVersion: (name: string, version: string) => Promise<boolean>;
  publishTarball: (tarball: string) => Promise<void>;
}
export interface PublishResult {
  published: string[];
  failed: string[];
  skipped: string[];
}

function object(value: unknown): JsonObject {
  assert.ok(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'expected JSON object',
  );
  return value as JsonObject;
}
export function requireRegularFile(
  path: string,
  maxSize: number,
  stat: (path: string) => { isFile: () => boolean; size: number } = lstatSync,
): void {
  const info = stat(path);
  assert.ok(info.isFile(), `not a regular file: ${path}`);
  assert.ok(info.size <= maxSize, `oversized file: ${path}`);
}
function json(path: string): JsonObject {
  requireRegularFile(path, 1024 * 1024);
  return object(JSON.parse(readFileSync(path, 'utf8')));
}
function ordered(selected: string[]): string[] {
  assert.ok(
    Array.isArray(selected) && selected.every((name) => TIER_ORDER.includes(name)),
    'unknown package',
  );
  assert.equal(new Set(selected).size, selected.length, 'duplicate package');
  return TIER_ORDER.filter((name) => selected.includes(name));
}
function sourceManifest(root: string, name: string): JsonObject {
  assert.ok(TIER_ORDER.includes(name), `unknown dependency ${name}`);
  const manifest = json(join(root, 'packages', name.slice('@xivdyetools/'.length), 'package.json'));
  assert.equal(manifest.name, name, 'source package identity mismatch');
  assert.equal(manifest.private, undefined, 'private package cannot be published');
  assert.ok(
    typeof manifest.version === 'string' &&
      /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(manifest.version),
    'invalid version',
  );
  return manifest;
}
function entry(root: string, artifactRoot: string, name: string): ReleaseEntry {
  const source = sourceManifest(root, name);
  const filename = `${name.slice('@xivdyetools/'.length)}.tgz`;
  const path = join(artifactRoot, filename);
  requireRegularFile(path, 200 * 1024 * 1024);
  return {
    name,
    version: source.version as string,
    filename,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  };
}

/** Called after pack in the job without OIDC. Metadata is checked again by the publisher. */
export function writeRelease(options: ReleaseOptions): void {
  const packages = ordered(options.selected).map((name) =>
    entry(options.sourceRoot, options.artifactRoot, name),
  );
  writeFileSync(
    join(options.artifactRoot, 'release.json'),
    JSON.stringify({ schema: 1, ...options.identity, packages }, null, 2) + '\n',
  );
}

function tarString(header: Buffer, offset: number, length: number): string {
  const field = header.subarray(offset, offset + length);
  const end = field.indexOf(0);
  const bytes = end < 0 ? field : field.subarray(0, end);
  if (end >= 0)
    assert.ok(
      field.subarray(end).every((byte) => byte === 0),
      'ambiguous archive string',
    );
  const text = bytes.toString('utf8');
  assert.ok(
    Buffer.from(text, 'utf8').equals(bytes) && !/[\x00-\x1f\x7f]/.test(text),
    'invalid archive string',
  );
  assert.equal(text.trim(), text, 'ambiguous archive whitespace');
  return text;
}

function tarNumber(field: Buffer): number {
  assert.ok(
    field.every((byte) => byte <= 0x7f),
    'unsupported archive numeric field',
  );
  const text = field.toString('ascii');
  assert.match(text, /^[ 0-7]*\0? *$/, 'unsupported archive numeric field');
  const value = Number.parseInt(text.replace('\0', '').trim(), 8);
  assert.ok(Number.isSafeInteger(value) && value >= 0, 'invalid archive numeric field');
  return value;
}

/**
 * Accept only unambiguous USTAR files/directories, without extracting anything.
 * External tar and pnpm's tar-stream differ on aliases, extension headers and
 * zero-block end markers. Reject these forms rather than choosing one parser's
 * interpretation. gunzipSync processes concatenated gzip members; the tar end
 * check then rejects any nonzero content hidden in a later member/archive.
 */
function packedManifest(tarball: string): JsonObject {
  const archive = gunzipSync(readFileSync(tarball), { maxOutputLength: 200 * 1024 * 1024 });
  assert.equal(archive.length % 512, 0, 'truncated archive block');
  const manifests: Buffer[] = [];
  let offset = 0;
  let ended = false;
  while (offset < archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      assert.ok(archive.length - offset >= 1024, 'missing archive end blocks');
      assert.ok(
        archive.subarray(offset).every((byte) => byte === 0),
        'nonzero data after archive end',
      );
      ended = true;
      break;
    }
    const checksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    assert.equal(tarNumber(header.subarray(148, 156)), checksum, 'invalid archive checksum');
    assert.ok(
      header.subarray(257, 263).equals(Buffer.from('ustar\0')) &&
        header.subarray(263, 265).equals(Buffer.from('00')),
      'unsupported archive format',
    );
    const kind = header[156];
    assert.ok(kind === 0 || kind === 48 || kind === 53, 'unsupported archive entry type');
    assert.equal(tarString(header, 157, 100), '', 'unexpected archive link target');
    const filename = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const rawName = prefix ? `${prefix}/${filename}` : filename;
    const name = kind === 53 && rawName.endsWith('/') ? rawName.slice(0, -1) : rawName;
    assert.ok(
      (name === 'package' || name.startsWith('package/')) &&
        !name.includes('\\') &&
        name.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..') &&
        posix.normalize(name) === name,
      'noncanonical archive path',
    );
    const size = tarNumber(header.subarray(124, 136));
    assert.ok(kind !== 53 || size === 0, 'directory contains archive data');
    const start = offset + 512;
    const next = start + Math.ceil(size / 512) * 512;
    assert.ok(next <= archive.length, 'truncated archive entry');
    assert.ok(
      archive.subarray(start + size, next).every((byte) => byte === 0),
      'nonzero archive padding',
    );
    if (name === 'package/package.json') {
      assert.ok(kind !== 53 && size <= 1024 * 1024, 'invalid packed manifest');
      manifests.push(archive.subarray(start, start + size));
    }
    offset = next;
  }
  assert.ok(ended, 'missing archive end blocks');
  assert.equal(manifests.length, 1, 'expected one normalized packed package.json');
  return object(JSON.parse(manifests[0].toString('utf8')));
}

/** Validate the complete handoff before any credential-bearing publish command starts. */
export function verifyRelease(options: ReleaseOptions): VerifiedPackage[] {
  const names = ordered(options.selected);
  const release = json(join(options.artifactRoot, 'release.json'));
  assert.equal(release.schema, 1, 'unknown release schema');
  for (const [key, expected] of Object.entries(options.identity))
    assert.equal(release[key], expected, `release ${key} mismatch`);
  const entries = release.packages;
  assert.ok(Array.isArray(entries), 'missing packages');
  assert.deepEqual(
    entries.map((value: unknown) => object(value).name),
    names,
    'release selection/order mismatch',
  );
  assert.deepEqual(
    readdirSync(options.artifactRoot).sort(),
    ['release.json', ...names.map((name) => `${name.slice('@xivdyetools/'.length)}.tgz`)].sort(),
    'unexpected artifact files',
  );
  return names.map((name, i) => {
    const expected = entry(options.sourceRoot, options.artifactRoot, name);
    assert.deepEqual(entries[i], expected, `release entry/digest mismatch: ${name}`);
    const tarball = resolve(options.artifactRoot, expected.filename);
    const packed = packedManifest(tarball);
    const source = sourceManifest(options.sourceRoot, name);
    assert.equal(packed.name, source.name, 'packed name mismatch');
    assert.equal(packed.version, source.version, 'packed version mismatch');
    assert.ok(!packed.private, 'packed package is private');
    assert.ok(
      !packed.publishConfig || Object.keys(object(packed.publishConfig)).length === 0,
      'unexpected publishConfig',
    );
    assert.equal(packed.pnpm, undefined, 'unexpected packed pnpm config');
    // pnpm pack moves these reviewed publication overrides to the top level.
    // Registry/tag/directory/provenance and every unrecognized setting fail closed.
    const overrides = source.publishConfig === undefined ? {} : object(source.publishConfig);
    const safeOverrides = new Set([
      'bin',
      'engines',
      'type',
      'imports',
      'main',
      'module',
      'typings',
      'types',
      'exports',
      'browser',
      'esnext',
      'es2015',
      'unpkg',
      'umd:main',
      'os',
      'cpu',
      'libc',
      'typesVersions',
    ]);
    for (const [key, value] of Object.entries(overrides)) {
      assert.ok(safeOverrides.has(key), `unsupported source publishConfig.${key}`);
      assert.deepEqual(packed[key], value, `packed publishConfig.${key} override mismatch`);
    }
    const internalDependencies: Record<string, string> = {};
    for (const section of SECTIONS) {
      const original = source[section] === undefined ? {} : object(source[section]);
      const actual = packed[section] === undefined ? {} : object(packed[section]);
      const rewritten: Record<string, unknown> = {};
      for (const [dep, spec] of Object.entries(original)) {
        assert.equal(typeof spec, 'string', 'invalid dependency');
        if (dep.startsWith('@xivdyetools/')) {
          const version = sourceManifest(options.sourceRoot, dep).version as string;
          // Current publishable packages use workspace:* exclusively. Fail closed
          // on new range/alias forms until their rewrite is deliberately supported.
          assert.equal(spec, 'workspace:*', 'unsupported internal dependency spec');
          rewritten[dep] = version;
          internalDependencies[dep] = version;
        } else {
          assert.ok(!(spec as string).startsWith('workspace:'), 'unknown workspace dependency');
          rewritten[dep] = spec;
        }
      }
      assert.deepEqual(actual, rewritten, `packed ${section} mismatch: ${name}`);
    }
    return { ...expected, tarball, internalDependencies };
  });
}

export function publishArguments(tarball: string): string[] {
  return [
    'publish',
    resolve(tarball),
    '--ignore-scripts',
    '--provenance',
    '--access',
    'public',
    '--no-git-checks',
    `--registry=${REGISTRY}`,
  ];
}

/** Native pnpm 11 OIDC; no registry-url .npmrc placeholder, npm CLI, or repo scripts. */
export async function publishTarball(
  tarball: string,
  dryRun = false,
  command: { file: string; prefix: string[] } = { file: 'pnpm', prefix: [] },
): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'xivdyetools-publish-'));
  try {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (
        /^(?:npm_config_|pnpm_config_)/i.test(key) ||
        /^(?:NODE_AUTH_TOKEN|NPM_TOKEN|NODE_OPTIONS|NODE_PATH)$/.test(key)
      )
        delete env[key];
    }
    assert.equal(
      execFileSync(command.file, [...command.prefix, '--version'], {
        cwd,
        env,
        encoding: 'utf8',
      }).trim(),
      PNPM_VERSION,
      'publisher pnpm version mismatch',
    );
    execFileSync(
      command.file,
      [...command.prefix, ...publishArguments(tarball), ...(dryRun ? ['--dry-run'] : [])],
      {
        cwd,
        env,
        stdio: 'inherit',
        timeout: 120_000,
      },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

async function queryExactVersion(name: string, version: string): Promise<boolean> {
  const response = await fetch(
    `${REGISTRY}${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    { signal: AbortSignal.timeout(30_000), redirect: 'error' },
  );
  if (!response.ok) return false;
  const manifest = object(await response.json());
  return manifest.name === name && manifest.version === version;
}

export async function publishRelease(
  options: ReleaseOptions,
  operations: PublishOperations = { queryExactVersion, publishTarball },
): Promise<PublishResult> {
  const packages = verifyRelease(options);
  const selected = new Set(packages.map((pkg) => pkg.name));
  const blocked = new Set<string>();
  const result: PublishResult = { published: [], failed: [], skipped: [] };
  for (const pkg of packages) {
    let reason = '';
    for (const [dep, version] of Object.entries(pkg.internalDependencies)) {
      if (blocked.has(dep)) {
        reason = `${dep} failed or was skipped`;
        break;
      }
      if (!selected.has(dep)) {
        try {
          if (!(await operations.queryExactVersion(dep, version)))
            reason = `${dep}@${version} is not on npm`;
        } catch {
          reason = `could not verify ${dep}@${version} on npm`;
        }
        if (reason) break;
      }
    }
    if (reason) {
      console.error(`Skipping ${pkg.name}: ${reason}`);
      result.skipped.push(pkg.name);
      blocked.add(pkg.name);
      continue;
    }
    try {
      await operations.publishTarball(pkg.tarball);
      result.published.push(pkg.name);
    } catch (error) {
      console.error(`Failed ${pkg.name}: ${String(error)}`);
      result.failed.push(pkg.name);
      blocked.add(pkg.name);
    }
  }
  return result;
}

async function main(): Promise<void> {
  const identity: Identity = {
    repository: process.env.GITHUB_REPOSITORY ?? '',
    sha: process.env.GITHUB_SHA ?? '',
    runId: process.env.GITHUB_RUN_ID ?? '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '',
  };
  assert.match(identity.repository, /^[\w.-]+\/[\w.-]+$/);
  assert.match(identity.sha, /^[0-9a-f]{40}$/);
  assert.match(identity.runId, /^\d+$/);
  assert.match(identity.runAttempt, /^\d+$/);
  const options: ReleaseOptions = {
    sourceRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    artifactRoot: resolve(process.argv[3] ?? ''),
    selected: JSON.parse(process.env.PACKAGES_JSON ?? 'null'),
    identity,
  };
  if (process.argv[2] === 'manifest') writeRelease(options);
  else if (process.argv[2] === 'publish') {
    assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'publishing requires main');
    const result = await publishRelease(options);
    console.log(JSON.stringify(result));
    if (result.failed.length || result.skipped.length) process.exitCode = 1;
  } else throw new Error('Usage: publish-packages.ts <manifest|publish> <artifact-directory>');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

#!/usr/bin/env tsx
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  publishArguments,
  publishRelease,
  publishTarball,
  requireRegularFile,
  TIER_ORDER,
  verifyRelease,
  writeRelease,
} from './publish-packages.js';
import type { ReleaseOptions } from './publish-packages.js';

const workflowPath = fileURLToPath(
  new URL('../.github/workflows/publish-packages.yml', import.meta.url),
);
const workflow = (): string => readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n');
const pinnedPnpm = ((): string => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { packageManager?: unknown };
  const match = /^pnpm@(\d+\.\d+\.\d+)$/.exec(String(manifest.packageManager));
  if (!match) throw new Error('packageManager must pin an exact pnpm version');
  return match[1];
})();
function job(yaml: string, name: string): string {
  return (
    new RegExp(`^  ${name}:\\n[\\s\\S]*?(?=^  [a-z][\\w-]*:|$(?![\\s\\S]))`, 'm').exec(yaml)?.[0] ??
    ''
  );
}

test('FINDING-049: build/test/pack has no publishing identity', () => {
  const build = job(workflow(), 'build');
  assert.ok(build, 'missing unprivileged build job');
  assert.doesNotMatch(build, /id-token:|environment:/);
  assert.match(build, /pnpm install --frozen-lockfile/);
  assert.match(build, /pnpm turbo run build/);
  assert.match(build, /pnpm turbo run test/);
  assert.match(build, /pnpm --filter "\$pkg" pack/);
  assert.match(build, /artifact-id: \$\{\{ steps\.upload\.outputs\.artifact-id \}\}/);
  assert.match(build, /if-no-files-found: error/);
});

test('FINDING-049: production publisher only verifies and publishes same-run tarballs', () => {
  const publish = job(workflow(), 'publish');
  assert.match(publish, /needs: \[detect, build\]/);
  assert.match(publish, /github\.ref == 'refs\/heads\/main'/);
  assert.match(publish, /environment: production/);
  assert.match(publish, /id-token: write/);
  assert.doesNotMatch(
    publish,
    /pnpm install|turbo run|tsx |cache:|registry-url:|NODE_AUTH_TOKEN|NPM_TOKEN/,
  );
  assert.match(publish, /artifact-ids: \$\{\{ needs\.build\.outputs\.artifact-id \}\}/);
  assert.match(publish, /digest-mismatch: error/);
  assert.match(publish, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(publish, /persist-credentials: false/);
  assert.match(publish, /version: 11\.17\.0/);
  assert.match(publish, /run_install: false/);
  assert.match(publish, /node --experimental-strip-types .*publish-packages\.ts publish/);
  for (const action of publish.matchAll(/uses: ([^\s#]+)/g))
    assert.match(action[1], /@[0-9a-f]{40}$/);
});

test('publisher helper is reviewed source, not an artifact-supplied executable', () => {
  assert.ok(
    existsSync(fileURLToPath(new URL('./publish-packages.ts', import.meta.url))),
    'missing helper',
  );
});

test('native Node strip-types runs helper without dependencies and refuses a non-main publish', (t) => {
  const options = fixture(t, [name('types')]);
  const scripts = join(options.sourceRoot, 'scripts');
  mkdirSync(scripts);
  const helper = join(scripts, 'publish-packages.ts');
  writeFileSync(join(options.sourceRoot, 'package.json'), '{"type":"module"}');
  writeFileSync(helper, readFileSync(new URL('./publish-packages.ts', import.meta.url)));
  const env = {
    ...process.env,
    PACKAGES_JSON: JSON.stringify(options.selected),
    GITHUB_REPOSITORY: options.identity.repository,
    GITHUB_SHA: options.identity.sha,
    GITHUB_RUN_ID: options.identity.runId,
    GITHUB_RUN_ATTEMPT: options.identity.runAttempt,
    GITHUB_REF: 'refs/heads/feature',
  };
  execFileSync(
    process.execPath,
    ['--experimental-strip-types', helper, 'manifest', options.artifactRoot],
    { cwd: options.sourceRoot, env, stdio: 'pipe' },
  );
  assert.equal(verifyRelease(options).length, 1);
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ['--experimental-strip-types', helper, 'publish', options.artifactRoot],
        { cwd: options.sourceRoot, env, stdio: 'pipe' },
      ),
    (error: unknown) => {
      assert.match(String((error as { stderr: Buffer }).stderr), /publishing requires main/);
      return true;
    },
  );
});

const name = (short: string): string => `@xivdyetools/${short}`;
const INTERNAL: Record<string, string[]> = {
  core: ['types', 'logger'],
  'worker-kit': ['logger'],
  svg: ['core', 'types'],
  'bot-logic': ['core', 'svg', 'types'],
};
type Manifest = Record<string, unknown>;
function fixture(t: TestContext, selected = TIER_ORDER): ReleaseOptions {
  const root = mkdtempSync(join(tmpdir(), 'xiv-publish-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const options = {
    sourceRoot: join(root, 'source'),
    artifactRoot: join(root, 'artifact'),
    selected,
    identity: { repository: 'example/project', sha: 'a'.repeat(40), runId: '123', runAttempt: '2' },
  };
  mkdirSync(options.artifactRoot);
  for (const pkg of TIER_ORDER) {
    const short = pkg.split('/')[1];
    const dir = join(options.sourceRoot, 'packages', short);
    mkdirSync(dir, { recursive: true });
    const deps = Object.fromEntries(
      (INTERNAL[short] ?? []).map((dep) => [name(dep), 'workspace:*']),
    );
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: pkg, version: '1.2.3', dependencies: deps }),
    );
    if (selected.includes(pkg))
      pack(options, short, {
        name: pkg,
        version: '1.2.3',
        dependencies: Object.fromEntries(Object.keys(deps).map((dep) => [dep, '1.2.3'])),
      });
  }
  writeRelease(options);
  return options;
}
function pack(options: ReleaseOptions, short: string, manifest: Manifest): void {
  const stage = join(options.sourceRoot, `stage-${short}`);
  mkdirSync(join(stage, 'package'), { recursive: true });
  writeFileSync(join(stage, 'package', 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(stage, 'package', 'index.js'), 'export const fixture = true;');
  execFileSync('tar', [
    '--format=ustar',
    '-czf',
    join(options.artifactRoot, `${short}.tgz`),
    '-C',
    stage,
    'package',
  ]);
}
function mutateRelease(
  options: ReleaseOptions,
  mutate: (release: Record<string, unknown>) => void,
): void {
  const path = join(options.artifactRoot, 'release.json');
  const release = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  mutate(release);
  writeFileSync(path, JSON.stringify(release));
}
function editSource(
  options: ReleaseOptions,
  short: string,
  edit: (manifest: Manifest) => void,
): void {
  const path = join(options.sourceRoot, 'packages', short, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as Manifest;
  edit(manifest);
  writeFileSync(path, JSON.stringify(manifest));
}

test('verified handoff preserves dependency tiers and exact rewritten workspace versions', (t) => {
  const options = fixture(t, [...TIER_ORDER].reverse());
  const packages = verifyRelease(options);
  assert.deepEqual(
    packages.map((pkg) => pkg.name),
    TIER_ORDER,
  );
  assert.deepEqual(packages.find((pkg) => pkg.name === name('svg'))?.internalDependencies, {
    [name('core')]: '1.2.3',
    [name('types')]: '1.2.3',
  });
});

for (const field of ['repository', 'sha', 'runId', 'runAttempt']) {
  test(`rejects artifact from a different ${field}`, (t) => {
    const options = fixture(t, [name('types')]);
    mutateRelease(options, (release) => {
      release[field] = 'wrong';
    });
    assert.throws(() => verifyRelease(options), new RegExp(`release ${field} mismatch`));
  });
}

test('rejects corrupt tarball before invoking any publishing operation', async (t) => {
  const options = fixture(t, [name('types')]);
  writeFileSync(join(options.artifactRoot, 'types.tgz'), 'corruption');
  let calls = 0;
  await assert.rejects(
    publishRelease(options, {
      queryExactVersion: async () => {
        calls++;
        return true;
      },
      publishTarball: async () => {
        calls++;
      },
    }),
    /digest mismatch/,
  );
  assert.equal(calls, 0);
});

for (const [label, manifest] of [
  ['name', { name: name('logger'), version: '1.2.3' }],
  ['version', { name: name('types'), version: '9.9.9' }],
  ['private', { name: name('types'), version: '1.2.3', private: true }],
  [
    'publishConfig',
    {
      name: name('types'),
      version: '1.2.3',
      publishConfig: { registry: 'https://attacker.invalid/' },
    },
  ],
] as const) {
  test(`rejects packed ${label} mismatch even with matching builder hashes`, (t) => {
    const options = fixture(t, [name('types')]);
    pack(options, 'types', manifest);
    writeRelease(options);
    assert.throws(() => verifyRelease(options), new RegExp(label));
  });
}

test('verifies every archive before publishing even the first package', async (t) => {
  const options = fixture(t, [name('types'), name('logger')]);
  pack(options, 'logger', { name: name('logger'), version: '9.9.9' });
  writeRelease(options);
  let calls = 0;
  await assert.rejects(
    publishRelease(options, {
      queryExactVersion: async () => true,
      publishTarball: async () => {
        calls++;
      },
    }),
    /version mismatch/,
  );
  assert.equal(calls, 0);
});

for (const [key, value] of Object.entries({
  registry: 'https://attacker.invalid/',
  tag: 'evil',
  directory: '../../outside',
  provenance: false,
  access: 'restricted',
})) {
  test(`rejects artifact-controlled publishConfig.${key}`, (t) => {
    const options = fixture(t, [name('types')]);
    pack(options, 'types', {
      name: name('types'),
      version: '1.2.3',
      publishConfig: { [key]: value },
    });
    writeRelease(options);
    assert.throws(() => verifyRelease(options), /unexpected publishConfig/);
  });
}

test('rejects packed pnpm config and permits reviewed packed exports override', (t) => {
  const options = fixture(t, [name('types')]);
  pack(options, 'types', {
    name: name('types'),
    version: '1.2.3',
    pnpm: { config: { registry: 'https://attacker.invalid/' } },
  });
  writeRelease(options);
  assert.throws(() => verifyRelease(options), /unexpected packed pnpm config/);
  const exports = { '.': './dist/index.js' };
  editSource(options, 'types', (source) => {
    source.publishConfig = { exports };
  });
  pack(options, 'types', { name: name('types'), version: '1.2.3', exports });
  writeRelease(options);
  assert.equal(verifyRelease(options).length, 1);
  pack(options, 'types', {
    name: name('types'),
    version: '1.2.3',
    exports: { '.': './unexpected.js' },
  });
  writeRelease(options);
  assert.throws(() => verifyRelease(options), /override mismatch/);
});

test('rejects duplicate packed manifests', (t) => {
  const options = fixture(t, [name('types')]);
  const manifest = JSON.stringify({ name: name('types'), version: '1.2.3' });
  // GNU tar may encode a repeated filesystem path as a hardlink. Construct two
  // regular members so this fixture reaches manifest uniqueness on every OS.
  writeFileSync(
    join(options.artifactRoot, 'types.tgz'),
    gzipSync(
      Buffer.concat([
        tarMember('package/package.json', manifest, '0'),
        tarMember('package/package.json', manifest, '0'),
        Buffer.alloc(1024),
      ]),
    ),
  );
  writeRelease(options);
  assert.throws(() => verifyRelease(options), /expected one normalized packed package.json/);
});

function tarMember(path: string, content: string, kind = '0', target = '', prefix = ''): Buffer {
  const data = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(path, 0, 100);
  for (const [offset, length, value] of [
    [100, 8, 0o644],
    [108, 8, 0],
    [116, 8, 0],
    [124, 12, data.length],
    [136, 12, 0],
  ]) {
    header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length);
  }
  header.fill(32, 148, 156);
  header.write(kind, 156, 1);
  header.write(target, 157, 100);
  header.write('ustar\0', 257, 6);
  header.write('00', 263, 2);
  header.write(prefix, 345, 155);
  header.write(
    [...header]
      .reduce((sum, byte) => sum + byte, 0)
      .toString(8)
      .padStart(6, '0') + '\0 ',
    148,
    8,
  );
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

test('accepts canonical directory suffixes and USTAR prefix names', (t) => {
  const options = fixture(t, [name('types')]);
  writeFileSync(
    join(options.artifactRoot, 'types.tgz'),
    gzipSync(
      Buffer.concat([
        tarMember('package/', '', '5'),
        tarMember(
          'package/package.json',
          JSON.stringify({ name: name('types'), version: '1.2.3' }),
        ),
        tarMember('package/dist/', '', '5'),
        tarMember('index.js', 'export {};', '0', '', 'package/dist'),
        Buffer.alloc(1024),
      ]),
    ),
  );
  writeRelease(options);
  assert.equal(verifyRelease(options).length, 1);
});

test('rejects alias hidden in USTAR prefix and repeated directory slash', (t) => {
  const options = fixture(t, [name('types')]);
  for (const member of [
    tarMember('package.json', '{}', '0', '', 'package/.'),
    tarMember('package//', '', '5'),
  ]) {
    writeFileSync(
      join(options.artifactRoot, 'types.tgz'),
      gzipSync(
        Buffer.concat([
          tarMember(
            'package/package.json',
            JSON.stringify({ name: name('types'), version: '1.2.3' }),
          ),
          member,
          Buffer.alloc(1024),
        ]),
      ),
    );
    writeRelease(options);
    assert.throws(() => verifyRelease(options), /noncanonical archive path/);
  }
});
function tarWithSpecialEntry(type: string): Buffer {
  return gzipSync(
    Buffer.concat([
      tarMember('package/package.json', JSON.stringify({ name: name('types'), version: '1.2.3' })),
      tarMember('package/link', '', type, '../../outside'),
      Buffer.alloc(1024),
    ]),
  );
}

for (const alias of ['package/./package.json', 'package//package.json', './package/package.json']) {
  for (const beforeGood of [false, true]) {
    test(`rejects aliased manifest ${alias} ${beforeGood ? 'before' : 'after'} the good manifest`, async (t) => {
      const options = fixture(t, [name('types')]);
      const good = tarMember(
        'package/package.json',
        JSON.stringify({ name: name('types'), version: '1.2.3' }),
      );
      const evil = tarMember(
        alias,
        JSON.stringify({
          name: name('types'),
          version: '1.2.3',
          publishConfig: { registry: 'https://attacker.invalid/' },
        }),
      );
      const archive = gzipSync(
        Buffer.concat([
          ...(beforeGood ? [evil, good] : [good, evil]),
          tarMember('package/README.md', 'end'),
          Buffer.alloc(1024),
        ]),
      );
      writeFileSync(join(options.artifactRoot, 'types.tgz'), archive);
      writeRelease(options);
      let publishCalls = 0;
      await assert.rejects(
        publishRelease(options, {
          queryExactVersion: async () => true,
          publishTarball: async () => {
            publishCalls++;
          },
        }),
        /noncanonical archive path|expected one normalized packed package.json/,
      );
      assert.equal(publishCalls, 0);
    });
  }
}

test('rejects nonzero tar content after the first end marker, within one gzip member', (t) => {
  const options = fixture(t, [name('types')]);
  const good = tarMember(
    'package/package.json',
    JSON.stringify({ name: name('types'), version: '1.2.3' }),
  );
  const evil = tarMember(
    'package/package.json',
    JSON.stringify({
      name: name('types'),
      version: '1.2.3',
      publishConfig: { registry: 'https://attacker.invalid/' },
    }),
  );
  writeFileSync(
    join(options.artifactRoot, 'types.tgz'),
    gzipSync(Buffer.concat([good, Buffer.alloc(1024), evil, Buffer.alloc(1024)])),
  );
  writeRelease(options);
  assert.throws(() => verifyRelease(options), /nonzero data after archive end/);
});

test('rejects a second gzip member containing a second tar archive', (t) => {
  const options = fixture(t, [name('types')]);
  const good = gzipSync(
    Buffer.concat([
      tarMember('package/package.json', JSON.stringify({ name: name('types'), version: '1.2.3' })),
      Buffer.alloc(1024),
    ]),
  );
  const evil = gzipSync(
    Buffer.concat([
      tarMember(
        'package/package.json',
        JSON.stringify({
          name: name('types'),
          version: '1.2.3',
          publishConfig: { registry: 'https://attacker.invalid/' },
        }),
      ),
      Buffer.alloc(1024),
    ]),
  );
  writeFileSync(join(options.artifactRoot, 'types.tgz'), Buffer.concat([good, evil]));
  writeRelease(options);
  assert.throws(() => verifyRelease(options), /nonzero data after archive end/);
});

for (const [label, kind] of [
  ['PAX local', 'x'],
  ['PAX global', 'g'],
  ['GNU long name', 'L'],
  ['GNU long link', 'K'],
]) {
  test(`rejects unsupported ${label} archive metadata`, (t) => {
    const options = fixture(t, [name('types')]);
    writeFileSync(
      join(options.artifactRoot, 'types.tgz'),
      gzipSync(
        Buffer.concat([
          tarMember('package/metadata', '35 path=package/package.json\n', kind),
          tarMember(
            'package/package.json',
            JSON.stringify({ name: name('types'), version: '1.2.3' }),
          ),
          Buffer.alloc(1024),
        ]),
      ),
    );
    writeRelease(options);
    assert.throws(() => verifyRelease(options), /unsupported archive entry/);
  });
}

for (const [label, type] of [
  ['symlink', '2'],
  ['hardlink', '1'],
  ['FIFO', '6'],
]) {
  test(`rejects path-safe archive ${label} entries before publishing`, (t) => {
    const options = fixture(t, [name('types')]);
    writeFileSync(join(options.artifactRoot, 'types.tgz'), tarWithSpecialEntry(type));
    writeRelease(options);
    assert.throws(() => verifyRelease(options), /unsupported archive entry/);
  });
}

for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  test(`rejects wrong or unreplaced workspace version in ${section}`, (t) => {
    const options = fixture(t, [name('types')]);
    editSource(options, 'types', (source) => {
      source[section] = { [name('logger')]: 'workspace:*' };
    });
    for (const spec of ['workspace:*', '9.9.9']) {
      pack(options, 'types', {
        name: name('types'),
        version: '1.2.3',
        [section]: { [name('logger')]: spec },
      });
      writeRelease(options);
      assert.throws(() => verifyRelease(options), new RegExp(`packed ${section} mismatch`));
    }
  });
}

test('rejects unexpected files, duplicate selections, unknown packages, and path changes', (t) => {
  const options = fixture(t, [name('types')]);
  assert.throws(
    () => verifyRelease({ ...options, selected: [name('types'), name('types')] }),
    /duplicate/,
  );
  assert.throws(() => verifyRelease({ ...options, selected: [name('test-utils')] }), /unknown/);
  mutateRelease(options, (release) => {
    (release.packages as Manifest[])[0].filename = '../types.tgz';
  });
  assert.throws(() => verifyRelease(options), /entry\/digest mismatch/);
  writeRelease(options);
  writeFileSync(join(options.artifactRoot, 'attacker.ts'), 'throw new Error("must not run");');
  assert.throws(() => verifyRelease(options), /unexpected artifact files/);
});

test('rejects symlink tarballs', (t) => {
  const options = fixture(t, [name('types')]);
  const path = join(options.artifactRoot, 'types.tgz');
  const target = join(options.sourceRoot, 'elsewhere');
  if (process.platform === 'win32') mkdirSync(target);
  else writeFileSync(target, readFileSync(path));
  rmSync(path);
  // Junctions need no Developer Mode/admin privileges on Windows; both are
  // non-regular entries and must be rejected before any read follows the link.
  try {
    symlinkSync(target, path, process.platform === 'win32' ? 'junction' : 'file');
  } catch (error) {
    if (process.platform !== 'win32' || (error as NodeJS.ErrnoException).code !== 'EPERM')
      throw error;
    t.diagnostic(
      'Sandbox forbids junctions: exercise injected lstat link verdict plus real non-regular entry',
    );
    assert.throws(
      () => requireRegularFile(path, 100, () => ({ isFile: () => false, size: 1 })),
      /not a regular file/,
    );
    mkdirSync(path);
  }
  assert.throws(() => verifyRelease(options), /not a regular file/);
});

test('core publish failure blocks svg and bot-logic transitively but worker-kit still publishes', async (t) => {
  const options = fixture(t);
  const calls: string[] = [];
  const result = await publishRelease(options, {
    queryExactVersion: async () => {
      assert.fail('all dependencies are selected');
    },
    publishTarball: async (tarball) => {
      calls.push(tarball);
      if (tarball.endsWith('core.tgz')) throw new Error('mock registry failure');
    },
  });
  assert.deepEqual(result.failed, [name('core')]);
  assert.deepEqual(result.skipped, [name('svg'), name('bot-logic')]);
  assert.deepEqual(result.published, ['types', 'logger', 'auth', 'worker-kit'].map(name));
  assert.equal(calls.length, 5);
});

test('single package queries exact outside-run versions; missing dependency skips publish', async (t) => {
  const options = fixture(t, [name('core')]);
  const queries: [string, string][] = [];
  const result = await publishRelease(options, {
    queryExactVersion: async (dep, version) => {
      queries.push([dep, version]);
      return dep !== name('logger');
    },
    publishTarball: async () => {
      assert.fail('unavailable dependency must block');
    },
  });
  assert.deepEqual(queries, [
    [name('types'), '1.2.3'],
    [name('logger'), '1.2.3'],
  ]);
  assert.deepEqual(result.skipped, [name('core')]);
});

test('registry lookup failure blocks dependent but permits unrelated selected package', async (t) => {
  const options = fixture(t, [name('core'), name('auth')]);
  const result = await publishRelease(options, {
    queryExactVersion: async () => {
      throw new Error('mock offline');
    },
    publishTarball: async () => {},
  });
  assert.deepEqual(result.published, [name('auth')]);
  assert.deepEqual(result.skipped, [name('core')]);
});

test('dev-only workspace dependencies do not block publishing', async (t) => {
  const options = fixture(t, [name('types')]);
  editSource(options, 'types', (source) => {
    source.devDependencies = { [name('test-utils')]: 'workspace:*' };
  });
  const result = await publishRelease(options, {
    queryExactVersion: async () => {
      assert.fail('dev dependencies must not be queried');
    },
    publishTarball: async () => {},
  });
  assert.deepEqual(result.published, [name('types')]);
});

test('empty selection is a no-op and a valid single package publishes once', async (t) => {
  for (const selected of [[], [name('types')]]) {
    const options = fixture(t, selected);
    let calls = 0;
    const result = await publishRelease(options, {
      queryExactVersion: async () => true,
      publishTarball: async () => {
        calls++;
      },
    });
    assert.equal(calls, selected.length);
    assert.deepEqual(result.published, selected);
  }
});

test('publish arguments force native pnpm tarball publishing with lifecycle scripts disabled', () => {
  const args = publishArguments('fixture.tgz');
  assert.equal(args[0], 'publish');
  assert.equal(args[1], resolve('fixture.tgz'));
  for (const option of [
    '--ignore-scripts',
    '--provenance',
    '--no-git-checks',
    '--registry=https://registry.npmjs.org/',
  ])
    assert.ok(args.includes(option));
  assert.ok(args.includes('--access') && args.includes('public'));
});

test('publisher runtime imports only Node built-ins', () => {
  const source = readFileSync(new URL('./publish-packages.ts', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.ok(imports.length > 5);
  assert.ok(imports.every((specifier) => specifier.startsWith('node:')));
  assert.match(source, /mkdtempSync\(join\(tmpdir\(\), 'xivdyetools-publish-'\)\)/);
  assert.match(source, /file: 'pnpm', prefix: \[\]/);
  assert.match(source, /\.\.\.publishArguments\(tarball\)/);
});

test('pnpm pin agrees across packageManager, the publisher and the publish workflow', () => {
  const source = readFileSync(new URL('./publish-packages.ts', import.meta.url), 'utf8');
  assert.equal(
    /const PNPM_VERSION = '([^']+)'/.exec(source)?.[1],
    pinnedPnpm,
    'bump PNPM_VERSION in scripts/publish-packages.ts together with packageManager',
  );
  const pins = [...workflow().matchAll(/^\s+version: (\S+)\s*$/gm)].map((match) => match[1]);
  assert.ok(pins.length > 0, 'publish-packages.yml must pin the pnpm/action-setup version');
  assert.deepEqual(
    [...new Set(pins)],
    [pinnedPnpm],
    'bump the pnpm/action-setup version in publish-packages.yml together with packageManager',
  );
});

// Not hermetic by design: this runs the real `pnpm publish --provenance --dry-run` and fails
// closed when the installed pnpm drifts from the pinned version.
test('local pnpm dry-run cannot execute packed lifecycle hooks', async (t) => {
  let pnpmJs = process.env.PUBLISH_TEST_PNPM_JS;
  if (process.platform === 'win32' && !pnpmJs) {
    const home = process.env.PNPM_HOME ?? join(homedir(), 'AppData', 'Local', 'pnpm');
    const versions = join(home, '.tools', 'pnpm');
    const candidates = [join(home, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')];
    if (existsSync(versions)) {
      for (const version of readdirSync(versions).filter((value) =>
        new RegExp(`^${pinnedPnpm.replace(/\./g, '\\.')}(?:_|$)`).test(value),
      )) {
        candidates.push(join(versions, version, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'));
      }
    }
    pnpmJs = candidates.find((path) => existsSync(path));
    assert.ok(
      pnpmJs,
      `set PUBLISH_TEST_PNPM_JS to pnpm ${pinnedPnpm} bin/pnpm.cjs for the local dry-run (Windows has no PATH shim it can exec directly)`,
    );
  }
  const options = fixture(t, [name('types')]);
  const sentinel = join(options.sourceRoot, 'lifecycle-executed');
  const script = `node -e "require('node:fs').writeFileSync(${JSON.stringify(sentinel).replace(/"/g, '\\"')}, 'ran')"`;
  const hooks = [
    'prepublishOnly',
    'prepublish',
    'prepack',
    'prepare',
    'postpack',
    'publish',
    'postpublish',
  ];
  pack(options, 'types', {
    name: '@xivdyetools/lifecycle-fixture-never-publish',
    version: '0.0.0',
    scripts: Object.fromEntries(hooks.map((hook) => [hook, script])),
  });
  await publishTarball(
    join(options.artifactRoot, 'types.tgz'),
    true,
    pnpmJs ? { file: process.execPath, prefix: [pnpmJs] } : { file: 'pnpm', prefix: [] },
  );
  assert.equal(existsSync(sentinel), false);
});

test('rejects malformed tarball even when its builder hash matches', (t) => {
  const options = fixture(t, [name('types')]);
  writeFileSync(join(options.artifactRoot, 'types.tgz'), 'not an archive');
  writeRelease(options);
  assert.throws(() => verifyRelease(options));
  // Keep crypto in the fixture surface: the verification above must not be a
  // digest-only check that accepts arbitrary bytes with a freshly supplied hash.
  const release = JSON.parse(readFileSync(join(options.artifactRoot, 'release.json'), 'utf8'));
  assert.equal(
    release.packages[0].sha256,
    createHash('sha256').update('not an archive').digest('hex'),
  );
});

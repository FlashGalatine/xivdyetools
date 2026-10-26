/**
 * The xivcharakit license notice the web app serves at /licenses/xivcharakit.txt.
 *
 * The .chara reader ships inside the app's bundle (through @xivdyetools/core),
 * so its MIT license and third-party notices have to ship beside it. These
 * tests hold the generator to four promises: the installed texts are copied
 * byte for byte, the package is the one core actually depends on (never a
 * stray copy that happens to sit next to the web app), anything missing or
 * mismatched fails loudly, and the committed file is what the generator
 * produces today.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOTICE_OUTPUT,
  buildCharaNotice,
  locateCharaKit,
  writeCharaNotice,
} from './copy-chara-notices.mjs';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The real installed package, located the same way the build does. */
const installed = locateCharaKit(APP_DIR);
const installedLicense = readFileSync(join(installed.packageDir, 'dist', 'LICENSE'), 'utf8');
const installedNotices = readFileSync(
  join(installed.packageDir, 'dist', 'THIRD_PARTY_NOTICES.md'),
  'utf8'
);

describe('the installed xivcharakit notice', () => {
  it('copies both installed texts verbatim', () => {
    const text = buildCharaNotice(installed.packageDir, { pinnedVersion: installed.pinnedVersion });
    expect(installedLicense).toMatch(/MIT License/);
    expect(installedNotices).toMatch(/^# Third-party notices/m);
    expect(text).toContain(installedLicense);
    expect(text).toContain(installedNotices);
    // The license comes first, then the notices, each after its own separator.
    expect(text.indexOf(installedLicense)).toBeLessThan(text.indexOf(installedNotices));
  });

  it('names the package and the version core pins in its header', () => {
    const text = buildCharaNotice(installed.packageDir, { pinnedVersion: installed.pinnedVersion });
    const header = text.slice(0, text.indexOf(installedLicense));
    expect(header).toContain('xivcharakit');
    expect(header).toContain(installed.pinnedVersion);
  });

  it('pins the version core declares, exactly', () => {
    const corePkg = JSON.parse(readFileSync(join(installed.corePackageDir, 'package.json'), 'utf8'));
    expect(installed.pinnedVersion).toBe(corePkg.dependencies.xivcharakit);
  });

  it('is deterministic', () => {
    const a = buildCharaNotice(installed.packageDir, { pinnedVersion: installed.pinnedVersion });
    const b = buildCharaNotice(installed.packageDir, { pinnedVersion: installed.pinnedVersion });
    expect(a).toBe(b);
  });

  it('defaults the pin to the one core declares', () => {
    expect(buildCharaNotice(installed.packageDir)).toBe(
      buildCharaNotice(installed.packageDir, { pinnedVersion: installed.pinnedVersion })
    );
  });

  it('matches the committed public/licenses/xivcharakit.txt', () => {
    const committedFile = join(APP_DIR, NOTICE_OUTPUT);
    const committed = existsSync(committedFile) ? readFileSync(committedFile, 'utf8') : null;
    const generated = buildCharaNotice(installed.packageDir, {
      pinnedVersion: installed.pinnedVersion,
    });
    // Not toBe(): a 5 KB string diff buries the instruction. The message is
    // what a maintainer who bumped xivcharakit actually needs to read.
    if (committed !== generated) {
      throw new Error(
        `${NOTICE_OUTPUT} is ${committed === null ? 'missing' : 'out of date'} for the installed xivcharakit ${installed.pinnedVersion}. ` +
          'Run `pnpm --filter xivdyetools-web-app run copy-chara-notices` and commit the result.'
      );
    }
    expect(committed).toBe(generated);
  });
});

// ---------------------------------------------------------------------------
// Temp-dir fixtures: a web app whose core pins a kit, plus a decoy kit placed
// where a hoisted or guessed path would find it.
// ---------------------------------------------------------------------------

const LICENSE = 'MIT License\n\nCopyright (c) 2026 Fixture Author\n\nPermission is hereby granted.\n';
const NOTICES = '# Third-party notices\n\nFixture notice body — “quoted” ✓\n';

function writePackage(dir, pkg, files = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
}

describe('fixtures', () => {
  let root;
  let appDir;
  let coreDir;
  let kitDir;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'chara-notices-')));
    appDir = join(root, 'app');
    coreDir = join(appDir, 'node_modules', '@xivdyetools', 'core');
    kitDir = join(coreDir, 'node_modules', 'xivcharakit');
    writePackage(appDir, { name: 'fixture-app', private: true });
    writePackage(coreDir, {
      name: '@xivdyetools/core',
      version: '9.9.9',
      exports: { '.': './index.js', './package.json': './package.json' },
      dependencies: { xivcharakit: '1.2.3-beta.4' },
    });
    writePackage(
      kitDir,
      { name: 'xivcharakit', version: '1.2.3-beta.4' },
      { 'dist/LICENSE': LICENSE, 'dist/THIRD_PARTY_NOTICES.md': NOTICES }
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('resolves the kit through core, not one sitting beside the web app', () => {
    writePackage(
      join(appDir, 'node_modules', 'xivcharakit'),
      { name: 'xivcharakit', version: '1.2.3-beta.4' },
      { 'dist/LICENSE': 'DECOY LICENSE\n', 'dist/THIRD_PARTY_NOTICES.md': 'DECOY NOTICES\n' }
    );
    const located = locateCharaKit(appDir);
    expect(located.packageDir).toBe(realpathSync(kitDir));
    expect(located.corePackageDir).toBe(realpathSync(coreDir));
    expect(located.pinnedVersion).toBe('1.2.3-beta.4');

    const text = buildCharaNotice(located.packageDir, { pinnedVersion: located.pinnedVersion });
    expect(text).toContain(LICENSE);
    expect(text).toContain(NOTICES);
    expect(text).not.toContain('DECOY');
  });

  it('copies non-ASCII notice text byte for byte', () => {
    const text = buildCharaNotice(kitDir, { pinnedVersion: '1.2.3-beta.4' });
    const bytes = Buffer.from(text, 'utf8');
    expect(bytes.includes(Buffer.from(NOTICES, 'utf8'))).toBe(true);
    expect(bytes.includes(Buffer.from(LICENSE, 'utf8'))).toBe(true);
  });

  it('fails clearly when core does not depend on xivcharakit', () => {
    writePackage(coreDir, {
      name: '@xivdyetools/core',
      version: '9.9.9',
      exports: { './package.json': './package.json' },
      dependencies: {},
    });
    expect(() => locateCharaKit(appDir)).toThrow(/does not declare xivcharakit/);
  });

  it('fails clearly when core pins a different version than the one installed', () => {
    expect(() => buildCharaNotice(kitDir, { pinnedVersion: '1.2.3-beta.5' })).toThrow(
      /xivcharakit 1\.2\.3-beta\.4 is installed but @xivdyetools\/core pins 1\.2\.3-beta\.5/
    );
  });

  it('fails clearly when the resolved package is not xivcharakit', () => {
    writePackage(
      kitDir,
      { name: 'something-else', version: '1.2.3-beta.4' },
      { 'dist/LICENSE': LICENSE, 'dist/THIRD_PARTY_NOTICES.md': NOTICES }
    );
    expect(() => buildCharaNotice(kitDir, { pinnedVersion: '1.2.3-beta.4' })).toThrow(
      /expected package "xivcharakit".*"something-else"/
    );
  });

  it('fails clearly when dist/LICENSE is missing', () => {
    rmSync(join(kitDir, 'dist', 'LICENSE'));
    expect(() => buildCharaNotice(kitDir, { pinnedVersion: '1.2.3-beta.4' })).toThrow(
      /xivcharakit ships no dist\/LICENSE/
    );
  });

  it('fails clearly when dist/THIRD_PARTY_NOTICES.md is missing', () => {
    rmSync(join(kitDir, 'dist', 'THIRD_PARTY_NOTICES.md'));
    expect(() => buildCharaNotice(kitDir, { pinnedVersion: '1.2.3-beta.4' })).toThrow(
      /xivcharakit ships no dist\/THIRD_PARTY_NOTICES\.md/
    );
  });

  it('fails clearly when core resolves but its xivcharakit is not installed', () => {
    rmSync(kitDir, { recursive: true, force: true });
    expect(() => locateCharaKit(appDir)).toThrow(/xivcharakit is not installed for @xivdyetools\/core/);
  });

  it('refuses a notice file that is not valid UTF-8 rather than mangling it', () => {
    writeFileSync(join(kitDir, 'dist', 'LICENSE'), Buffer.from([0x4d, 0x49, 0x54, 0xff, 0x0a]));
    expect(() => buildCharaNotice(kitDir, { pinnedVersion: '1.2.3-beta.4' })).toThrow(
      /dist\/LICENSE is not valid UTF-8/
    );
  });

  it('writes the generated text to public/licenses/xivcharakit.txt under the app', () => {
    const { outFile, text } = writeCharaNotice({ appDir });
    expect(outFile).toBe(join(appDir, NOTICE_OUTPUT));
    expect(readFileSync(outFile, 'utf8')).toBe(text);
    expect(text).toContain(LICENSE);
    expect(text).toContain(NOTICES);
    expect(text).toContain('1.2.3-beta.4');
  });
});

describe('the build wiring', () => {
  it('runs the generator first, so a build never ships a stale copy', () => {
    const pkg = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8'));
    expect(pkg.scripts['copy-chara-notices']).toBe('node scripts/copy-chara-notices.mjs');
    expect(pkg.scripts.build.startsWith('node scripts/copy-chara-notices.mjs && ')).toBe(true);
  });
});

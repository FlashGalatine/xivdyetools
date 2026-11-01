import { describe, expect, it } from 'vitest';
import config from '../vitest.config.js';

/**
 * OS-independent guard for the presets test loader's `.js` alias.
 * Vite applies resolve.alias like @rollup/plugin-alias: the first entry whose
 * `find` matches an import id rewrites it with String#replace. The old catch-all
 * /^(.+)\.js$/ also rewrote dependency ids such as Hono's /@fs/.../hono/dist/index.js,
 * which then failed to load (ENOENT -> ERR_MODULE_NOT_FOUND). That only reproduced
 * under a Windows loading workload, never on the ubuntu CI runners, so this file
 * checks the alias table itself rather than a module load.
 */
type AliasEntry = { find: string | RegExp; replacement: string };

function aliasEntries(): readonly AliasEntry[] {
  const alias = config.resolve?.alias;
  if (!Array.isArray(alias)) {
    throw new Error('presets-api vitest.config.ts must declare resolve.alias as an array');
  }
  return alias as readonly AliasEntry[];
}

function applyAlias(id: string): string {
  for (const { find, replacement } of aliasEntries()) {
    const matches =
      find instanceof RegExp ? find.test(id) : id === find || id.startsWith(`${find}/`);
    if (matches) return id.replace(find, replacement);
  }
  return id;
}

describe('presets-api vitest .js alias boundary', () => {
  it.each([
    ['./utils/api-response.js', './utils/api-response'],
    ['../src/utils/api-response.js', '../src/utils/api-response'],
    ['../../src/handlers/presets.js', '../../src/handlers/presets'],
  ])('maps relative source import %s to its TypeScript module', (id, expected) => {
    expect(applyAlias(id)).toBe(expected);
  });

  it.each([
    'hono/dist/index.js',
    '@xivdyetools/test-utils/dist/index.js',
    '@scope/pkg/x.js',
    '/@fs/C:/dev/repo/node_modules/.pnpm/hono@4.13.12/node_modules/hono/dist/index.js',
    '/@fs/home/runner/work/repo/node_modules/hono/dist/index.js',
    'C:/dev/repo/node_modules/hono/dist/index.js',
    'C:\\dev\\repo\\node_modules\\hono\\dist\\index.js',
    '/home/runner/work/repo/packages/test-utils/dist/cloudflare/index.js',
    'file:///C:/dev/repo/node_modules/hono/dist/index.js',
    '.pnpm/hono/dist/index.js',
  ])('keeps the real filename of dependency id %s', (id) => {
    expect(applyAlias(id)).toBe(id);
  });

  it.each(['./data/fixture.json', './module.mjs', './component.jsx'])(
    'leaves non-.js relative id %s alone',
    (id) => {
      expect(applyAlias(id)).toBe(id);
    },
  );
});

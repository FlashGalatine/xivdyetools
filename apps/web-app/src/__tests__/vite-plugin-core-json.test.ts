import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseAst } from 'vite';
import { coreJsonCompatibility } from '../../vite-plugin-core-json';

// Exercise Linux path handling on every host; Vite only replaces backslashes on Windows.
vi.mock('vite', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vite')>();
  const { posix } = await import('node:path');
  return { ...actual, normalizePath: (id: string) => posix.normalize(id) };
});

// jsdom's Uint8Array is a different realm from Node's TextEncoder output.
// esbuild checks this invariant when its real Node API loads.
beforeAll(() => vi.stubGlobal('Uint8Array', new TextEncoder().encode('').constructor));
afterAll(() => vi.unstubAllGlobals());

const SOURCE = `export const load = () => import('./palette.json', { with: { type: 'json' } });
export const modern = (input) => input?.value ?? import.meta.url;`;
const SERVICE = '/workspace/packages/core/dist/services/CharacterColorService.js';

type Hook = (
  code: string,
  id: string,
  options?: { ssr?: boolean }
) => Promise<{ code: string; map: { mappings: string; sources: string[] } } | null>;
function transform(id = SERVICE, source = SOURCE, ssr = false) {
  const plugin = coreJsonCompatibility();
  const hook = plugin.transform as Hook;
  return hook.call(
    { environment: { config: { consumer: ssr ? 'server' : 'client' } } },
    source,
    id,
    { ssr }
  );
}

function loadImport(code: string) {
  const statement = parseAst(code).body[0];
  if (
    statement.type !== 'ExportNamedDeclaration' ||
    statement.declaration?.type !== 'VariableDeclaration'
  ) {
    throw new Error('Expected the exported lazy loader');
  }
  const loader = statement.declaration.declarations[0].init;
  if (loader?.type !== 'ArrowFunctionExpression' || loader.body.type !== 'ImportExpression') {
    throw new Error('Expected the loader to keep its dynamic import');
  }
  return loader.body;
}

describe('core JSON attributes in Vite dev', () => {
  it('removes dynamic JSON attributes while preserving the lazy import and modern syntax', async () => {
    const result = await transform();
    expect(result).not.toBeNull();
    const expression = loadImport(result!.code);
    expect(expression.source).toMatchObject({ type: 'Literal', value: './palette.json' });
    expect(expression.options).toBeNull();
    expect(result!.code).toContain('input?.value ?? import.meta.url');
  });

  it.each([
    SERVICE,
    '/workspace/packages/core/dist/services/chara/chara-shader-colors.js',
    'C:\\repo\\packages\\core\\dist\\services\\CharacterColorService.js',
    `${SERVICE}?v=hash`,
    '/repo/node_modules/@xivdyetools/core/dist/services/CharacterColorService.js',
    '/repo/node_modules/.pnpm/core/node_modules/@xivdyetools/core/dist/services/chara/chara-shader-colors.js?import',
  ])('transforms only the known compiled core module at %s', async (id) => {
    const result = await transform(id);
    expect(result).not.toBeNull();
    expect(loadImport(result!.code).options).toBeNull();
  });

  it.each([
    '/workspace/packages/core/src/services/CharacterColorService.ts',
    '/workspace/packages/core/dist/services/OtherService.js',
    '/workspace/packages/core/dist/services/CharacterColorService.js.map',
    '/workspace/packages/core/dist/services/CharacterColorService.js/other.js',
    '/workspace/packages/core/dist/services/chara-shader-colors.js',
    '/workspace/apps/web-app/src/CharacterColorService.js',
    '/repo/node_modules/some-package/dist/services/CharacterColorService.js',
  ])('leaves unrelated files alone at %s', async (id) => {
    expect(await transform(id)).toBeNull();
  });

  it('provides a source map for the original compiled module', async () => {
    const result = await transform(`${SERVICE}?v=hash`);
    expect(result!.map.mappings.length).toBeGreaterThan(0);
    expect(result!.map.sources).toEqual([SERVICE]);
  });

  it('does not apply during production builds or to server environments', async () => {
    const plugin = coreJsonCompatibility();
    expect(plugin.apply).toBe('serve');
    const applies = plugin.applyToEnvironment as (environment: {
      config: { consumer: string };
    }) => boolean;
    expect(applies({ config: { consumer: 'client' } })).toBe(true);
    expect(applies({ config: { consumer: 'server' } })).toBe(false);
    expect(await transform(SERVICE, SOURCE, true)).toBeNull();
  });
});

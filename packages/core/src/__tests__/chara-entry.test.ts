/**
 * The `@xivdyetools/core/chara` subpath entry: the bounded .chara reader and the provider-based
 * resolve, without the main barrel's color, localization and dye modules. A consumer such as the
 * web app's inspection worker imports from here so its bundle does not carry those modules.
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../index.js';
import type * as entryTypes from '../chara.js';
import type * as libraryTypes from '../services/chara/chara-library-types.js';
import type * as charaTypes from '../services/chara/chara-types.js';
import { runtimeImportGraph } from '../services/chara/__tests__/import-graph.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, '..');
const packageDir = resolve(srcDir, '..');
const entryFile = resolve(srcDir, 'chara.ts');

describe('@xivdyetools/core chara contracts', () => {
  it.each(['parseCharaFile', 'resolveCharaColors', 'OFF_GRID_DELTA_E2000'])(
    'does not export the retired %s value',
    (name) => {
      expect(Object.hasOwn(core, name)).toBe(false);
    },
  );

  it('does not export the retired parser types', () => {
    // @ts-expect-error ParsedCharaFile was retired with the legacy parser.
    expectTypeOf<core.ParsedCharaFile>();
    // @ts-expect-error CharaColorSlotRaw was retired with the legacy parser.
    expectTypeOf<core.CharaColorSlotRaw>();
    // @ts-expect-error CharaGearDye was retired with the legacy parser.
    expectTypeOf<core.CharaGearDye>();
  });

  it('retains all nine live chara types and the 8 KiB admission cap', () => {
    expectTypeOf<core.CharaSlotId>().toEqualTypeOf<charaTypes.CharaSlotId>();
    expectTypeOf<core.CharaGearSlotId>().toEqualTypeOf<charaTypes.CharaGearSlotId>();
    expectTypeOf<core.CharaSlotInertReason>().toEqualTypeOf<charaTypes.CharaSlotInertReason>();
    expectTypeOf<core.CharaSlotVerdict>().toEqualTypeOf<charaTypes.CharaSlotVerdict>();
    expectTypeOf<core.CharaSlotErrorCode>().toEqualTypeOf<charaTypes.CharaSlotErrorCode>();
    expectTypeOf<core.ResolvedCharaSlot>().toEqualTypeOf<charaTypes.ResolvedCharaSlot>();
    expectTypeOf<core.ResolvedGearDye>().toEqualTypeOf<charaTypes.ResolvedGearDye>();
    expectTypeOf<core.ResolvedCharaCharacter>().toEqualTypeOf<charaTypes.ResolvedCharaCharacter>();
    expectTypeOf<core.StainIdLookup>().toEqualTypeOf<charaTypes.StainIdLookup>();
    expect(core.MAX_CHARA_FILE_BYTES).toBe(8192);
  });
});

describe('@xivdyetools/core/chara runtime exports', () => {
  it('exports exactly inspectCharaForTools and resolveCharaWithProvider', async () => {
    const entry = await import('../chara.js');
    expect(Object.keys(entry).sort()).toEqual(['inspectCharaForTools', 'resolveCharaWithProvider']);
  });

  it('exports the same function objects as the main barrel', async () => {
    const entry = await import('../chara.js');
    expect(entry.inspectCharaForTools).toBe(core.inspectCharaForTools);
    expect(entry.resolveCharaWithProvider).toBe(core.resolveCharaWithProvider);
  });

  it('exports the import types unchanged', () => {
    expectTypeOf<entryTypes.ImportedCharaCharacter>().toEqualTypeOf<libraryTypes.ImportedCharaCharacter>();
    expectTypeOf<entryTypes.ImportedCharaSlot>().toEqualTypeOf<libraryTypes.ImportedCharaSlot>();
    expectTypeOf<entryTypes.CharaImportIssue>().toEqualTypeOf<libraryTypes.CharaImportIssue>();
    expectTypeOf<entryTypes.CharaPaletteProvider>().toEqualTypeOf<libraryTypes.CharaPaletteProvider>();
  });
});

describe('@xivdyetools/core/chara package.json exports row', () => {
  const pkg = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')) as {
    exports: Record<string, string | { types: string; import: string }>;
  };

  it('maps ./chara to the compiled entry and its declarations', () => {
    expect(pkg.exports['./chara']).toEqual({
      types: './dist/chara.d.ts',
      import: './dist/chara.js',
    });
  });

  it('sits next to ./blending in the exports map', () => {
    expect(Object.keys(pkg.exports)).toEqual(['.', './blending', './chara', './package.json']);
  });

  it.each(['./blending', './chara'])('%s follows the dist/<src path> pattern', (subpath) => {
    const row = pkg.exports[subpath] as { types: string; import: string };
    expect(Object.keys(row)).toEqual(['types', 'import']);
    expect(row.import).toMatch(/^\.\/dist\/.+\.js$/);
    expect(row.types).toBe(row.import.replace(/\.js$/, '.d.ts'));
    const source = resolve(
      packageDir,
      row.import.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts'),
    );
    expect(existsSync(source), `${source} should exist`).toBe(true);
  });
});

describe('@xivdyetools/core/chara import graph', () => {
  const forbiddenFiles = [
    'services/ColorService.ts',
    'services/color/ColorConverter.ts',
    'services/LocalizationService.ts',
    'services/DyeService.ts',
    'services/dye/DyeDatabase.ts',
    'services/PaletteService.ts',
    'services/CharacterColorService.ts',
    'services/chara/chara-palette-provider.ts',
    'services/chara/chara-shader-colors.ts',
    'services/chara/chara-parser.ts',
  ].map((file) => resolve(srcDir, file));
  const dataDir = resolve(srcDir, 'data');
  const isForbiddenPackage = (specifier: string): boolean =>
    specifier === 'spectral.js' ||
    specifier === '@xivdyetools/logger' ||
    specifier.startsWith('@xivdyetools/logger/');
  const isAllowedPackage = (specifier: string): boolean =>
    specifier === 'xivcharakit' ||
    specifier.startsWith('xivcharakit/') ||
    specifier === '@xivdyetools/types' ||
    specifier.startsWith('@xivdyetools/types/');

  function offenders(entry: string): { offending: string[]; listing: string } {
    const graph = runtimeImportGraph(entry);
    const local = [...graph.files, ...graph.unresolved];
    const offending = [
      ...local.filter(
        (file) => forbiddenFiles.includes(file) || !relative(dataDir, file).startsWith('..'),
      ),
      ...[...graph.packages].filter(isForbiddenPackage),
    ].map((file) => (file.startsWith(srcDir) ? relative(srcDir, file) : file));
    const listing = [
      'runtime closure:',
      ...[...graph.files].map((file) => `  ${relative(srcDir, file)}`).sort(),
      'unresolved relative imports:',
      ...[...graph.unresolved].map((file) => `  ${relative(srcDir, file)}`).sort(),
      'packages:',
      ...[...graph.packages].map((specifier) => `  ${specifier}`).sort(),
    ].join('\n');
    return { offending, listing };
  }

  it('the scan flags the heavy modules when walking the main barrel (control)', () => {
    const { offending } = offenders(resolve(srcDir, 'index.ts'));
    expect(offending).toEqual(
      expect.arrayContaining([relative(srcDir, forbiddenFiles[0]), 'spectral.js']),
    );
  });

  it('reaches no legacy parser, color, localization, dye, palette or data module and no logger/spectral.js', () => {
    const { offending, listing } = offenders(entryFile);
    expect(offending, listing).toEqual([]);
  });

  it('imports only xivcharakit and @xivdyetools/types at runtime', () => {
    const { packages } = runtimeImportGraph(entryFile);
    const { listing } = offenders(entryFile);
    expect(
      [...packages].filter((specifier) => !isAllowedPackage(specifier)),
      listing,
    ).toEqual([]);
  });
});

/**
 * @xivdyetools/core/chara - the xivcharakit-backed .chara reader without the rest of core
 *
 * The bounded reader and the provider-based resolve only. A consumer that brings its own palette
 * provider (the web app's inspection worker, for one) imports from here so its bundle does not
 * carry core's color, localization and dye modules, which the main barrel pulls in. The same
 * functions are exported from `@xivdyetools/core`.
 *
 * @entrypoint Reached only through the package's "./chara" exports row, which a relative-import
 * scan cannot follow. The web app's inspection worker imports this package specifier;
 * the entry-point import-graph test pins its palette-free runtime closure.
 *
 * @module chara
 */

export { inspectCharaForTools, resolveCharaWithProvider } from './services/chara/chara-library.js';
export type {
  ImportedCharaCharacter,
  ImportedCharaSlot,
  CharaImportIssue,
  CharaPaletteProvider,
} from './services/chara/chara-library-types.js';

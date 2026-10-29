/**
 * The convenience entry of the xivcharakit-backed `.chara` import: accepts the host
 * `CharacterColorService` as well as a ready palette provider.
 *
 * It lives apart from `chara-library.ts` on purpose. Bridging the service needs
 * `createCharaPaletteProvider`, which reaches the shader tables through dynamic JSON imports, and a
 * bundler emits a chunk for every reachable dynamic import target whether or not it is ever fetched.
 * Keeping that import here means a consumer that brings its own provider and imports only
 * `inspectCharaForTools` + `resolveCharaWithProvider` (the web app's inspection worker) ships none
 * of those chunks.
 */

import type { CharaInspection } from 'xivcharakit';
import type { CharacterColorService } from '../CharacterColorService.js';
import type { StainIdLookup } from './chara-types.js';
import { createCharaPaletteProvider } from './chara-palette-provider.js';
import { resolveCharaWithProvider } from './chara-library.js';
import type { CharaPaletteProvider, ImportedCharaCharacter } from './chara-library-types.js';

function isPaletteProvider(
  colors: CharacterColorService | CharaPaletteProvider,
): colors is CharaPaletteProvider {
  return typeof (colors as Partial<CharaPaletteProvider>).getColor === 'function';
}

/**
 * Interpret an inspection against the host palettes and project it for the application.
 *
 * `colors` is either the host `CharacterColorService` (bridged by `createCharaPaletteProvider`) or a
 * ready palette provider (recognized by its `getColor` function), which is used as is. Everything
 * after choosing the provider is `resolveCharaWithProvider`.
 */
export async function resolveCharaForTools(
  inspection: CharaInspection,
  colors: CharacterColorService | CharaPaletteProvider,
  dyes?: StainIdLookup,
): Promise<ImportedCharaCharacter> {
  const provider = isPaletteProvider(colors) ? colors : createCharaPaletteProvider(colors);
  return resolveCharaWithProvider(inspection, provider, dyes);
}

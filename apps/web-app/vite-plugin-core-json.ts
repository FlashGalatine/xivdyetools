import { normalizePath, transformWithEsbuild } from 'vite';
import type { Plugin } from 'vite';

// Vite serves JSON as JavaScript modules in dev, but 8.3's import analysis only
// removes static attributes. Core's compiled lazy JSON imports still need their
// attributes in native Node, so adapt only these browser-served copies.
const CORE_JSON_MODULE =
  /\/(?:packages\/core|node_modules\/@xivdyetools\/core)\/dist\/services\/(?:CharacterColorService|chara\/chara-shader-colors)\.js$/;

export function coreJsonCompatibility(): Plugin {
  return {
    name: 'core-json-compatibility',
    apply: 'serve',
    enforce: 'pre',
    applyToEnvironment: (environment) => environment.config.consumer === 'client',
    transform(code, id, options) {
      const cleanId = normalizePath(id.split('?')[0]);
      if (
        options?.ssr ||
        this.environment.config.consumer !== 'client' ||
        !CORE_JSON_MODULE.test(cleanId)
      ) {
        return null;
      }
      // Bounded bridge: this Vite API is deprecated, but Oxc currently has no
      // equivalent attribute transform. Both flags are needed: allowing either
      // syntax keeps dynamic import options. esnext preserves other JS syntax,
      // and the returned map composes with Core's existing source maps.
      return transformWithEsbuild(code, cleanId, {
        loader: 'js',
        target: 'esnext',
        supported: { 'import-attributes': false, 'import-assertions': false },
        sourcemap: true,
      });
    },
  };
}

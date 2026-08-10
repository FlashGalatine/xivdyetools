/**
 * Applies every beta-specific difference to a build, and nothing else.
 *
 * Inert unless `enabled`, so a production build's output is byte-identical to
 * one produced without this plugin. All logic lives in
 * src/shared/beta-branding.ts, which is type-checked and unit-tested; this file
 * is only the Vite wiring.
 */
import type { Plugin } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { brandHtmlForBeta, BETA_HEADERS_BLOCK } from './src/shared/beta-branding';

export function betaBranding(enabled: boolean): Plugin {
  let outDir = 'dist';

  return {
    name: 'beta-branding',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        return enabled ? brandHtmlForBeta(html) : html;
      },
    },

    // closeBundle, not writeBundle: publicDir is copied into dist during the
    // write phase, so _headers is not reliably on disk any earlier.
    closeBundle() {
      if (!enabled) return;

      const headersPath = resolve(outDir, '_headers');
      if (!existsSync(headersPath)) {
        // Hard failure by design. A beta deployment that silently ships
        // without X-Robots-Tag would get indexed and compete with production,
        // and nothing downstream would notice.
        throw new Error(
          `[beta-branding] ${headersPath} not found; refusing to publish a beta build without X-Robots-Tag`
        );
      }

      const current = readFileSync(headersPath, 'utf-8');
      if (current.includes('X-Robots-Tag')) return; // idempotent
      writeFileSync(headersPath, current + BETA_HEADERS_BLOCK, 'utf-8');
    },
  };
}

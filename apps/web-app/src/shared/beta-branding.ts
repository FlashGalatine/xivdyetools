/**
 * XIV Dye Tools - Beta build branding
 *
 * Pure string transforms applied at build time when `VITE_APP_ENV=beta`, so
 * that `beta.xivdyetools.app` is distinguishable from production at a glance
 * and stays out of search results.
 *
 * They live in `src/` rather than beside the Vite plugin deliberately: the
 * package root is outside `tsconfig`'s `include` and outside Vitest's `include`,
 * so logic placed there is neither type-checked nor testable.
 * `vite-plugin-beta-branding.ts` is a thin wrapper over this module.
 *
 * @module shared/beta-branding
 */

/** Marks a build as beta wherever the product name is shown. */
export const BETA_TITLE_PREFIX = '[BETA] ';

/** Product name without any environment marker. */
export const BASE_APP_NAME = 'XIV Dye Tools';

/** Where the beta icon set lives, relative to the site root. */
const BETA_ICON_PATH = '/assets/icons/beta/';

/**
 * Appended to `dist/_headers` for a beta build.
 *
 * Cloudflare Pages merges the rules of repeated path patterns, so a second
 * `/*` section adds this header rather than replacing the security headers
 * already declared in `public/_headers`.
 */
export const BETA_HEADERS_BLOCK = `
# ============================================================================
# Beta deployment - keep it out of search results.
# Appended at build time by vite-plugin-beta-branding. Never present in a
# production build; do not add this to public/_headers.
# ============================================================================
/*
  X-Robots-Tag: noindex, nofollow
`;

/**
 * Rewrite `index.html` for a beta build.
 *
 * Icon links are matched by their href *prefix* rather than against a list of
 * filenames, so adding an icon to `index.html` later cannot silently leave
 * beta pointing at the production artwork. The `(?!beta\/)` guard makes the
 * transform idempotent.
 */
export function brandHtmlForBeta(html: string): string {
  const titled = html.replace(/<title>([\s\S]*?)<\/title>/, (match, title: string) =>
    title.startsWith(BETA_TITLE_PREFIX) ? match : `<title>${BETA_TITLE_PREFIX}${title}</title>`
  );

  return titled.replace(/<link\b[^>]*>/g, (tag) => {
    if (!/\brel="(?:icon|apple-touch-icon)"/.test(tag)) return tag;
    return tag.replace(/\bhref="\/assets\/icons\/(?!beta\/)/, `href="${BETA_ICON_PATH}`);
  });
}

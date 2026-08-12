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
 * Origins for the social-embed rewrite.
 *
 * `og:*` / `twitter:*` URLs are absolute by protocol requirement — a crawler
 * never resolves them against the page — so unlike the icon `href`s they carry
 * a hardcoded production origin that a root-relative rewrite cannot reach.
 * Left alone, beta's embeds serve production's card and link back to
 * production, which makes a beta share indistinguishable from a live one.
 */
export const PRODUCTION_ORIGIN = 'https://xivdyetools.app';
export const BETA_ORIGIN = 'https://beta.xivdyetools.app';

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
 * Icon links (and the icon `<link rel="preload">`) are matched by their href
 * *prefix* rather than against a list of filenames, so adding an icon to
 * `index.html` later cannot silently leave beta pointing at the production
 * artwork. The `(?!beta\/)` guard makes the transform idempotent.
 */
export function brandHtmlForBeta(html: string): string {
  const titled = html.replace(/<title>([\s\S]*?)<\/title>/, (match, title: string) =>
    title.startsWith(BETA_TITLE_PREFIX) ? match : `<title>${BETA_TITLE_PREFIX}${title}</title>`
  );

  const linksRewritten = titled.replace(/<link\b[^>]*>/g, (tag) => {
    const isIconLink = /\brel="(?:icon|apple-touch-icon)"/.test(tag);
    // Scoped to .png/.ico: the beta set only ships the raster formats
    // generate-beta-icons.mjs produces. index.html also preloads
    // icon-40x40.webp (a differently-sized icon with no beta equivalent) —
    // rewriting that href would 404, so it is deliberately left alone.
    const isIconPreload =
      /\brel="preload"/.test(tag) &&
      /\bhref="\/assets\/icons\/(?!beta\/)[^"]*\.(?:png|ico)"/.test(tag);
    if (!isIconLink && !isIconPreload) return tag;
    return tag.replace(/\bhref="\/assets\/icons\/(?!beta\/)/, `href="${BETA_ICON_PATH}`);
  });

  // The X-Robots-Tag header (BETA_HEADERS_BLOCK) is the mechanism search
  // engines actually respect, but an in-page <meta name="robots"> of
  // "index, follow" left untouched would contradict it, and conflict
  // resolution between the two is not uniformly specified across crawlers.
  // Rewritten in place; never injected if absent.
  //
  // The social-embed rewrite rides the same pass. It is keyed on the tag's
  // og:/twitter: prefix rather than a list of tag names, so a social tag added
  // to index.html later cannot silently keep pointing at production — the same
  // reasoning as the prefix-matched icon rewrite above. Scoped to those tags
  // deliberately: <link rel="canonical"> still names production (beta is
  // noindex, so it has no competing canonical to declare) and prose mentions
  // of the URL are not embed targets.
  //
  // Swapping the full origin including scheme makes the transform idempotent
  // for free — BETA_ORIGIN does not contain PRODUCTION_ORIGIN as a substring,
  // so a second pass finds nothing to match.
  return linksRewritten.replace(/<meta\b[^>]*>/g, (tag) => {
    if (/\bname="robots"/.test(tag)) {
      return tag.replace(/\bcontent="[^"]*"/, 'content="noindex, nofollow"');
    }
    if (!/\b(?:property|name)="(?:og|twitter):[^"]*"/.test(tag)) return tag;
    return tag.replace(
      /\bcontent="([^"]*)"/,
      (attr, content: string) => `content="${content.split(PRODUCTION_ORIGIN).join(BETA_ORIGIN)}"`
    );
  });
}

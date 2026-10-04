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
const PRODUCTION_ORIGIN = 'https://xivdyetools.app';
export const BETA_ORIGIN = 'https://beta.xivdyetools.app';

/** The path pattern of the rule every security header lives in. */
const GLOBAL_PATTERN = '/*';

/** What a beta build adds to that rule: keep beta out of search results. */
const BETA_ROBOTS_DIRECTIVE = '  X-Robots-Tag: noindex, nofollow';

/** One path-pattern rule of a `_headers` file, in declaration order. */
interface HeaderRule {
  path: string;
  /** Lowercased header name → value. */
  headers: Map<string, string>;
  /** Index of the pattern's own line in the file. */
  line: number;
}

/**
 * Parse a `_headers` file the way Cloudflare Pages does.
 *
 * Mirrors wrangler's `parseHeaders`: every line is trimmed first, so blank
 * lines and `#` comments are skipped wherever they are indented; a line that
 * starts with `/` or a `scheme://` opens a rule; any other line holding a `:`
 * is a header of the rule above it. Rules are returned one per declaration,
 * duplicates included — collapsing them here would hide exactly the defect
 * `findDuplicatePathPatterns` exists to report.
 */
function parseHeaderRules(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    if (/^([^\s]+:\/\/|\/)/.test(line)) {
      rules.push({ path: line, headers: new Map(), line: i });
      continue;
    }
    const separator = line.indexOf(':');
    const rule = rules[rules.length - 1];
    if (separator === -1 || !rule) continue;
    rule.headers.set(
      line.slice(0, separator).trim().toLowerCase(),
      line.slice(separator + 1).trim()
    );
  }
  return rules;
}

/**
 * Path patterns declared more than once in a `_headers` file.
 *
 * Cloudflare Pages *merges* the headers of distinct patterns that overlap
 * (`/*` and `/assets/*` both apply to `/assets/app.js`), but an *identical*
 * pattern declared twice is last-wins: wrangler keys the parsed rules by path,
 * so the second declaration replaces the first outright. A repeated pattern is
 * therefore never intended, and the vite plugin refuses to write a beta
 * `_headers` that has one.
 */
export function findDuplicatePathPatterns(headers: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { path } of parseHeaderRules(headers)) {
    if (seen.has(path)) duplicates.add(path);
    seen.add(path);
  }
  return [...duplicates];
}

/**
 * Add `X-Robots-Tag: noindex, nofollow` to the global `/*` rule of a
 * `_headers` file, for a beta build.
 *
 * The directive goes INSIDE the existing rule. Until 2026-10-03 this appended a
 * second `/*` rule, on the belief that Pages merges repeated patterns; it does
 * not (see `findDuplicatePathPatterns`), so from 2026-08-09 every beta build
 * replaced the security-header rule with the robots one, and beta.xivdyetools.app
 * was served without CSP, X-Frame-Options, HSTS or Permissions-Policy
 * (2026-10-03 security audit, FINDING-001).
 *
 * Idempotent: a global rule that already carries a `noindex` X-Robots-Tag is
 * left alone. The check reads parsed header lines, never prose, so the comment
 * in `public/_headers` that names the header cannot satisfy it. The line ending
 * of the `/*` line is reused, so a CRLF checkout stays CRLF.
 *
 * Throws when the file has no `/*` rule: that is where the CSP lives, so a
 * build without one must not reach beta (or production) at all.
 */
export function addBetaHeaders(headers: string): string {
  const global = parseHeaderRules(headers).find((rule) => rule.path === GLOBAL_PATTERN);
  if (!global) {
    throw new Error(
      `[beta-branding] _headers has no ${GLOBAL_PATTERN} rule to add X-Robots-Tag to; refusing to publish a beta build without its security headers`
    );
  }
  if (/\bnoindex\b/i.test(global.headers.get('x-robots-tag') ?? '')) return headers;

  const lines = headers.split('\n');
  const eol = lines[global.line].endsWith('\r') ? '\r' : '';
  lines.splice(global.line + 1, 0, `${BETA_ROBOTS_DIRECTIVE}${eol}`);
  return lines.join('\n');
}

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
    // generate-beta-icons.mjs produces. A preload of any other icon format
    // (e.g. a .webp with no beta equivalent) is deliberately left alone —
    // rewriting its href would 404. (index.html currently preloads no icon
    // images at all; the guard stays so a future preload cannot break beta.)
    const isIconPreload =
      /\brel="preload"/.test(tag) &&
      /\bhref="\/assets\/icons\/(?!beta\/)[^"]*\.(?:png|ico)"/.test(tag);
    if (!isIconLink && !isIconPreload) return tag;
    return tag.replace(/\bhref="\/assets\/icons\/(?!beta\/)/, `href="${BETA_ICON_PATH}`);
  });

  // The X-Robots-Tag header (addBetaHeaders) is the mechanism search
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
      (_attr, content: string) => `content="${content.split(PRODUCTION_ORIGIN).join(BETA_ORIGIN)}"`
    );
  });
}

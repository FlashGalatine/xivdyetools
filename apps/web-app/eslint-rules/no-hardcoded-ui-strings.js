/**
 * ESLint Rule: no-hardcoded-ui-strings
 *
 * Warns when user-visible English reaches the DOM without going through
 * `LanguageService`. The 2026-08-20 i18n audit found ~250 such strings across
 * the web-app — every one of them stayed English in all six languages, and
 * nothing in CI could see them, because to `tsc` a label is just a string.
 *
 * Three places are checked:
 *
 *   1. Assignment to a text-bearing DOM property or attribute:
 *        el.textContent = 'No dyes found'
 *        el.setAttribute('aria-label', 'Close dialog')
 *      (`textContent`, `innerText`, `title`, `placeholder`, `aria-label`, `alt`)
 *
 *   2. The first argument of a user-facing announcement:
 *        ToastService.error('Could not load presets')
 *        AnnouncerService.announce('Copied to clipboard')
 *
 *   3. Inside a Lit `` html`` `` template — text between tags, and the value of
 *      a text-bearing attribute:
 *        html`<button title="Reset filters">Clear all</button>`
 *
 * What is deliberately NOT reported (each of these produced only noise):
 *   - single words ("Copy", "Close") and ALL-CAPS identifiers of ≤ 2 words
 *     ("STAIN", "GIL / ΔE") — too many are units, codes or already keyed;
 *   - anything inside `logger.*` / `console.*` (diagnostics are not UI);
 *   - anything inside `LanguageService.t*()` (those args are keys);
 *   - `class` / `id` / `href` / `src` / `data-*` attributes, URLs, CSS
 *     declarations and selectors, `import` specifiers;
 *   - test files.
 *
 * A string only trips the rule when it contains two whitespace-separated
 * alphabetic words of ≥ 2 letters — the shape of a sentence, not of a token.
 *
 * Severity is `warn`: the remaining offenders are tracked work, not a wall.
 *
 * @module eslint-rules/no-hardcoded-ui-strings
 */

/** DOM properties / attributes whose value is read out to the user. */
const TEXT_PROPERTIES = new Set([
  'textContent',
  'innerText',
  'title',
  'placeholder',
  'ariaLabel',
  'alt',
]);

/** The attribute spellings of the same, as they appear in `` html`` `` and `setAttribute`. */
const TEXT_ATTRIBUTES = new Set(['title', 'placeholder', 'aria-label', 'alt']);

/** Objects whose first argument is shown or announced verbatim. */
const ANNOUNCERS = new Set(['ToastService', 'AnnouncerService']);

/** Calls whose string arguments are never UI text. */
const IGNORED_CALLEE_OBJECTS = new Set(['logger', 'console', 'LanguageService']);

/** Raw-text elements: everything inside them is code, not prose. */
const RAW_TEXT_TAGS = new Set(['style', 'script']);

/**
 * Names that stay in English in all six locales — the workspace i18n rule
 * ("Brand names (XIV Dye Tools, Universalis, Discord, XIVAuth, FFXIV) stay
 * as-is"). Matched whole-string only, so "Universalis is offline" still trips.
 */
const BRAND_NAMES = new Set(['XIV Dye Tools', 'FINAL FANTASY XIV', 'SQUARE ENIX', 'Dye Tools']);

/** Two alphabetic words, whitespace-separated — the minimum shape of a sentence. */
const SENTENCE_SHAPE = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/;

/**
 * Stand-in for an expression hole while the template is scanned as HTML.
 * NUL cannot occur in source and is neither whitespace nor `<`, so it
 * neither joins two words nor looks like the start of a tag.
 */
const HOLE = '\u0000';

/**
 * Is this a string a human would read in the UI (rather than markup, CSS, a
 * URL, an identifier or a single word)?
 * @param {string} raw
 * @returns {boolean}
 */
export function looksLikeUiText(raw) {
  const text = raw.trim();
  if (text.length < 4) return false;
  if (!SENTENCE_SHAPE.test(text)) return false;

  // URLs and protocol-relative/absolute paths.
  if (/^(https?:)?\/\//.test(text) || text.includes('://')) return false;
  // (spaces allowed: an asset path with a space still has to be recognised as
  // a path, and no UI sentence starts with a slash)
  if (/^[./~]?\/[\w./ -]*$/.test(text)) return false;

  // CSS: a declaration list, a single declaration, or a selector-ish blob.
  if (/[;{}]/.test(text) && /[A-Za-z-]+\s*:\s*\S/.test(text)) return false;
  if (/^[.#]?[\w-]+(\s*[>+~,]\s*[\w.#:[\]-]+)+$/.test(text)) return false;

  // ALL-CAPS identifiers of at most two words ("GIL / ΔE", "RGB DIST -").
  // Punctuation does not count as a word, or a trailing dash would hide the
  // string from this test.
  const words = text.match(/[A-Za-z]+/g) ?? [];
  if (words.length <= 2 && text === text.toUpperCase()) return false;

  // Brand names stay in English in every locale (workspace i18n rule).
  if (BRAND_NAMES.has(text)) return false;

  // A bare dotted translation key or dotted identifier ("preset.fieldName").
  if (/^[\w$]+(\.[\w$]+)+$/.test(text)) return false;

  return true;
}

/**
 * Split an `` html`` `` template into its static text nodes and attribute
 * values, each carrying the offset it starts at in the concatenated template.
 *
 * The scanner is intentionally small: Lit templates are well-formed fragments,
 * and the only thing it has to get right is "is this offset inside a tag".
 *
 * @param {string} source - quasis joined by {@link HOLE}
 * @returns {{ kind: 'text'|'attribute', name?: string, value: string, offset: number }[]}
 */
export function scanTemplate(source) {
  const found = [];
  let i = 0;

  const readTag = () => {
    // At '<'. Read the tag name, then attributes, until the matching '>'.
    let j = i + 1;
    const closing = source[j] === '/';
    if (closing) j++;
    const nameStart = j;
    while (j < source.length && /[\w:-]/.test(source[j])) j++;
    const tagName = source.slice(nameStart, j).toLowerCase();

    while (j < source.length && source[j] !== '>') {
      if (/\s/.test(source[j])) {
        j++;
        continue;
      }
      // Attribute name — Lit prefixes bindings with . ? @
      const attrStart = j;
      while (j < source.length && /[\w.?@:-]/.test(source[j])) j++;
      if (j === attrStart) {
        j++; // stray character (e.g. the '/' of a self-closing tag)
        continue;
      }
      const attrName = source
        .slice(attrStart, j)
        .replace(/^[.?@]/, '')
        .toLowerCase();
      while (j < source.length && /\s/.test(source[j])) j++;
      if (source[j] !== '=') continue;
      j++;
      while (j < source.length && /\s/.test(source[j])) j++;
      const quote = source[j];
      if (quote === '"' || quote === "'") {
        const valueStart = ++j;
        while (j < source.length && source[j] !== quote) j++;
        found.push({
          kind: 'attribute',
          name: attrName,
          value: source.slice(valueStart, j),
          offset: valueStart,
        });
        j++; // closing quote
      } else {
        while (j < source.length && !/[\s>]/.test(source[j])) j++;
      }
    }

    i = j < source.length ? j + 1 : j;
    return { tagName, closing };
  };

  while (i < source.length) {
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i);
      i = end === -1 ? source.length : end + 3;
      continue;
    }

    if (source[i] === '<') {
      const { tagName, closing } = readTag();
      if (!closing && RAW_TEXT_TAGS.has(tagName)) {
        const end = source.toLowerCase().indexOf(`</${tagName}`, i);
        i = end === -1 ? source.length : end;
      }
      continue;
    }

    const start = i;
    while (i < source.length && source[i] !== '<') i++;
    const chunk = source.slice(start, i);
    // Static text around each `${...}` hole is its own candidate.
    let cursor = 0;
    for (const piece of chunk.split(HOLE)) {
      if (piece.trim()) found.push({ kind: 'text', value: piece, offset: start + cursor });
      cursor += piece.length + HOLE.length;
    }
  }

  return found;
}

const isIgnoredCall = (node) =>
  node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  node.callee.object.type === 'Identifier' &&
  IGNORED_CALLEE_OBJECTS.has(node.callee.object.name);

/** @type {import('eslint').Rule.RuleModule} */
export const noHardcodedUiStrings = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow user-visible English string literals that bypass LanguageService',
      recommended: false,
    },
    messages: {
      hardcoded:
        'Hard-coded UI string {{ text }} ({{ where }}). Add a key to src/locales/en.json (and the other five) and render it with LanguageService.t().',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const filename = context.filename;
    if (/[\\/]__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)) return {};

    /** Bail out for anything nested inside a logger/console/LanguageService call. */
    const insideIgnoredCall = (node) => {
      for (let cursor = node.parent; cursor; cursor = cursor.parent) {
        if (isIgnoredCall(cursor)) return true;
      }
      return false;
    };

    /**
     * @param {object} anchor - `{ node }`, or `{ loc }` for a slice of a template
     * @param {string} value
     * @param {string} where - human description of the position
     */
    const check = (anchor, value, where) => {
      if (typeof value !== 'string') return;
      if (!looksLikeUiText(value)) return;
      const trimmed = value.trim();
      context.report({
        ...anchor,
        messageId: 'hardcoded',
        data: {
          text: JSON.stringify(trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed),
          where,
        },
      });
    };

    /** Check a string-valued expression (literal or template) in a non-html position. */
    const checkExpression = (node, where) => {
      if (!node) return;
      if (node.type === 'Literal' && typeof node.value === 'string') {
        check({ node }, node.value, where);
      } else if (node.type === 'TemplateLiteral') {
        for (const quasi of node.quasis)
          check({ node: quasi }, quasi.value.cooked ?? quasi.value.raw, where);
      }
    };

    return {
      // (1) el.textContent = '…' / el.title = '…'
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') return;
        const property = node.left.property;
        const name =
          property.type === 'Identifier' && !node.left.computed
            ? property.name
            : property.type === 'Literal'
              ? String(property.value)
              : null;
        if (!name || !TEXT_PROPERTIES.has(name)) return;
        if (insideIgnoredCall(node)) return;
        checkExpression(node.right, `assigned to .${name}`);
      },

      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression' || node.callee.object.type !== 'Identifier')
          return;
        const objectName = node.callee.object.name;
        const methodName =
          node.callee.property.type === 'Identifier' ? node.callee.property.name : '';

        // (1b) el.setAttribute('aria-label', '…')
        if (methodName === 'setAttribute' && node.arguments.length >= 2) {
          const attribute = node.arguments[0];
          if (
            attribute.type === 'Literal' &&
            typeof attribute.value === 'string' &&
            TEXT_ATTRIBUTES.has(attribute.value.toLowerCase())
          ) {
            if (!insideIgnoredCall(node)) {
              checkExpression(node.arguments[1], `setAttribute('${attribute.value}', …)`);
            }
          }
          return;
        }

        // (2) ToastService.*(…) / AnnouncerService.announce(…)
        if (!ANNOUNCERS.has(objectName)) return;
        if (objectName === 'AnnouncerService' && methodName !== 'announce') return;
        checkExpression(node.arguments[0], `${objectName}.${methodName}() message`);
      },

      // (3) html`…` — text between tags and text-bearing attributes
      TaggedTemplateExpression(node) {
        if (node.tag.type !== 'Identifier' || node.tag.name !== 'html') return;
        if (insideIgnoredCall(node)) return;

        const quasis = node.quasi.quasis;
        // `raw`, not `cooked`: raw text maps 1:1 onto source characters, so the
        // offsets the scanner returns can be turned back into a source range
        // and the warning points at the string instead of at the backtick.
        const parts = quasis.map((q) => q.value.raw);
        /** @type {number[]} */
        const starts = [];
        let source = '';
        parts.forEach((part, index) => {
          starts.push(source.length);
          source += part;
          if (index < parts.length - 1) source += HOLE;
        });

        /**
         * Turn a template offset + length into an ESLint report anchor.
         * A quasi's own range starts on its delimiter (the opening backtick, or
         * the `}` that closed the previous hole), hence the +1.
         */
        const anchorFor = (offset, length) => {
          let index = 0;
          for (let i = parts.length - 1; i >= 0; i--) {
            if (offset >= starts[i]) {
              index = i;
              break;
            }
          }
          const quasi = quasis[index];
          if (!quasi.range) return { node: quasi };
          const from = quasi.range[0] + 1 + (offset - starts[index]);
          return {
            loc: {
              start: sourceCode.getLocFromIndex(from),
              end: sourceCode.getLocFromIndex(Math.min(from + length, sourceCode.text.length)),
            },
          };
        };

        for (const item of scanTemplate(source)) {
          if (item.value.includes(HOLE)) continue;
          const anchor = anchorFor(item.offset, item.value.length);
          if (item.kind === 'attribute') {
            if (!TEXT_ATTRIBUTES.has(item.name)) continue;
            check(anchor, item.value, `html\`\` ${item.name} attribute`);
          } else {
            check(anchor, item.value, 'html`` template text');
          }
        }
      },
    };
  },
};

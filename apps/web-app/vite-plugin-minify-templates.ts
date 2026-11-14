import { normalizePath, parseAst } from 'vite';
import type { Plugin } from 'vite';

/**
 * Collapses insignificant whitespace inside Lit `html`, `svg` and `css` tagged
 * templates in production builds.
 *
 * Why it exists: the minifier leaves template literal contents alone, so every
 * line of indentation inside a Lit template shipped as written. Measured on
 * 2026-11-13 that was about 63 KB across the emitted chunks, half of it in the
 * layout shell, and the JS payload sat 293 B under its limit.
 *
 * What it changes, and nothing else:
 *
 *   html / svg   A whitespace run in text becomes ONE character: a newline if
 *                the run held one, otherwise a space. A run between attributes
 *                becomes one space. It is never removed outright, because a
 *                space between two inline elements is visible.
 *   css          A whitespace run becomes one space, and goes entirely next to
 *                `{`, `}` and `;`. A comment that has whitespace beside it goes
 *                with that whitespace.
 *
 * What it never touches: `${...}` expressions, attribute values, HTML comments,
 * the contents of `<pre>`, `<textarea>`, `<script>`, `<style>` and friends, CSS
 * strings, whitespace around `:`, `,` and the operators in `calc()`, and any
 * template that contains a backslash (an escape can cook into a quote or a
 * bracket, and this reads source text, not cooked text).
 *
 * The one thing it cannot see is CSS applied from elsewhere. An element styled
 * `white-space: pre` or `pre-wrap` shows template whitespace as written, so its
 * text must come from an `${expression}` (which is never touched) or sit in a
 * `<pre>`. `pre-line` is safe: line breaks survive, only the indentation goes.
 *
 * Build only (`apply: 'build'`), so `vite dev` and vitest see the source as
 * written. The Playwright suite must be run against `vite preview` to exercise
 * this; the dev server does not.
 */

const WS = /[ \t\n\r\f]/;
const HAS_NEWLINE = /[\n\r]/;
const HAS_BLANK = /[ \t\f]/;

/** Elements whose text content is kept exactly as written. */
const RAW_TEXT_ELEMENTS = new Set([
  'pre',
  'textarea',
  'script',
  'style',
  'title',
  'listing',
  'xmp',
  'plaintext',
]);

/** One replacement inside a single quasi, in that quasi's own offsets. */
interface Gap {
  start: number;
  end: number;
  text: string;
}

function applyGaps(text: string, gaps: readonly Gap[]): string {
  let out = '';
  let cursor = 0;
  for (const gap of gaps) {
    out += text.slice(cursor, gap.start) + gap.text;
    cursor = gap.end;
  }
  return out + text.slice(cursor);
}

/** Read a whitespace run starting at `from`; returns the index after it. */
function endOfWhitespace(text: string, from: number): number {
  let i = from;
  while (i < text.length && WS.test(text[i])) i++;
  return i;
}

// ============================================================================
// HTML / SVG
// ============================================================================

/**
 * Collapse whitespace in the static parts of one `html` or `svg` template.
 *
 * `quasis` are the raw source texts between expressions, in order. The parser
 * state carries from one to the next, because a tag or a quoted attribute
 * routinely spans an expression (`class="a ${b} c"`).
 *
 * A mixed run (line break plus indentation) becomes a newline in HTML, where
 * `white-space: pre-line` must keep its breaks, and a space in SVG, where the
 * SVG 1.1 text rules drop newlines before collapsing spaces, so a break plus
 * indentation between two words reads as one space and must not vanish.
 *
 * @testonly the string-in, string-out form the unit tests in
 * src/__tests__/vite-plugin-minify-templates.test.ts assert the HTML and SVG
 * rules against; the build path works on offsets, for the source map.
 */
export function collapseHtmlWhitespace(quasis: readonly string[], inSvg = false): string[] {
  return htmlGaps(quasis, inSvg).map((gaps, index) => applyGaps(quasis[index], gaps));
}

function htmlGaps(quasis: readonly string[], inSvg: boolean): Gap[][] {
  type State = 'text' | 'tag' | 'dq' | 'sq' | 'unquoted' | 'comment' | 'raw';
  let state: State = 'text';
  let tagName = '';
  let closingTag = false;
  let afterEquals = false;
  let rawElement = '';
  let svgDepth = inSvg ? 1 : 0;

  const out: Gap[][] = [];
  for (const text of quasis) {
    const gaps: Gap[] = [];
    const collapse = (start: number, end: number, replacement: string): void => {
      if (text.slice(start, end) !== replacement) gaps.push({ start, end, text: replacement });
    };
    let i = 0;
    // An expression sits between two quasis. In `a=${x} b` the value was the
    // expression, so nothing here is still waiting for one; an unquoted value
    // that the expression was part of (`a=x${y}z`) carries on.
    afterEquals = false;

    while (i < text.length) {
      const ch = text[i];

      if (state === 'comment') {
        const end = text.indexOf('-->', i);
        i = end === -1 ? text.length : end + 3;
        if (end !== -1) state = 'text';
        continue;
      }

      if (state === 'raw') {
        const close = new RegExp(`</${rawElement}(?![A-Za-z0-9:_-])`, 'i').exec(text.slice(i));
        i = close ? i + close.index : text.length;
        if (close) state = 'text';
        continue;
      }

      if (state === 'dq' || state === 'sq') {
        const end = text.indexOf(state === 'dq' ? '"' : "'", i);
        i = end === -1 ? text.length : end + 1;
        if (end !== -1) state = 'tag';
        continue;
      }

      if (state === 'unquoted') {
        // Whitespace or `>` ends the value; the tag state handles either.
        if (WS.test(ch) || ch === '>') state = 'tag';
        else i++;
        continue;
      }

      if (state === 'tag') {
        if (WS.test(ch)) {
          const end = endOfWhitespace(text, i);
          collapse(i, end, ' ');
          i = end;
          continue;
        }
        i++;
        if (ch === '>') {
          const name = tagName.toLowerCase();
          if (name === 'svg') svgDepth = Math.max(0, svgDepth + (closingTag ? -1 : 1));
          if (!closingTag && RAW_TEXT_ELEMENTS.has(name)) {
            state = 'raw';
            rawElement = name;
          } else {
            state = 'text';
          }
          afterEquals = false;
        } else if (ch === '=') {
          afterEquals = true;
        } else if (afterEquals) {
          afterEquals = false;
          state = ch === '"' ? 'dq' : ch === "'" ? 'sq' : 'unquoted';
        }
        continue;
      }

      // state === 'text'
      if (ch === '<') {
        if (text.startsWith('<!--', i)) {
          state = 'comment';
          i += 4;
          continue;
        }
        const isClose = text[i + 1] === '/';
        const nameStart = isClose ? i + 2 : i + 1;
        if (/[A-Za-z]/.test(text[nameStart] ?? '')) {
          let nameEnd = nameStart;
          while (nameEnd < text.length && /[A-Za-z0-9:_-]/.test(text[nameEnd])) nameEnd++;
          tagName = text.slice(nameStart, nameEnd);
          closingTag = isClose;
          state = 'tag';
          afterEquals = false;
          i = nameEnd;
          continue;
        }
        if (nameStart >= text.length) {
          // `<${tag}` or `</${tag}`: a tag whose name is an expression.
          tagName = '';
          closingTag = isClose;
          state = 'tag';
          afterEquals = false;
          i = text.length;
          continue;
        }
        // A bare `<` in text.
        i++;
        continue;
      }
      if (WS.test(ch)) {
        const end = endOfWhitespace(text, i);
        const run = text.slice(i, end);
        if (!HAS_NEWLINE.test(run)) collapse(i, end, ' ');
        else if (svgDepth > 0 && HAS_BLANK.test(run)) collapse(i, end, ' ');
        else collapse(i, end, '\n');
        i = end;
        continue;
      }
      i++;
    }
    out.push(gaps);
  }
  return out;
}

// ============================================================================
// CSS
// ============================================================================

/**
 * Collapse whitespace in the static parts of one `css` template.
 *
 * Any run of CSS whitespace is one whitespace token, so one space is always
 * equivalent. It is removed outright only beside `{`, `}` and `;`, where no
 * grammar gives it meaning. It stays beside `:` (`a :hover` is not `a:hover`),
 * beside `+` and `-` (`calc(1px + 2px)`), and beside an expression, whose value
 * this cannot see.
 *
 * @testonly the string-in, string-out form the unit tests in
 * src/__tests__/vite-plugin-minify-templates.test.ts assert the stylesheet
 * rules against; the build path works on offsets, for the source map.
 */
export function collapseCssWhitespace(quasis: readonly string[]): string[] {
  return cssGaps(quasis).map((gaps, index) => applyGaps(quasis[index], gaps));
}

function cssGaps(quasis: readonly string[]): Gap[][] {
  type State = 'normal' | 'dq' | 'sq' | 'comment';
  let state: State = 'normal';
  const out: Gap[][] = [];

  for (const text of quasis) {
    const gaps: Gap[] = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];

      if (state === 'comment') {
        // A comment that began in an earlier quasi wraps an expression. Keep it.
        const end = text.indexOf('*/', i);
        i = end === -1 ? text.length : end + 2;
        if (end !== -1) state = 'normal';
        continue;
      }

      if (state === 'dq' || state === 'sq') {
        const end = text.indexOf(state === 'dq' ? '"' : "'", i);
        i = end === -1 ? text.length : end + 1;
        if (end !== -1) state = 'normal';
        continue;
      }

      if (WS.test(ch) || text.startsWith('/*', i)) {
        // A gap: whitespace and whole comments, in any order.
        let gapEnd = i;
        let sawWhitespace = false;
        let unterminated = false;
        for (;;) {
          if (gapEnd < text.length && WS.test(text[gapEnd])) {
            gapEnd = endOfWhitespace(text, gapEnd);
            sawWhitespace = true;
          } else if (text.startsWith('/*', gapEnd)) {
            const end = text.indexOf('*/', gapEnd + 2);
            if (end === -1) {
              unterminated = true;
              break;
            }
            gapEnd = end + 2;
          } else {
            break;
          }
        }
        // Comments with no whitespace beside them separate two tokens that
        // would otherwise fuse (`a/**/b`). Leave those.
        if (sawWhitespace) {
          // The character before a gap is never whitespace: it is a kept
          // character, or nothing at all when the quasi follows an expression
          // (whose value is unknown, so a space stays).
          const before = i > 0 ? text[i - 1] : '';
          const after = unterminated ? '' : (text[gapEnd] ?? '');
          const removable = '{};'.includes(before || ' ') || '{};'.includes(after || ' ');
          const replacement = removable ? '' : ' ';
          if (text.slice(i, gapEnd) !== replacement) {
            gaps.push({ start: i, end: gapEnd, text: replacement });
          }
        }
        if (unterminated) {
          i = text.length;
          state = 'comment';
        } else {
          i = gapEnd;
        }
        continue;
      }

      if (ch === '"') state = 'dq';
      else if (ch === "'") state = 'sq';
      i++;
    }
    out.push(gaps);
  }
  return out;
}

// ============================================================================
// Source transform
// ============================================================================

interface Edit {
  start: number;
  end: number;
  text: string;
}

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';
}

function walk(node: AstNode, visit: (node: AstNode) => void): void {
  visit(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit);
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

type TemplateKind = 'html' | 'svg' | 'css';
const LIT_MODULE = /^(?:lit|lit-html|lit-element|@lit\/reactive-element)(?:\/|$)/;
const TAG_KIND = new Map<string, TemplateKind>([
  ['html', 'html'],
  ['svg', 'svg'],
  ['css', 'css'],
]);

/** Local name -> template kind, for the tags this module imports from Lit. */
function litTags(program: AstNode): Map<string, TemplateKind> {
  const tags = new Map<string, TemplateKind>();
  for (const statement of program.body as AstNode[]) {
    if (statement.type !== 'ImportDeclaration') continue;
    const source = (statement.source as { value?: unknown }).value;
    if (typeof source !== 'string' || !LIT_MODULE.test(source)) continue;
    for (const specifier of statement.specifiers as AstNode[]) {
      if (specifier.type !== 'ImportSpecifier') continue;
      const imported = specifier.imported as { name?: string; value?: string };
      const kind = TAG_KIND.get(imported.name ?? imported.value ?? '');
      if (kind) tags.set((specifier.local as { name: string }).name, kind);
    }
  }
  return tags;
}

/**
 * Find every Lit template in `code` and return the edits that collapse it,
 * in source order. Empty when the module has nothing to do.
 */
export function collectTemplateEdits(code: string): Edit[] {
  const program = parseAst(code, { lang: 'ts' }) as unknown as AstNode;
  const tags = litTags(program);
  if (tags.size === 0) return [];

  const edits: Edit[] = [];
  walk(program, (node) => {
    if (node.type !== 'TaggedTemplateExpression') return;
    const tag = node.tag as AstNode & { name?: string };
    if (tag.type !== 'Identifier' || !tag.name) return;
    const kind = tags.get(tag.name);
    if (!kind) return;

    const elements = (node.quasi as AstNode).quasis as (AstNode & { tail: boolean })[];
    // The parser reports each element with its delimiters: a leading backtick
    // or `}`, and a trailing backtick or `${`. Strip them to get the raw text.
    const ranges = elements.map((el) => ({
      start: el.start + 1,
      end: el.end - (el.tail ? 1 : 2),
    }));
    const raws = ranges.map((r) => code.slice(r.start, r.end));
    // Skip, never guess. A range that does not sit between its delimiters
    // means the parser's convention changed; and an escape sequence can cook
    // into a quote or a bracket that the source text does not show.
    const delimited = ranges.every(
      (r, index) =>
        r.start <= r.end &&
        (code[r.start - 1] === '`' || code[r.start - 1] === '}') &&
        (elements[index].tail ? code[r.end] === '`' : code.startsWith('${', r.end))
    );
    if (!delimited || raws.some((raw) => raw.includes('\\'))) return;

    const gapsPerQuasi = kind === 'css' ? cssGaps(raws) : htmlGaps(raws, kind === 'svg');
    gapsPerQuasi.forEach((gaps, index) => {
      const offset = ranges[index].start;
      for (const gap of gaps) {
        edits.push({ start: offset + gap.start, end: offset + gap.end, text: gap.text });
      }
    });
  });
  return edits.sort((a, b) => a.start - b.start);
}

// ----------------------------------------------------------------------------
// Source map
// ----------------------------------------------------------------------------

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeVlq(value: number): string {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let encoded = '';
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) digit |= 32;
    encoded += BASE64[digit];
  } while (vlq > 0);
  return encoded;
}

export interface TemplateSourceMap {
  version: 3;
  sources: string[];
  sourcesContent: string[];
  names: string[];
  mappings: string;
}

/**
 * Apply `edits` (sorted, not overlapping) to `code` and build the source map
 * for the result.
 *
 * The map has a segment at every word boundary of the text that was kept, which
 * is the resolution the minifier's own map needs to compose with it. Written by
 * hand because the edits are a sorted list of replacements, the format is forty
 * lines, and the alternative is a new entry in a lockfile whose every change
 * redeploys all eight workers.
 */
export function applyEdits(
  code: string,
  edits: readonly Edit[],
  source: string
): { code: string; map: TemplateSourceMap } {
  let output = '';
  const lines: string[] = [];
  let line = '';
  let genCol = 0;
  let srcLine = 0;
  let srcCol = 0;
  let prevGenCol = 0;
  let prevSrcLine = 0;
  let prevSrcCol = 0;

  const segment = (): void => {
    line +=
      (line ? ',' : '') +
      encodeVlq(genCol - prevGenCol) +
      'A' +
      encodeVlq(srcLine - prevSrcLine) +
      encodeVlq(srcCol - prevSrcCol);
    prevGenCol = genCol;
    prevSrcLine = srcLine;
    prevSrcCol = srcCol;
  };
  const newGeneratedLine = (): void => {
    lines.push(line);
    line = '';
    genCol = 0;
    prevGenCol = 0;
  };
  const charClass = (ch: string): number => (/[A-Za-z0-9_$]/.test(ch) ? 1 : WS.test(ch) ? 2 : 0);

  const keep = (from: number, to: number): void => {
    let previous = -1;
    for (let i = from; i < to; i++) {
      const ch = code[i];
      const cls = charClass(ch);
      // Each punctuation character gets a segment; a word or a blank run, one.
      if (cls !== previous || cls === 0) segment();
      previous = cls;
      if (ch === '\n') {
        srcLine++;
        srcCol = 0;
        newGeneratedLine();
        previous = -1;
      } else {
        srcCol++;
        genCol++;
      }
    }
    output += code.slice(from, to);
  };

  let cursor = 0;
  for (const edit of edits) {
    keep(cursor, edit.start);
    // The replacement (one character at most) maps to where the gap began.
    if (edit.text) {
      segment();
      output += edit.text;
      if (edit.text === '\n') newGeneratedLine();
      else genCol += edit.text.length;
    }
    for (let i = edit.start; i < edit.end; i++) {
      if (code[i] === '\n') {
        srcLine++;
        srcCol = 0;
      } else {
        srcCol++;
      }
    }
    cursor = edit.end;
  }
  keep(cursor, code.length);
  lines.push(line);

  return {
    code: output,
    map: {
      version: 3,
      sources: [source],
      sourcesContent: [code],
      names: [],
      mappings: lines.join(';'),
    },
  };
}

/** Collapse the Lit templates in one module. `null` when nothing changes. */
export function minifyTemplates(
  code: string,
  id: string
): { code: string; map: TemplateSourceMap } | null {
  const edits = collectTemplateEdits(code);
  if (edits.length === 0) return null;
  return applyEdits(code, edits, id);
}

const TAGGED_TEMPLATE = /\b(?:html|svg|css)`/;

export function minifyTemplatesPlugin(): Plugin {
  return {
    name: 'minify-lit-templates',
    apply: 'build',
    transform(code, id) {
      const cleanId = normalizePath(id.split('?')[0]);
      if (!/\.[cm]?ts$/.test(cleanId) || cleanId.includes('/node_modules/')) return null;
      if (!TAGGED_TEMPLATE.test(code)) return null;
      return minifyTemplates(code, cleanId);
    },
  };
}

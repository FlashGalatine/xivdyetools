/**
 * The translation keys a source file asks for — what `validate-i18n.js` checks
 * against en.json.
 *
 * Its own module so the parity gate can test it without importing the
 * validator itself: that script runs as a child process, which in-process
 * coverage cannot see, so importing it would count its whole body as
 * uncovered.
 *
 * The patterns run over the whole file, not line by line: prettier wraps a long
 * call's argument onto the next line, and a per-line scan never saw a key there
 * (2026-10-04 deep dive, BUG-074). Each key still reports its own line.
 *
 * Everything here errs toward taking nothing: a shape it does not recognise, or
 * an alias call past the next binding of the alias's name, yields no key rather
 * than a wrong one. `validate-i18n.js`'s header lists what that leaves unchecked.
 *
 * @module scripts/i18n-key-patterns
 */

// A key literal, on one line. Its capture is the key.
const KEY = String.raw`['"]([^'"\n]+)['"]`;

// The condition of a ternary first argument — `n === 1`, `range === 'Dark'`,
// `isOne(n)`. No `?`, `:`, `,` or block punctuation outside a string or a pair of
// parentheses, so the match cannot run past the argument it starts in.
const CONDITION = String.raw`(?:[^?:;,'"\x60(){}\[\]]|\?\.|'[^'\n]*'|"[^"\n]*"|\([^()\n]*\))+?`;

// What sits left of a `??` fallback in a first argument — `key`,
// `sortKeys[this.config.sortBy]`, `picked?.key`, `first ?? second`. CONDITION's
// characters plus a bracketed index and an earlier `??`; never a lone `?` or `:`.
const BEFORE_FALLBACK = String.raw`(?:[^?:;,'"\x60(){}\[\]]|\?\.|\?\?|'[^'\n]*'|"[^"\n]*"|\([^()\n]*\)|\[[^\[\]\n]*\])+?`;

// How a call's first argument ends: t() takes one (prettier may leave a trailing
// comma once it wraps), tInterpolate() always has a second.
const ENDS_T = String.raw`\s*,?\s*\)`;
const ENDS_INTERPOLATE = String.raw`\s*,`;

// The callees that are LanguageService itself.
const SERVICE_CALLEES = [
  { head: String.raw`LanguageService\.t`, ends: ENDS_T, prefix: '' },
  { head: String.raw`LanguageService\.tInterpolate`, ends: ENDS_INTERPOLATE, prefix: '' },
];

// A plural pair, 'x_one', 'x_other' — tCount(n, one, other) and any helper that
// forwards the pair to it. The locale's plural rules pick the key at run time, so
// neither reaches t() as a literal; the pair is literal only here, at the call.
const PLURAL_PAIR = /['"]([\w.]+_one)['"]\s*,\s*['"]([\w.]+_other)['"]/dg;

// An object map's values — `LanguageService.t({ dye: 'glamour.row.blockedDye', … }[problem])`.
// A value is a literal in a result position: after the property's `:`, and in a
// ternary value after its `?` or `:` (both branches, nested ternaries too) or a
// `??`. A property name or a condition's literal is in none of these.
const MAP_VALUE = /[?:]\s*['"]([^'"\n]+)['"](?=\s*(?:[:,]|$))/dg;

// What an alias passes on: its own parameter, `prefix.${param}` or 'prefix.' + param.
const FORWARD = String.raw`(?:\k<param>|\x60(?<template>[\w.]*)\$\{\k<param>\}\x60|['"](?<concat>[\w.]*)['"]\s*\+\s*\k<param>)`;
const ALIAS_HEAD = String.raw`(?<exported>export\s+)?`;
const NAME = String.raw`(?<name>[A-Za-z_$][\w$]*)`;
const PARAM = String.raw`\(\s*(?<param>[A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?\)\s*(?::\s*string\s*)?`;

// A local alias of LanguageService.t — `const t = (key: string): string =>
// LanguageService.t(\`comparison.${key}\`);` or the same as a function declaration.
const ALIAS_DEFINITIONS = [
  new RegExp(
    String.raw`${ALIAS_HEAD}(?:const|let)\s+${NAME}\s*=\s*${PARAM}=>\s*LanguageService\.t\(\s*${FORWARD}\s*\)`,
    'g'
  ),
  new RegExp(
    String.raw`${ALIAS_HEAD}function\s+${NAME}\s*${PARAM}\{\s*return\s+LanguageService\.t\(\s*${FORWARD}\s*\);?\s*\}`,
    'g'
  ),
];

// `import { a, tSwatch as ts } from '@components/chara-ui'`, wrapped or not.
const NAMED_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;

// The `)` that closes a parameter list: an arrow or a body follows it, after an
// optional return type — `(t) =>`, `(t: Fn): void {`, `catch (t) {`.
const PARAMS_CLOSE = /\)(?=\s*(?::[^;{}=()]*?)?\s*(?:=>|\{))/g;

// What sits before a `(…) {` that is a condition, not a parameter list.
const CONTROL_BEFORE = /(?:^|[^\w$.])(?:if|while|for|switch|with)\s*$/;

// A destructuring declaration's pattern — `const { t } = …`, `let [t] = …`.
const DESTRUCTURING = /\b(?:const|let|var)\s*([{[][^;=]*?[}\]])\s*=/dg;

/**
 * Every alias of LanguageService.t a file defines, in source order.
 * @param {string} content - Source text
 * @returns {Array<{name: string, prefix: string, exported: boolean, offset: number, end: number}>}
 */
function findAliases(content) {
  const aliases = [];
  for (const pattern of ALIAS_DEFINITIONS) {
    for (const match of content.matchAll(pattern)) {
      const { name, template, concat, exported } = match.groups;
      aliases.push({
        name,
        prefix: template ?? concat ?? '',
        exported: exported !== undefined,
        offset: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return aliases.sort((a, b) => a.offset - b.offset);
}

/**
 * The `(` that opens the group a `)` closes, or -1 once the scan leaves the
 * statement or block the `)` sits in. Strings are not skipped: a stray paren in
 * one can only make a parameter list unrecognised.
 * @param {string} content
 * @param {number} close - Offset of the `)`
 * @returns {number}
 */
function openingParen(content, close) {
  let parens = 0;
  let braces = 0;
  for (let i = close - 1; i >= 0; i--) {
    const char = content[i];
    if (char === ')') parens++;
    else if (char === '(') {
      if (parens === 0) return i;
      parens--;
    } else if (char === '}') braces++;
    else if (char === '{') {
      if (braces === 0) return -1;
      braces--;
    } else if (char === ';' && parens === 0 && braces === 0) return -1;
  }
  return -1;
}

/**
 * Every place a file binds `name`, whether or not the binding is an alias of
 * LanguageService.t: a declaration (`const`, `let`, `var`, `function`, `class`,
 * a destructuring pattern) or a parameter (a parameter list, a bare arrow
 * parameter, a catch clause). Over-matching only shortens an alias's reach, so
 * a parameter named in a type annotation counts too.
 * @param {string} content
 * @param {string} name
 * @returns {number[]} Offsets of the bound name, ascending
 */
function bindingOffsets(content, name) {
  const id = String.raw`(?<![\w$.])${name.replace(/\$/g, '\\$')}(?![\w$])`;
  const notCalled = new RegExp(String.raw`${id}(?!\s*\()`, 'g');
  const offsets = new Set();
  const inside = (text, base) => {
    for (const match of text.matchAll(notCalled)) offsets.add(base + match.index);
  };

  const declaration = new RegExp(String.raw`\b(?:const|let|var|function\*?|class)\s+(${id})`, 'dg');
  for (const match of content.matchAll(declaration)) offsets.add(match.indices[1][0]);
  for (const match of content.matchAll(DESTRUCTURING)) inside(match[1], match.indices[1][0]);
  for (const match of content.matchAll(new RegExp(String.raw`${id}\s*=>`, 'g'))) {
    offsets.add(match.index);
  }
  for (const match of content.matchAll(PARAMS_CLOSE)) {
    const open = openingParen(content, match.index);
    if (open === -1 || CONTROL_BEFORE.test(content.slice(Math.max(0, open - 16), open))) continue;
    inside(content.slice(open + 1, match.index), open + 1);
  }
  return [...offsets].sort((a, b) => a - b);
}

/**
 * The aliases of LanguageService.t a file exports, for the files that import them.
 * @param {string} content - Source text
 * @returns {Array<{name: string, prefix: string}>}
 */
export function findExportedAliases(content) {
  return findAliases(content)
    .filter((alias) => alias.exported)
    .map(({ name, prefix }) => ({ name, prefix }));
}

/**
 * The module name an import specifier points at — `@components/chara-ui`,
 * `./chara-ui` and `./chara-ui.js` are all `chara-ui`.
 * @param {string} specifier
 * @returns {string}
 */
function moduleName(specifier) {
  return specifier
    .split('/')
    .pop()
    .replace(/\.[cm]?[jt]sx?$/, '');
}

/**
 * The aliases this file calls, each over the stretch of the file where its name
 * is still that alias. Scope is decided by offset, not lexically, so the
 * stretch errs short: it ends at the next binding of the name, recognised as
 * an alias or not (`bindingOffsets`), and a call after the end goes unchecked
 * rather than taking a prefix that is not its own.
 *
 * - A local alias runs from its definition — from the top of the file when
 *   nothing binds the name before it, so a hoisted function's earlier calls
 *   count — to the next binding of its name.
 * - An exported alias this file imports runs from the top of the file to the
 *   first binding of its local name.
 * @param {string} content
 * @param {Array<{module: string, name: string, prefix: string}>} exportedAliases
 * @returns {Array<{name: string, prefix: string, from: number, to: number}>}
 */
function aliasCallees(content, exportedAliases) {
  const callees = [];
  const bindings = new Map();
  const bindingsOf = (name) => {
    if (!bindings.has(name)) bindings.set(name, bindingOffsets(content, name));
    return bindings.get(name);
  };

  for (const alias of findAliases(content)) {
    const offsets = bindingsOf(alias.name);
    const later = offsets.find((offset) => offset >= alias.end);
    callees.push({
      name: alias.name,
      prefix: alias.prefix,
      from: offsets.some((offset) => offset < alias.offset) ? alias.offset : 0,
      to: later ?? content.length,
    });
  }

  for (const [, specifiers, source] of content.matchAll(NAMED_IMPORT)) {
    const module = moduleName(source);
    for (const specifier of specifiers.split(',')) {
      const [imported, local = imported] = specifier
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);
      const alias = exportedAliases.find((a) => a.module === module && a.name === imported);
      if (alias) {
        callees.push({
          name: local,
          prefix: alias.prefix,
          from: 0,
          to: bindingsOf(local)[0] ?? content.length,
        });
      }
    }
  }

  return callees;
}

/**
 * Extract translation keys from source text: LanguageService.t / tInterpolate with
 * a literal, a ternary of two literals, a `??` fallback literal or an object map
 * of literals (a value may itself be a ternary) as the first argument — the same
 * through any alias of LanguageService.t, with its prefix — and every plural pair.
 * @param {string} content - Source text
 * @param {Array<{module: string, name: string, prefix: string}>} [exportedAliases] -
 *   aliases other files export (`findExportedAliases`), tagged with their module name
 * @returns {Array<{key: string, line: number}>} Array of keys with line numbers
 */
export function extractKeysFromSource(content, exportedAliases = []) {
  // Offset of each line's first character, for the line a key sits on.
  const lineStarts = [0];
  for (let i = content.indexOf('\n'); i !== -1; i = content.indexOf('\n', i + 1)) {
    lineStarts.push(i + 1);
  }
  const lineAt = (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lineStarts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1; // 1-indexed
  };

  const found = new Map(); // offset → key; one literal is one reference
  const add = (key, offset) => {
    if (!found.has(offset)) found.set(offset, key);
  };

  const callees = [
    ...SERVICE_CALLEES.map((callee) => ({ ...callee, from: 0, to: content.length })),
    ...aliasCallees(content, exportedAliases).map(({ name, ...rest }) => ({
      ...rest,
      head: String.raw`(?<![\w$.])` + name.replace(/\$/g, '\\$'),
      ends: ENDS_T,
    })),
  ];

  for (const { head, ends, prefix, from, to } of callees) {
    const shapes = [
      // t('key')
      new RegExp(String.raw`${head}\(\s*${KEY}${ends}`, 'dg'),
      // t(n === 1 ? 'keyOne' : 'keyMany')
      new RegExp(String.raw`${head}\(\s*${CONDITION}\?\s*${KEY}\s*:\s*${KEY}${ends}`, 'dg'),
      // t(key ?? 'fallbackKey') — only the fallback is a literal
      new RegExp(String.raw`${head}\(\s*${BEFORE_FALLBACK}\?\?\s*${KEY}${ends}`, 'dg'),
    ];
    for (const shape of shapes) {
      for (const match of content.matchAll(shape)) {
        if (match.index < from || match.index >= to) continue;
        for (let group = 1; group < match.length; group++) {
          add(prefix + match[group], match.indices[group][0]);
        }
      }
    }

    // t({ a: 'keyA', b: 'keyB' }[which])
    const map = new RegExp(String.raw`${head}\(\s*\{([^{}]*)\}\s*\[[^\]\n]*\]${ends}`, 'dg');
    for (const match of content.matchAll(map)) {
      if (match.index < from || match.index >= to) continue;
      const bodyStart = match.indices[1][0];
      for (const value of match[1].matchAll(MAP_VALUE)) {
        add(prefix + value[1], bodyStart + value.indices[1][0]);
      }
    }
  }

  for (const match of content.matchAll(PLURAL_PAIR)) {
    add(match[1], match.indices[1][0]);
    add(match[2], match.indices[2][0]);
  }

  return [...found]
    .sort(([a], [b]) => a - b)
    .map(([offset, key]) => ({ key, line: lineAt(offset) }));
}

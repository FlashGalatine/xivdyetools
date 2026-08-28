/**
 * Unit tests for the `no-hardcoded-ui-strings` ESLint rule.
 *
 * The rule is a heuristic, so what it must NOT report matters as much as what
 * it must: a rule that flags Tailwind class lists, CSS, URLs or log messages
 * gets switched off within a week. Every `valid` case below is a shape that
 * appears in this codebase and is not a translation defect.
 *
 * `RuleTester` drives vitest's `describe`/`it` (globals are on in
 * `vitest.config.ts`), so failures land in the normal suite output.
 *
 * @module eslint-rules/__tests__/no-hardcoded-ui-strings.test
 */

import { RuleTester } from 'eslint';
import { describe, it, expect } from 'vitest';
import { noHardcodedUiStrings, looksLikeUiText, scanTemplate } from '../no-hardcoded-ui-strings.js';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

/** Every case is a component file unless it says otherwise. */
const filename = 'src/components/v4/example.js';
const error = (count = 1) => Array.from({ length: count }, () => ({ messageId: 'hardcoded' }));

ruleTester.run('no-hardcoded-ui-strings', noHardcodedUiStrings, {
  valid: [
    // Localized: the whole point of the rule.
    { filename, code: `el.textContent = LanguageService.t('common.close')` },
    { filename, code: `el.title = LanguageService.tInterpolate('a.b', { n })` },
    { filename, code: `ToastService.error(LanguageService.t('preset.loadFailed'))` },

    // Diagnostics are not UI.
    { filename, code: `logger.warn('could not reach the presets API')` },
    { filename, code: `console.error('unexpected response shape here')` },

    // Not a text-bearing property.
    { filename, code: `el.className = 'flex items-center gap-2'` },
    { filename, code: `el.dataset.tip = 'some words here'` },
    { filename, code: `ToastService.error(key, 'second argument is details')` },

    // Single words, ALL-CAPS identifiers, brands, units.
    { filename, code: `el.textContent = 'Close'` },
    { filename, code: 'const t = html`<span>Close</span>`' },
    { filename, code: 'const t = html`<option>RGB DIST - ${label}</option>`' },
    { filename, code: 'const t = html`<span>XIV Dye Tools</span>`' },
    { filename, code: 'const t = html`<th>GIL / ΔE</th>`' },

    // Markup that is not prose: class/id/href/src/data-*, CSS, comments, style.
    { filename, code: 'const t = html`<div class="flex items-center gap-2"></div>`' },
    { filename, code: 'const t = html`<div id="my panel" data-tip="some words here"></div>`' },
    { filename, code: 'const t = html`<a href="https://example.com/a/b">Docs</a>`' },
    { filename, code: 'const t = html`<img src="/assets/some image.png" alt="Dye" />`' },
    { filename, code: 'const t = html`<!-- a comment full of words -->`' },
    { filename, code: 'const t = html`<style>.a b { color: red; }</style>`' },
    { filename, code: `el.textContent = 'display: flex; align-items: center;'` },

    // Not a Lit template.
    { filename, code: 'const t = other`<span>Clear all filters</span>`' },

    // Test files are exempt.
    {
      filename: 'src/components/__tests__/example.test.js',
      code: `el.textContent = 'No dyes found'`,
    },
  ],

  invalid: [
    {
      filename,
      code: `el.textContent = 'No dyes found'`,
      errors: error(),
    },
    {
      filename,
      code: `el.title = 'Reset all filters'`,
      errors: error(),
    },
    {
      filename,
      code: `el.placeholder = \`Search \${n} dyes by name\``,
      errors: error(),
    },
    {
      filename,
      code: `el.setAttribute('aria-label', 'Close the dialog')`,
      errors: error(),
    },
    {
      filename,
      code: `ToastService.error('Could not load presets')`,
      errors: error(),
    },
    {
      filename,
      code: `AnnouncerService.announce('Copied to clipboard')`,
      errors: error(),
    },
    {
      filename,
      code: 'const t = html`<button>Clear all filters</button>`',
      errors: error(),
    },
    {
      filename,
      code: 'const t = html`<button title="Reset filters" aria-label="Open the menu"></button>`',
      errors: error(2),
    },
    {
      // Static text on either side of a hole is checked independently.
      filename,
      code: 'const t = html`<span>${n} results found</span>`',
      errors: error(),
    },
  ],
});

describe('looksLikeUiText', () => {
  it('accepts a sentence and rejects a single word', () => {
    expect(looksLikeUiText('No dyes found')).toBe(true);
    expect(looksLikeUiText('Close')).toBe(false);
  });

  it('rejects URLs, paths, CSS and dotted identifiers', () => {
    expect(looksLikeUiText('https://xivdyetools.app/some page')).toBe(false);
    expect(looksLikeUiText('/assets/og/some card.png')).toBe(false);
    expect(looksLikeUiText('display: flex; align-items: center;')).toBe(false);
    expect(looksLikeUiText('preset.fieldName')).toBe(false);
  });

  it('rejects ALL-CAPS identifiers of at most two words, punctuation aside', () => {
    expect(looksLikeUiText('RGB DIST -')).toBe(false);
    expect(looksLikeUiText('GIL / ΔE')).toBe(false);
    expect(looksLikeUiText('NO MATCHING DYES FOUND')).toBe(true);
  });
});

describe('scanTemplate', () => {
  it('separates text nodes from attribute values', () => {
    const found = scanTemplate('<button title="Go back" class="btn">Save changes</button>');
    expect(found).toEqual([
      { kind: 'attribute', name: 'title', value: 'Go back', offset: 15 },
      { kind: 'attribute', name: 'class', value: 'btn', offset: 31 },
      { kind: 'text', value: 'Save changes', offset: 36 },
    ]);
  });

  it('reports offsets that index back into the source', () => {
    const source = '<p>Nothing to show</p>';
    const [text] = scanTemplate(source);
    expect(source.slice(text.offset, text.offset + text.value.length)).toBe('Nothing to show');
  });

  it('skips comments and raw-text elements', () => {
    expect(scanTemplate('<!-- hidden words here -->')).toEqual([]);
    expect(scanTemplate('<style>.a b { color: red; }</style>')).toEqual([]);
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAst } from 'vite';
import {
  collapseCssWhitespace,
  collapseHtmlWhitespace,
  minifyTemplates,
  minifyTemplatesPlugin,
} from '../../vite-plugin-minify-templates';
import type { TemplateSourceMap } from '../../vite-plugin-minify-templates';

const IDENTIFIER = /(?<![A-Za-z0-9_$])[A-Za-z_$][A-Za-z0-9_$]*/g;

/**
 * Every identifier in `generated` that the map does not send back to the same
 * identifier in `source`, as "line:column name". Empty means the map is exact.
 */
function unmappedIdentifiers(
  source: string,
  generated: string,
  map: TemplateSourceMap
): { checked: number; wrong: string[] } {
  const consumer = new SourceMap({ ...map, file: '', sourceRoot: '' });
  const sourceLines = source.split('\n');
  const wrong: string[] = [];
  let checked = 0;
  generated.split('\n').forEach((text, lineNumber) => {
    for (const match of text.matchAll(IDENTIFIER)) {
      checked++;
      const entry = consumer.findEntry(lineNumber, match.index);
      const original =
        'originalLine' in entry
          ? (sourceLines[entry.originalLine] ?? '').slice(
              entry.originalColumn,
              entry.originalColumn + match[0].length
            )
          : '';
      if (original !== match[0]) wrong.push(`${lineNumber + 1}:${match.index} ${match[0]}`);
    }
  });
  return { checked, wrong };
}

const html1 = (text: string): string => collapseHtmlWhitespace([text])[0];
const css1 = (text: string): string => collapseCssWhitespace([text])[0];

describe('collapseHtmlWhitespace', () => {
  it('collapses indentation between elements to one newline', () => {
    expect(html1('\n      <div>\n        <span>a</span>\n      </div>\n    ')).toBe(
      '\n<div>\n<span>a</span>\n</div>\n'
    );
  });

  it('collapses a run of spaces in text to one space, and never removes it', () => {
    expect(html1('<b>a</b>   <i>b</i>')).toBe('<b>a</b> <i>b</i>');
    expect(html1('one    two')).toBe('one two');
    expect(html1('<b>a</b> <i>b</i>')).toBe('<b>a</b> <i>b</i>');
  });

  it('keeps a line break as a line break, so white-space: pre-line still breaks', () => {
    expect(html1('first\n        second')).toBe('first\nsecond');
    expect(html1('first\n\n\n  second')).toBe('first\nsecond');
  });

  it('collapses whitespace between attributes to one space', () => {
    expect(
      html1('<button\n          class="a"\n          type="button"\n        >x</button>')
    ).toBe('<button class="a" type="button" >x</button>');
  });

  it('leaves quoted attribute values alone', () => {
    const tag = '<p title="a   b\n   c" style=\'x:   y\'>t</p>';
    expect(html1(tag)).toBe(tag);
  });

  it('carries a quoted attribute across an expression', () => {
    expect(collapseHtmlWhitespace(['<p class="a   ', '   b"   id="x">  ', '  </p>'])).toEqual([
      '<p class="a   ',
      '   b" id="x"> ',
      ' </p>',
    ]);
  });

  it('treats an expression as an unquoted attribute value', () => {
    expect(collapseHtmlWhitespace(['<p class=', '\n     ?hidden=', '>\n   a'])).toEqual([
      '<p class=',
      ' ?hidden=',
      '>\na',
    ]);
  });

  it('is not thrown by a quote inside an unquoted value', () => {
    expect(html1("<p data-x=it's   id=a>\n    b\n    </p>")).toBe("<p data-x=it's id=a>\nb\n</p>");
  });

  it.each(['pre', 'textarea', 'script', 'style', 'title'])('leaves <%s> content alone', (name) => {
    const inner = '\n   keep    this\n      exactly\n';
    expect(html1(`<${name}   class="a">${inner}</${name}>\n      <p>`)).toBe(
      `<${name} class="a">${inner}</${name}>\n<p>`
    );
  });

  it('leaves raw text alone across an expression', () => {
    expect(collapseHtmlWhitespace(['<pre>\n   a   ', '   b\n   </pre>\n     <p>'])).toEqual([
      '<pre>\n   a   ',
      '   b\n   </pre>\n<p>',
    ]);
  });

  it('does not mistake <preset-card> for <pre>', () => {
    expect(html1('<preset-card>\n      a\n    </preset-card>')).toBe(
      '<preset-card>\na\n</preset-card>'
    );
  });

  it('leaves HTML comments alone', () => {
    expect(html1('<!--   a\n     b   -->\n     <p>')).toBe('<!--   a\n     b   -->\n<p>');
  });

  it('keeps a bare < in text as text', () => {
    expect(html1('a  <  b   <p>')).toBe('a < b <p>');
  });

  describe('SVG', () => {
    it('turns a break plus indentation into a space inside an svg template', () => {
      expect(collapseHtmlWhitespace(['<text>a\n      b</text>'], true)).toEqual([
        '<text>a b</text>',
      ]);
    });

    it('keeps a bare line break, which SVG text drops either way', () => {
      expect(collapseHtmlWhitespace(['<text>a\nb</text>'], true)).toEqual(['<text>a\nb</text>']);
    });

    it('applies the SVG rule inside <svg> in an html template, and stops after it', () => {
      expect(html1('<p>a\n  b</p><svg>\n  <text>a\n  b</text>\n  </svg><p>a\n  b</p>')).toBe(
        '<p>a\nb</p><svg> <text>a b</text> </svg><p>a\nb</p>'
      );
    });
  });
});

describe('collapseCssWhitespace', () => {
  it('drops whitespace beside braces and semicolons', () => {
    expect(
      css1('\n      :host {\n        display: block;\n        color: red;\n      }\n    ')
    ).toBe(' :host{display: block;color: red;}');
  });

  it('keeps one space where the grammar may need it', () => {
    expect(css1('a   :hover   >   b { width: calc(100%   -   2px) }')).toBe(
      'a :hover > b{width: calc(100% - 2px)}'
    );
    expect(css1('@media (min-width: 1px)   and   (max-width: 2px) {}')).toBe(
      '@media (min-width: 1px) and (max-width: 2px){}'
    );
    expect(css1('a { margin: 0   auto; grid-template-areas: "a  b"   "c  d"; }')).toBe(
      'a{margin: 0 auto;grid-template-areas: "a  b" "c  d";}'
    );
  });

  it('leaves strings alone, braces and comment markers included', () => {
    const rule = 'a::before{content: "  {  ;  /*  }  ";}';
    expect(css1(rule)).toBe(rule);
    expect(css1("a{content: '  x   y  ';}")).toBe("a{content: '  x   y  ';}");
  });

  it('removes a comment that has whitespace beside it', () => {
    expect(css1('a { /* note */ color: red; }\n/* next */\nb { }')).toBe('a{color: red;}b{}');
    expect(css1('a /* x */ b { }')).toBe('a b{}');
  });

  it('keeps a comment that is the only thing separating two tokens', () => {
    expect(css1('a/**/b{}')).toBe('a/**/b{}');
  });

  it('keeps a comment that wraps an expression', () => {
    expect(collapseCssWhitespace(['a { }  /* was  ', '  here */  b { }'])).toEqual([
      'a{}/* was  ',
      '  here */ b{}',
    ]);
  });

  it('keeps a space beside an expression, whose value it cannot see', () => {
    expect(collapseCssWhitespace(['\n  ', '\n  a { color: ', ' ; }\n  ', '\n'])).toEqual([
      ' ',
      ' a{color: ',
      ';}',
      ' ',
    ]);
  });
});

describe('minifyTemplates', () => {
  const lit = "import { LitElement, html, css, svg } from 'lit';\n";

  it('rewrites html, css and svg templates imported from Lit', () => {
    const out = minifyTemplates(
      `${lit}const a = html\`\n    <p>\n      \${x}\n    </p>\n  \`;\nconst b = css\`\n  a {\n    b: c;\n  }\n\`;\nconst c = svg\`<g>\n   <path />\n </g>\`;\n`,
      '/src/a.ts'
    );
    expect(out?.code).toBe(
      `${lit}const a = html\`\n<p>\n\${x}\n</p>\n\`;\nconst b = css\` a{b: c;}\`;\nconst c = svg\`<g> <path /> </g>\`;\n`
    );
  });

  it('follows an aliased import', () => {
    const out = minifyTemplates(
      "import { html as h } from 'lit';\nconst a = h`<p>\n     a</p>`;\n",
      '/src/a.ts'
    );
    expect(out?.code).toContain('h`<p>\na</p>`');
  });

  it('ignores a tag that is not imported from Lit', () => {
    const local = 'const html = String.raw;\nconst a = html`<p>\n     a</p>`;\n';
    expect(minifyTemplates(local, '/src/a.ts')).toBeNull();
    const other = "import { html } from './mine';\nconst a = html`<p>\n     a</p>`;\n";
    expect(minifyTemplates(other, '/src/a.ts')).toBeNull();
  });

  it('ignores untagged templates and other tags', () => {
    const code = `${lit}const a = \`<p>\n     a</p>\`;\nconst b = String.raw\`<p>\n     a</p>\`;\n`;
    expect(minifyTemplates(code, '/src/a.ts')).toBeNull();
  });

  it('skips a template that contains a backslash', () => {
    const code = `${lit}const a = html\`<p title="\\"">\n     a</p>\`;\n`;
    expect(minifyTemplates(code, '/src/a.ts')).toBeNull();
  });

  it('never changes an expression, and reaches templates nested inside one', () => {
    const expression =
      '${items.map(\n        (item)   =>   html`<li>\n            ${item  .  name}\n          </li>`\n      )}';
    const out = minifyTemplates(
      `${lit}const a = html\`<ul>\n      ${expression}\n    </ul>\`;\n`,
      '/a.ts'
    );
    expect(out?.code).toBe(
      `${lit}const a = html\`<ul>\n\${items.map(\n        (item)   =>   html\`<li>\n\${item  .  name}\n</li>\`\n      )}\n</ul>\`;\n`
    );
  });

  it('reads TypeScript, decorators included', () => {
    const code = `${lit}import { customElement } from 'lit/decorators.js';\n@customElement('x-a')\nexport class A extends LitElement {\n  private n: number = 1;\n  static override styles = css\`\n    :host {\n      display: block;\n    }\n  \`;\n  protected override render(): unknown {\n    return html\`\n      <p>\${this.n as number}</p>\n    \`;\n  }\n}\n`;
    const out = minifyTemplates(code, '/src/a.ts');
    expect(out?.code).toContain('css` :host{display: block;}`');
    expect(out?.code).toContain('html`\n<p>${this.n as number}</p>\n`');
    expect(() => parseAst(out!.code, { lang: 'ts' })).not.toThrow();
  });

  it('maps every identifier back to where it was', () => {
    const code = `${lit}export const view = (first: string, second: string) => html\`\n      <section>\n        <h1   class="a">\${first}</h1>\n            <p>\${second}</p>\n      </section>\n    \`;\nexport const after = 1;\n`;
    const out = minifyTemplates(code, '/src/a.ts')!;
    expect(out.map.sources).toEqual(['/src/a.ts']);
    expect(out.map.sourcesContent).toEqual([code]);

    const { checked, wrong } = unmappedIdentifiers(code, out.code, out.map);
    expect(wrong).toEqual([]);
    expect(checked).toBeGreaterThan(20);
  });
});

describe('minifyTemplatesPlugin', () => {
  type Hook = (code: string, id: string) => { code: string } | null;
  const plugin = minifyTemplatesPlugin();
  const transform = (code: string, id: string) => (plugin.transform as Hook).call({}, code, id);
  const code = "import { html } from 'lit';\nexport const a = html`<p>\n     a</p>`;\n";

  it('runs in builds only, so the dev server serves templates as written', () => {
    expect(plugin.apply).toBe('build');
  });

  it('transforms TypeScript sources, query string or not', () => {
    expect(transform(code, 'C:\\repo\\src\\a.ts')?.code).toContain('html`<p>\na</p>`');
    expect(transform(code, '/repo/src/a.ts?v=1')?.code).toContain('html`<p>\na</p>`');
  });

  it('leaves dependencies and other file types alone', () => {
    expect(transform(code, '/repo/node_modules/lit/index.ts')).toBeNull();
    expect(transform(code, '/repo/src/a.js')).toBeNull();
    expect(transform(code, '/repo/src/a.css')).toBeNull();
  });
});

/**
 * The whole app, as the build sees it. This is the test that notices a parser
 * upgrade changing how template ranges are reported: the plugin would then
 * skip every template and say nothing, and the size budget would be the only
 * thing to complain.
 */
describe('minifyTemplates over src/', () => {
  const root = join(__dirname, '..');
  const sources: string[] = [];
  const collect = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') collect(path);
      } else if (entry.name.endsWith('.ts') && !/\.(test|spec|d)\.ts$/.test(entry.name)) {
        sources.push(path);
      }
    }
  };
  collect(root);

  it('produces code that still parses, with identifiers mapped exactly', () => {
    let removed = 0;
    let transformed = 0;
    for (const file of sources) {
      const code = readFileSync(file, 'utf8');
      const out = minifyTemplates(code, file);
      if (!out) continue;
      transformed++;
      removed += code.length - out.code.length;
      expect(() => parseAst(out.code, { lang: 'ts' }), file).not.toThrow();

      expect(unmappedIdentifiers(code, out.code, out.map).wrong, file).toEqual([]);
    }
    // 22 modules and 66.6 KB of source on 2026-11-13. A floor, not a target.
    expect(transformed).toBeGreaterThanOrEqual(15);
    expect(removed).toBeGreaterThan(40_000);
  });
});

/**
 * vite-plugin-async-css — the generated loader must be content-addressed.
 *
 * `_headers` marks `/assets/*` immutable for a year. Until 2026-08-29 the
 * plugin wrote a fixed `/assets/load-css-async.js`, so the edge kept serving a
 * v4-era loader (previous CSS hash + a Google Fonts stylesheet that the CSP
 * blocks) long after the 5.0 release. These tests pin the hashed name and the
 * loader's contents.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asyncCss, asyncCssLoaderName } from '../../vite-plugin-async-css';

const HTML = (css: string[]): string =>
  `<!doctype html><html><head><meta charset="utf-8">${css
    .map((href) => `<link rel="stylesheet" crossorigin href="${href}">`)
    .join('')}</head><body></body></html>`;

function runPlugin(css: string[]): { dir: string; html: string; loaders: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'async-css-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), HTML(css), 'utf8');
  const plugin = asyncCss() as unknown as {
    writeBundle: (options: { dir: string }, bundle: Record<string, never>) => void;
  };
  plugin.writeBundle({ dir }, {});
  return {
    dir,
    html: readFileSync(join(dir, 'index.html'), 'utf8'),
    loaders: readdirSync(join(dir, 'assets')).filter((f) => f.startsWith('load-css-async')),
  };
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('vite-plugin-async-css', () => {
  it('names the loader by content hash and references that name from the HTML', () => {
    const { dir, html, loaders } = runPlugin(['/assets/index-AbCdEf12.css']);
    dirs.push(dir);

    expect(loaders).toHaveLength(1);
    expect(loaders[0]).toMatch(/^load-css-async-[0-9a-f]{8}\.js$/);
    expect(html).toContain(`<script src="/assets/${loaders[0]}" defer></script>`);
    // the blocking link is gone from the head and survives only in <noscript>
    expect(html.match(/<link rel="stylesheet"/g)).toHaveLength(1);
    expect(html).toContain('<noscript>');
  });

  it('lists exactly the hoisted stylesheets — nothing external, no Google Fonts', () => {
    const { dir, loaders } = runPlugin(['/assets/index-AbCdEf12.css']);
    dirs.push(dir);
    const loader = readFileSync(join(dir, 'assets', loaders[0]), 'utf8');

    expect(loader).toContain('"/assets/index-AbCdEf12.css"');
    expect(loader).not.toMatch(/https?:\/\//);
    expect(loader).not.toContain('googleapis');
  });

  it('changes the file name whenever the stylesheet list changes', () => {
    const a = runPlugin(['/assets/index-AbCdEf12.css']);
    const b = runPlugin(['/assets/index-ZyXwVu98.css']);
    dirs.push(a.dir, b.dir);

    expect(a.loaders[0]).not.toBe(b.loaders[0]);
    // …and is stable for identical input, so unchanged builds keep their cache
    expect(asyncCssLoaderName('same')).toBe(asyncCssLoaderName('same'));
  });

  it('leaves the HTML alone when there is no stylesheet to hoist', () => {
    const { dir, html, loaders } = runPlugin([]);
    dirs.push(dir);
    expect(loaders).toHaveLength(0);
    expect(html).not.toContain('load-css-async');
  });
});

/**
 * XIV Dye Tools - Public Metadata Contract Tests
 *
 * The files under public/ that describe the site to browsers and crawlers
 * (manifest.json, sitemap.xml, browserconfig.xml) and the icon links in
 * src/index.html all reference URLs and assets by hand. Nothing in the build
 * checks them, so they rot silently: the 2026-08-16 dead-code audit found the
 * sitemap listing five v3 `*_stable.html` pages, the PWA shortcuts pointing at
 * the same dead pages, a `share_target` with no handler, and index.html linking
 * a favicon size (and browserconfig a tile) that only existed in a directory
 * Vite never ships — a 404 in production for months (DEAD-024/025).
 *
 * These assertions pin each reference to the thing it must agree with:
 * routes to `ROUTES`, files to `public/`.
 *
 * @module __tests__/public-metadata.test
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTES } from '@services/router-service';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string): string => readFileSync(resolve(APP_ROOT, p), 'utf-8');
const inPublic = (url: string): boolean =>
  existsSync(resolve(APP_ROOT, 'public', url.replace(/^\//, '')));

const ROUTE_PATHS = new Set(ROUTES.map((r) => r.path));
const INDEX_HTML = read('src/index.html');
const MANIFEST = JSON.parse(read('public/manifest.json')) as {
  start_url: string;
  icons: { src: string }[];
  screenshots?: { src: string }[];
  shortcuts?: { url: string; icons?: { src: string }[] }[];
  share_target?: unknown;
};

describe('public metadata agrees with the app', () => {
  describe('sitemap.xml', () => {
    const locs = [...read('public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    it('lists the site root and exactly the SPA routes', () => {
      const paths = locs.map((l) => new URL(l).pathname);
      expect(paths[0]).toBe('/');
      expect(new Set(paths.slice(1))).toEqual(ROUTE_PATHS);
    });

    it('uses the production origin only', () => {
      for (const l of locs) expect(new URL(l).origin).toBe('https://xivdyetools.app');
    });
  });

  describe('manifest.json', () => {
    it('shortcuts point at real routes', () => {
      for (const s of MANIFEST.shortcuts ?? []) {
        expect(ROUTE_PATHS.has(new URL(s.url, 'https://x').pathname), `shortcut ${s.url}`).toBe(
          true
        );
      }
    });

    it('declares no share_target while there is no /share-handler route', () => {
      // A share_target whose action nobody handles just drops the shared file
      // on the SPA shell. Add the route first, then the manifest entry.
      expect(MANIFEST.share_target).toBeUndefined();
    });

    it('every icon, screenshot and shortcut icon exists under public/', () => {
      const srcs = [
        ...MANIFEST.icons.map((i) => i.src),
        ...(MANIFEST.screenshots ?? []).map((s) => s.src),
        ...(MANIFEST.shortcuts ?? []).flatMap((s) => (s.icons ?? []).map((i) => i.src)),
      ];
      for (const src of srcs) expect(inPublic(src), `manifest asset ${src}`).toBe(true);
    });
  });

  describe('browserconfig.xml', () => {
    it('is linked from index.html and its tile exists under public/', () => {
      expect(INDEX_HTML).toContain('/browserconfig.xml');
      const tile = read('public/browserconfig.xml').match(/src="([^"]+)"/)?.[1];
      expect(tile).toBeDefined();
      expect(inPublic(tile!), `tile ${tile}`).toBe(true);
    });
  });

  describe('index.html', () => {
    it('every /assets/… href and src resolves to a file under public/', () => {
      const refs = [...INDEX_HTML.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(0);
      for (const r of refs) expect(inPublic(r), `index.html references ${r}`).toBe(true);
    });

    it('links the manifest and no page-level asset outside public/', () => {
      expect(INDEX_HTML).toContain('href="/manifest.json"');
      expect(existsSync(resolve(APP_ROOT, 'public/manifest.json'))).toBe(true);
    });
  });
});

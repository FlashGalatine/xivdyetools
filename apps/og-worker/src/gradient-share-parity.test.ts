/**
 * A gradient share's link preview, end to end (BUG-008, 2026-10-04 deep dive).
 *
 * PAGE_GOLDEN (services/svg/gradient.test.ts) calls generateGradientOG
 * directly, so it stayed green while every unfurl was wrong: the crawler
 * dropped the share's `interpolation=` and the image route never passed one
 * on, so no card ramped in the color space the share named. This file drives
 * each share URL through the whole worker instead: the crawler HTML for
 * `/gradient/?…`, the og:image and twitter:image URLs in it, then the image
 * route those reach. It checks the bands the card was handed against the
 * Gradient Builder's own steps for that share.
 *
 * Provenance. `page` is the page's whole ramp, START to END, as [matched dye
 * hex, its name, the ideal hex at that step]. Every row came from running the
 * web app's OWN source (`calculateInterpolation` and `interpolateInSpace`,
 * lifted verbatim out of apps/web-app/src/components/gradient-tool.ts) against
 * the built @xivdyetools/core, through the same harness as PAGE_GOLDEN (a
 * sprint scratch script, not committed), never through this worker's card.
 * It assumes the page's defaults for what a share does not carry: duplicate
 * prevention on, no dye filters, and, where the share's own value is missing
 * or unknown, a first visit's 8 steps and hsv. `drawn` is which of those
 * steps the card shows, written out rather than derived from gradient.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import type { BandEntry } from './services/svg/band';
import type { MatchingAlgorithm } from './types';

/** The bands of every card rendered, in request order. */
const handed: BandEntry[][] = [];

vi.mock('./services/renderer', () => ({
  renderOGImage: vi.fn(
    async () =>
      new Response('mock-png-data', { status: 200, headers: { 'Content-Type': 'image/png' } }),
  ),
}));

vi.mock('./services/svg/band', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/svg/band')>();
  return {
    ...actual,
    generateBandCard: (options: Parameters<typeof actual.generateBandCard>[0]) => {
      handed.push(options.bands);
      return actual.generateBandCard(options);
    },
  };
});

const { default: app } = await import('./index');
const { role } = await import('./services/og-strings');
const { BAND_METHOD_DP, ColorService, normalizeMatchingMethod } = await import('@xivdyetools/core');

const ENV = {
  APP_BASE_URL: 'https://xivdyetools.app',
  OG_IMAGE_BASE_URL: 'https://og.xivdyetools.app/og',
};
const CRAWLER_UA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';

interface ShareCase {
  label: string;
  /** The share URL's query (`v=1` aside) in the Gradient Builder's grammar */
  share: string;
  /** The og:image path the crawler must write for it (en, Discord frame) */
  image: string;
  /** The matching method the page runs, and so the card */
  algo: MatchingAlgorithm;
  /** The page's whole ramp, START to END: [dye hex, dye name, ideal hex] */
  page: ReadonlyArray<readonly [string, string, string]>;
  /** The page steps the card draws, by page index (0 = START) */
  drawn: readonly number[];
}

const CASES: readonly ShareCase[] = [
  {
    label: 'Ink Blue → Snow White in lab at 8 steps (the audit repro)',
    share: 'start=68&end=1&steps=8&interpolation=lab&algo=ciede2000',
    image: '/og/gradient/68/1/8.png?interpolation=lab',
    algo: 'ciede2000',
    page: [
      ['#1A1F27', 'Ink Blue', '#1A1F27'],
      ['#373747', 'Shadow Blue', '#33363C'],
      ['#484742', 'Charcoal Grey', '#4D4F52'],
      ['#656565', 'Slate Grey', '#696A6A'],
      ['#898784', 'Goobbue Grey', '#868682'],
      ['#ACA8A2', 'Ash Grey', '#A4A29B'],
      ['#BFB4A3', 'Pearl White', '#C4C0B5'],
      ['#E4DFD0', 'Snow White', '#E4DFD0'],
    ],
    drawn: [0, 2, 4, 5, 7],
  },
  {
    label: 'rgb at 5 steps',
    share: 'start=68&end=1&steps=5&interpolation=rgb&algo=ciede2000',
    image: '/og/gradient/68/1/5.png?interpolation=rgb',
    algo: 'ciede2000',
    page: [
      ['#1A1F27', 'Ink Blue', '#1A1F27'],
      ['#484742', 'Charcoal Grey', '#4D4F51'],
      ['#898784', 'Goobbue Grey', '#7F7F7C'],
      ['#ACA8A2', 'Ash Grey', '#B2AFA6'],
      ['#E4DFD0', 'Snow White', '#E4DFD0'],
    ],
    drawn: [0, 1, 2, 3, 4],
  },
  {
    label: 'oklch at 5 steps, ranked by ΔEOK',
    share: 'start=22&end=111&steps=5&interpolation=oklch&algo=oklab',
    image: '/og/gradient/22/111/5.png?algo=oklab&interpolation=oklch',
    algo: 'oklab',
    page: [
      ['#C99156', 'Cork Brown', '#C99156'],
      ['#996E3F', 'Qiqirn Brown', '#A56B5B'],
      ['#79526C', 'Plum Purple', '#784E56'],
      ['#3B2A3D', 'Grape Purple', '#4A3744'],
      ['#232026', 'Dark Purple', '#232026'],
    ],
    drawn: [0, 1, 2, 3, 4],
  },
  {
    label: 'lch at 5 steps',
    share: 'start=1&end=68&steps=5&interpolation=lch&algo=ciede2000',
    image: '/og/gradient/1/68/5.png?interpolation=lch',
    algo: 'ciede2000',
    page: [
      ['#E4DFD0', 'Snow White', '#E4DFD0'],
      ['#ACA8A2', 'Ash Grey', '#A3ADA1'],
      ['#437272', 'Turquoise Green', '#6A7B78'],
      ['#484742', 'Charcoal Grey', '#3D4B50'],
      ['#1A1F27', 'Ink Blue', '#1A1F27'],
    ],
    drawn: [0, 1, 2, 3, 4],
  },
  {
    label: 'hsv at 8 steps (the default mode stays off the image URL)',
    share: 'start=22&end=111&steps=8&interpolation=hsv&algo=ciede2000',
    image: '/og/gradient/22/111/8.png',
    algo: 'ciede2000',
    page: [
      ['#C99156', 'Cork Brown', '#C99156'],
      ['#CC6C5E', 'Coral Pink', '#B26B57'],
      ['#B61D4B', 'Metallic Red', '#9A5459'],
      ['#79526C', 'Plum Purple', '#834F61'],
      ['#66304E', 'Regal Purple', '#6C485F'],
      ['#514560', 'Gloom Purple', '#553D53'],
      ['#322C3B', 'Currant Purple', '#3A303D'],
      ['#232026', 'Dark Purple', '#232026'],
    ],
    drawn: [0, 2, 4, 5, 7],
  },
  {
    label: 'no steps (the page always writes one; a hand-built link): the page opens at 8',
    share: 'start=68&end=1&interpolation=hsv&algo=ciede2000',
    image: '/og/gradient/68/1/8.png',
    algo: 'ciede2000',
    page: [
      ['#1A1F27', 'Ink Blue', '#1A1F27'],
      ['#152C2C', 'Dark Green', '#2E3E42'],
      ['#3B4D3C', 'Nophica Green', '#455D58'],
      ['#5F7558', 'Adamantoise Green', '#5D7867'],
      ['#8B9C63', 'Meadow Green', '#779377'],
      ['#BACFAA', 'Pastel Green', '#9EAE93'],
      ['#BBBB8A', 'Sylph Green', '#C5C9B0'],
      ['#E4DFD0', 'Snow White', '#E4DFD0'],
    ],
    drawn: [0, 2, 4, 5, 7],
  },
  {
    label: 'an unknown mode (hand-built): the page keeps hsv, and the image is served',
    share: 'start=68&end=1&steps=5&interpolation=spectral&algo=ciede2000',
    image: '/og/gradient/68/1/5.png',
    algo: 'ciede2000',
    page: [
      ['#1A1F27', 'Ink Blue', '#1A1F27'],
      ['#1F4646', 'Morbol Green', '#3F5654'],
      ['#5F7558', 'Adamantoise Green', '#69856F'],
      ['#BACFAA', 'Pastel Green', '#A8B59A'],
      ['#E4DFD0', 'Snow White', '#E4DFD0'],
    ],
    drawn: [0, 1, 2, 3, 4],
  },
];

/** One meta tag's content, with the crawler's `&amp;` decoded. */
function metaContent(html: string, tag: string): string {
  const content = new RegExp(`<meta ${tag} content="([^"]+)">`).exec(html)?.[1];
  expect(content, tag).toBeDefined();
  return content!.replace(/&amp;/g, '&');
}

/** Request an image URL the crawler wrote; the bands its one card was handed. */
async function bandsAt(imageUrl: string): Promise<BandEntry[]> {
  const { pathname, search } = new URL(imageUrl);
  handed.length = 0;
  const res = await app.request(`${pathname}${search}`, {}, ENV);
  expect(res.status, imageUrl).toBe(200);
  expect(handed, imageUrl).toHaveLength(1);
  return handed[0];
}

const withQuery = (url: string, pair: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}${pair}`;

describe('BUG-008: a gradient share unfurls the steps the Gradient Builder shows', () => {
  it.each(CASES)('$label', async ({ share, image, algo, page, drawn }) => {
    const middle = drawn.slice(1, -1);
    for (const locale of ['en', 'ja'] as const) {
      const lang = locale === 'en' ? '' : `&lang=${locale}`;
      const res = await app.request(
        `/gradient/?${share}&v=1${lang}`,
        { headers: { 'User-Agent': CRAWLER_UA } },
        ENV,
      );
      expect(res.status).toBe(200);
      const html = await res.text();

      const ogImage = metaContent(html, 'property="og:image"');
      const twitterImage = metaContent(html, 'name="twitter:image"');

      for (const url of [ogImage, twitterImage]) {
        const bands = await bandsAt(url);
        const hexes = bands.map((b) => b.hex.toUpperCase());
        const roles = bands.map((b) => b.role);
        const tags = bands.slice(1, -1).map((b) => b.tag);
        const names = bands.map((b) => b.name);
        // The page's own dyes, at the page's own steps
        expect(hexes, url).toEqual(drawn.map((i) => page[i][0]));
        // Labeled with the page's step numbers, which count from 1 at START
        const steps = middle.map((i) => String(i + 1));
        expect(roles, url).toEqual([role('start', locale), ...steps, role('end', locale)]);
        // Each Δ measured against the page's ideal at that step, so this pins
        // where on the ramp the step sits, not only the dye it landed nearest
        // Computed as the page's rail does, from core, never through the card's
        // own deltaForAlgorithm / fmtDelta (which would agree with themselves)
        const method = normalizeMatchingMethod(algo);
        const deltas = middle.map((i) =>
          ColorService.getDistanceForMethod(page[i][2], page[i][0], method).toFixed(
            BAND_METHOD_DP[method],
          ),
        );
        expect(tags, url).toEqual(deltas.map((d) => `Δ${d}`));
        // The page's names are English; other locales name the same dyes
        if (locale === 'en') expect(names, url).toEqual(drawn.map((i) => page[i][1]));
      }

      // The URLs themselves, checked after the cards so a wiring fault reports
      // as the wrong picture: the share's own count and mode, hsv elided
      const expected = `${new URL(ENV.OG_IMAGE_BASE_URL).origin}${image}`;
      expect(ogImage).toBe(locale === 'en' ? expected : withQuery(expected, `lang=${locale}`));
      expect(twitterImage).toBe(withQuery(ogImage, 'frame=x'));
    }
  });
});

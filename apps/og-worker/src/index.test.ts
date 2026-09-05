/**
 * Route-level integration tests for og-worker index.ts
 *
 * Tests parameter validation, error responses, crawler vs non-crawler routing,
 * and the health endpoint. SVG rendering is mocked since resvg-wasm requires
 * a WASM runtime not available in test.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the renderer before importing the app
const rendered: string[] = [];
vi.mock('./services/renderer', () => ({
  renderOGImage: vi.fn(async (svg: string) => {
    rendered.push(svg);
    return new Response('mock-png-data', {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  }),
}));

// Now import the app (after mocks are set up)
const { default: app } = await import('./index');

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_ENV = {
  APP_BASE_URL: 'https://xivdyetools.app',
  OG_IMAGE_BASE_URL: 'https://og.xivdyetools.app/og',
};

const CRAWLER_UA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';

function makeRequest(path: string, options: { userAgent?: string } = {}): Request {
  return new Request(`http://localhost${path}`, {
    headers: {
      'User-Agent': options.userAgent || 'Mozilla/5.0 Chrome/120',
    },
  });
}

// ============================================================================
// Health Check
// ============================================================================

describe('GET /health', () => {
  it('returns ok status with service name', async () => {
    const res = await app.request('/health', {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('xivdyetools-og-worker');
    expect(body.timestamp).toBeDefined();
  });
});

// ============================================================================
// Root Route
// ============================================================================

describe('GET /', () => {
  it('redirects regular users to APP_BASE_URL', async () => {
    const res = await app.request('/', {}, TEST_ENV);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://xivdyetools.app/');
  });

  it('returns OG HTML for crawlers', async () => {
    const req = makeRequest('/');
    req.headers.set('User-Agent', CRAWLER_UA);
    const res = await app.fetch(req, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    const html = await res.text();
    expect(html).toContain('og:title');
    expect(html).toContain('XIV Dye Tools');
  });
});

// ============================================================================
// Tool Routes (Crawler Detection)
// ============================================================================

describe('Tool routes (crawler vs user)', () => {
  for (const tool of ['harmony', 'gradient', 'mixer', 'swatch', 'comparison', 'accessibility']) {
    describe(`GET /${tool}/`, () => {
      it('returns OG HTML for crawlers', async () => {
        const req = makeRequest(`/${tool}/`);
        req.headers.set('User-Agent', CRAWLER_UA);
        const res = await app.fetch(req, TEST_ENV);
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain('og:title');
      });
    });
  }
});

// ============================================================================
// OG Image Routes: Harmony
// ============================================================================

describe('GET /og/harmony/:dyeId/:harmonyType', () => {
  it('returns 400 for invalid (NaN) dye ID', async () => {
    const res = await app.request('/og/harmony/abc/complementary', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Invalid dye ID');
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/harmony/43/complementary', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('strips .png extension from harmonyType', async () => {
    const res = await app.request('/og/harmony/43/tetradic.png', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Image Routes: Gradient
// ============================================================================

describe('GET /og/gradient/:startId/:endId/:steps', () => {
  it('returns 400 for NaN start dye ID', async () => {
    const res = await app.request('/og/gradient/abc/44/5', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Invalid dye ID');
  });

  it('returns 400 for NaN end dye ID', async () => {
    const res = await app.request('/og/gradient/43/abc/5', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for steps below minimum (< 2)', async () => {
    const res = await app.request('/og/gradient/43/44/1', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('steps must be between 2 and 20');
  });

  it('returns 400 for steps above maximum (> 20)', async () => {
    const res = await app.request('/og/gradient/43/44/21', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('steps must be between 2 and 20');
  });

  it('returns 400 for NaN steps', async () => {
    const res = await app.request('/og/gradient/43/44/abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/gradient/43/44/5', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('accepts boundary value steps=2', async () => {
    const res = await app.request('/og/gradient/43/44/2', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary value steps=20', async () => {
    const res = await app.request('/og/gradient/43/44/20', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Image Routes: Mixer (2 dyes)
// ============================================================================

describe('GET /og/mixer/:dyeAId/:dyeBId/:ratio', () => {
  it('returns 400 for NaN dye A ID', async () => {
    const res = await app.request('/og/mixer/abc/44/50', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Invalid dye ID');
  });

  it('returns 400 for NaN dye B ID', async () => {
    const res = await app.request('/og/mixer/43/abc/50', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for ratio below minimum (< 1)', async () => {
    const res = await app.request('/og/mixer/43/44/0', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('ratio must be between 1 and 99');
  });

  it('returns 400 for ratio above maximum (> 99)', async () => {
    const res = await app.request('/og/mixer/43/44/100', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for NaN ratio', async () => {
    const res = await app.request('/og/mixer/43/44/abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/mixer/43/44/50', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('accepts boundary ratio=1', async () => {
    const res = await app.request('/og/mixer/43/44/1', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary ratio=99', async () => {
    const res = await app.request('/og/mixer/43/44/99', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  describe('?mode= (the web mixer\'s chosen mixing algorithm)', () => {
    /**
     * The web mixer share URL has always carried `?mode=`; this worker never
     * read it, so every shared mix rendered in CIELAB. Wiring it up means
     * `mode` must join the FINDING-024 query-key allowlist, be value-checked
     * the way `algo` is, and — the part that is easy to miss — join the edge
     * CACHE KEY, or the first mode rendered for a dye pair would be served
     * to every other mode for up to seven days.
     */
    it.each(['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'])(
      'renders for mode=%s',
      async (mode) => {
        const res = await app.request(`/og/mixer/43/44/50?mode=${mode}`, {}, TEST_ENV);
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('image/png');
      },
    );

    it('rejects an unknown mode without echoing it back', async () => {
      const res = await app.request('/og/mixer/43/44/50?mode=nonsense', {}, TEST_ENV);
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe('Invalid mixing mode');
      expect(JSON.stringify(body)).not.toContain('nonsense');
    });

    it('treats an empty mode as absent, like algo', async () => {
      const res = await app.request('/og/mixer/43/44/50?mode=', {}, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it('works on the three-dye route too', async () => {
      const res = await app.request('/og/mixer/43/44/45/50?mode=spectral', {}, TEST_ENV);
      expect(res.status).toBe(200);
    });
  });
});

// ============================================================================
// OG Image Routes: Harmony ?wheel= (the Harmony Explorer's colour wheel)
// ============================================================================

describe('?wheel= (the Harmony Explorer\'s colour wheel)', () => {
  it.each(['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'])('renders for wheel=%s', async (wheel) => {
    const res = await app.request(`/og/harmony/43/complementary?wheel=${wheel}`, {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('rejects an unknown wheel without echoing it back', async () => {
    const res = await app.request('/og/harmony/43/complementary?wheel=cmyk', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe('Invalid color wheel');
    expect(JSON.stringify(body)).not.toContain('cmyk');
  });

  it('treats an empty wheel as absent, like algo', async () => {
    const res = await app.request('/og/harmony/43/complementary?wheel=', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('is an allowed key on every /og/* route, like mode', async () => {
    const res = await app.request('/og/gradient/43/44/5?wheel=ryb', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('validates case-insensitively, matching the web app which accepts wheel=MUNSELL', async () => {
    const res = await app.request('/og/harmony/43/complementary?wheel=RYB', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });
});

// ============================================================================
// OG Image Routes: Mixer (3 dyes)
// ============================================================================

describe('GET /og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio', () => {
  it('returns 400 for NaN dye C ID', async () => {
    const res = await app.request('/og/mixer/43/44/abc/50', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Invalid dye ID');
  });

  it('returns 400 for invalid ratio in 3-dye mode', async () => {
    const res = await app.request('/og/mixer/43/44/45/0', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid 3-dye parameters', async () => {
    const res = await app.request('/og/mixer/43/44/45/50', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });
});

// ============================================================================
// OG Image Routes: Swatch
// ============================================================================

// FF5500 (upper-case), not ff5500: 2026-08-29 FINDING-024 (OG-4, ruling
// S7-R12) validates :color against the canonical (upper-case) form
// parseHexColor emits — lowercase is now a 400 (og-guards.test.ts covers
// that rejection directly). These fixtures use a canonical colour so each
// test keeps exercising only the :limit behaviour its name describes.
describe('GET /og/swatch/:color/:limit', () => {
  it('returns 400 for limit below minimum (< 1)', async () => {
    const res = await app.request('/og/swatch/FF5500/0', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('limit must be between 1 and 20');
  });

  it('returns 400 for limit above maximum (> 20)', async () => {
    const res = await app.request('/og/swatch/FF5500/21', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for NaN limit', async () => {
    const res = await app.request('/og/swatch/FF5500/abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/swatch/FF5500/5', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('accepts boundary limit=1', async () => {
    const res = await app.request('/og/swatch/FF5500/1', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary limit=20', async () => {
    const res = await app.request('/og/swatch/FF5500/20', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Image Routes: Comparison
// ============================================================================

describe('GET /og/comparison/:dyes', () => {
  it('returns 400 for zero valid dye IDs', async () => {
    const res = await app.request('/og/comparison/abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('comparison requires 1–16 valid dye IDs');
  });

  it('returns 400 for too many dye IDs (> 16)', async () => {
    const ids = Array.from({ length: 17 }, (_, i) => 42 + i).join(',');
    const res = await app.request(`/og/comparison/${ids}`, {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('honours ?frame=x like every other image route (DEAD-010)', async () => {
    rendered.length = 0;
    const res = await app.request('/og/comparison/1,2,3.png?frame=x', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(rendered.at(-1)).toContain('height="210"');
    rendered.length = 0;
    await app.request('/og/comparison/1,2,3.png', {}, TEST_ENV);
    expect(rendered.at(-1)).toContain('height="350"');
  });

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R12): this used to silently
  // filter "abc,43" down to the single valid id [43] and render 200 — the
  // same "many spellings render one card" shape the canonical dye-list
  // grammar now closes (og-guards.test.ts has the "1,2,x,3" case). A list
  // with any non-canonical entry is rejected outright, not trimmed.
  it('rejects a dye list containing a non-canonical entry instead of silently dropping it', async () => {
    const res = await app.request('/og/comparison/abc,43', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('comparison requires 1–16 valid dye IDs');
  });

  it('returns 400 when all IDs are NaN', async () => {
    const res = await app.request('/og/comparison/abc,def,ghi', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for single valid dye', async () => {
    const res = await app.request('/og/comparison/43', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns image for multiple valid dyes', async () => {
    const res = await app.request('/og/comparison/43,44,45', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary value of 16 dyes', async () => {
    const ids = Array.from({ length: 16 }, (_, i) => 42 + i).join(',');
    const res = await app.request(`/og/comparison/${ids}`, {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Image Routes: Accessibility
// ============================================================================

describe('GET /og/accessibility/:dyes/:visionType', () => {
  it('returns 400 for zero valid dye IDs', async () => {
    const res = await app.request('/og/accessibility/abc/protanopia', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('accessibility requires 1–16 valid dye IDs');
  });

  it('returns 400 for too many dye IDs', async () => {
    const ids = Array.from({ length: 17 }, (_, i) => 42 + i).join(',');
    const res = await app.request(`/og/accessibility/${ids}/protanopia`, {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/accessibility/43,44/protanopia', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('strips .png extension from visionType', async () => {
    const res = await app.request('/og/accessibility/43/deuteranopia.png', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Default Image
// ============================================================================

describe('GET /og/default.png', () => {
  it('returns image response', async () => {
    const res = await app.request('/og/default.png', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });
});

// ============================================================================
// Catch-all Route
// ============================================================================

describe('Catch-all route', () => {
  // FINDING-024 / OG-9: an unknown path is a 404, not a cacheable 200 — the
  // crawler still gets the fallback embed in the body.
  it('returns the fallback OG HTML with a 404 for crawlers on unknown paths', async () => {
    const req = makeRequest('/unknown/path');
    req.headers.set('User-Agent', CRAWLER_UA);
    const res = await app.fetch(req, TEST_ENV);
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const html = await res.text();
    expect(html).toContain('og:title');
    expect(html).toContain('XIV Dye Tools');
  });
});

// ============================================================================
// 5.0 blocker fixes: per-tool defaults, new tool routes, ?lang= propagation
// ============================================================================

describe('per-tool default OG images', () => {
  it('serves /og/{tool}/default.png for every supported tool', async () => {
    for (const tool of [
      'harmony',
      'gradient',
      'mixer',
      'swatch',
      'comparison',
      'accessibility',
      'extractor',
      'presets',
      'budget',
    ]) {
      const res = await app.request(`/og/${tool}/default.png`, {}, TEST_ENV);
      expect(res.status, tool).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
    }
  });

  it('404s an unknown tool default', async () => {
    const res = await app.request('/og/nonsense/default.png', {}, TEST_ENV);
    expect(res.status).toBe(404);
  });

  it('does not let comparison parse default.png as a dye list', async () => {
    const res = await app.request('/og/comparison/default.png', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });
});

describe('extractor/presets/budget crawler routes (DEAD-001)', () => {
  it('a bare tool URL emits the TOOL default card, never the root card', async () => {
    for (const tool of ['extractor', 'presets', 'budget']) {
      const res = await app.request(
        `/${tool}/`,
        { headers: { 'User-Agent': CRAWLER_UA } },
        TEST_ENV
      );
      expect(res.status, tool).toBe(200);
      const html = await res.text();
      expect(html, tool).toContain(`https://og.xivdyetools.app/og/${tool}/default.png`);
      expect(html, tool).not.toContain('og.xivdyetools.app/og/default.png');
    }
  });

  it('a shared extractor palette emits its 15E card', async () => {
    const res = await app.request(
      '/extractor/?colors=8E5A3C,C9A96A&algo=oklab',
      { headers: { 'User-Agent': CRAWLER_UA } },
      TEST_ENV
    );
    const html = await res.text();
    expect(html).toContain('https://og.xivdyetools.app/og/extractor/8E5A3C,C9A96A.png');
  });

  it('a curated preset PATH (/presets/:id — the web app share form) emits its card', async () => {
    const res = await app.request(
      '/presets/gc-maelstrom',
      { headers: { 'User-Agent': CRAWLER_UA } },
      TEST_ENV
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('https://og.xivdyetools.app/og/presets/gc-maelstrom.png');
    expect(html).toContain('https://xivdyetools.app/presets/gc-maelstrom');
  });

  it('a community preset id (not in the curated set) degrades to the presets default card', async () => {
    const res = await app.request(
      '/presets/community-0f9d5c2a-1111-2222-3333-444444444444',
      { headers: { 'User-Agent': CRAWLER_UA } },
      TEST_ENV
    );
    const html = await res.text();
    expect(html).toContain('/og/presets/default.png');
  });

  it('a shared budget target emits its card; a bare-hex target degrades to the default', async () => {
    let html = await (
      await app.request('/budget/?dye=102', { headers: { 'User-Agent': CRAWLER_UA } }, TEST_ENV)
    ).text();
    expect(html).toContain('https://og.xivdyetools.app/og/budget/102.png');
    html = await (
      await app.request('/budget/?hex=ABCDEF', { headers: { 'User-Agent': CRAWLER_UA } }, TEST_ENV)
    ).text();
    expect(html).toContain('/og/budget/default.png');
  });

  it('humans on /presets/:id pass through to the SPA like any tool page', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('spa'));
    // On the app host — any other ingress host redirects instead (FINDING-024 / OG-5)
    const res = await app.request('https://xivdyetools.app/presets/gc-maelstrom', {}, TEST_ENV);
    expect(await res.text()).toBe('spa');
    fetchSpy.mockRestore();
  });
});

describe('every image route honours ?frame=x (the class DEAD-010 belonged to)', () => {
  // One representative URL per image route. A route that forgets to pass
  // frameFromQuery(c) renders the Discord frame for X, which X then crops.
  const IMAGE_ROUTES = [
    '/og/harmony/102/tetradic.png',
    '/og/gradient/1/102/5.png',
    '/og/mixer/1/102/60.png',
    '/og/mixer/1/102/50/60.png',
    '/og/swatch/7A6B4F/4.png',
    '/og/comparison/1,2,3.png',
    '/og/accessibility/1,2/protanopia.png',
    '/og/extractor/8E5A3C-31,C9A96A-24.png',
    '/og/presets/gc-maelstrom.png',
    '/og/budget/102.png',
    '/og/harmony/default.png',
    '/og/default.png',
  ];

  for (const path of IMAGE_ROUTES) {
    it(`${path}: default → 400×350, ?frame=x → 400×210`, async () => {
      rendered.length = 0;
      expect((await app.request(path, {}, TEST_ENV)).status).toBe(200);
      expect(rendered.at(-1), path).toContain('height="350"');
      rendered.length = 0;
      expect((await app.request(`${path}?frame=x`, {}, TEST_ENV)).status).toBe(200);
      expect(rendered.at(-1), `${path}?frame=x`).toContain('height="210"');
    });
  }
});

describe('GET /og/extractor/:colors — share is optional', () => {
  it('accepts bare RRGGBB entries (the web app share grammar carries no shares)', async () => {
    rendered.length = 0;
    const res = await app.request('/og/extractor/8E5A3C,C9A96A.png', {}, TEST_ENV);
    expect(res.status).toBe(200);
    // Equal bands, ranked, no invented percentage
    expect(rendered.at(-1)).not.toContain('%<');
  });

  it('still accepts RRGGBB-share pairs', async () => {
    const res = await app.request('/og/extractor/8E5A3C-31,C9A96A-24.png', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('400s when nothing parses', async () => {
    const res = await app.request('/og/extractor/zzz.png', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });
});

describe('?lang= travels with emitted og:image URLs', () => {
  it('appends lang for non-English crawler requests', async () => {
    const res = await app.request(
      '/harmony/?dye=43&harmony=tetradic&lang=ja',
      { headers: { 'User-Agent': CRAWLER_UA } },
      TEST_ENV
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('/og/harmony/43/tetradic.png?lang=ja');
  });

  it('keeps English URLs unparameterised (stable cache keys)', async () => {
    const res = await app.request(
      '/harmony/?dye=43&harmony=tetradic',
      { headers: { 'User-Agent': CRAWLER_UA } },
      TEST_ENV
    );
    const html = await res.text();
    expect(html).toContain('/og/harmony/43/tetradic.png');
    expect(html).not.toContain('.png?lang=');
  });
});

describe('the root and catch-all crawler cards localize via ?lang= too (OG-I18N-002)', () => {
  it('GET /?lang=ja serves a Japanese root embed', async () => {
    const res = await app.request('/?lang=ja', { headers: { 'User-Agent': CRAWLER_UA } }, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<html lang="ja">');
    expect(html).not.toContain('FFXIV Color &amp; Dye Companion');
    expect(html).toContain('カララント');
  });

  it('an unknown path with ?lang=de serves a German fallback embed (as a 404 — OG-9)', async () => {
    const res = await app.request('/nope/?lang=de', { headers: { 'User-Agent': CRAWLER_UA } }, TEST_ENV);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('<html lang="de">');
    expect(html).not.toContain('FFXIV Color &amp; Dye Companion');
  });
});

// ============================================================================
// FINDING-024 (2026-08-21 security audit): crawler HTML hygiene on the
// production origin — OG-3 (headers / Vary), OG-9 (404 for unknown paths),
// OG-8 (400 bodies), OG-5 (pass-through host gate), OG-7 (analytics footprint)
// ============================================================================

describe('FINDING-024: crawler HTML carries security headers and varies on User-Agent (OG-3)', () => {
  const expectHardened = (res: Response) => {
    const csp = res.headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("style-src 'unsafe-inline'"); // the template's one <style> block
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Vary')).toMatch(/User-Agent/);
  };

  it('tool-route crawler HTML', async () => {
    const res = await app.request(
      '/harmony/?dye=1&harmony=triadic',
      { headers: { 'User-Agent': CRAWLER_UA } },
      TEST_ENV
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
    expectHardened(res);
  });

  it('the root crawler HTML', async () => {
    const res = await app.request('/', { headers: { 'User-Agent': CRAWLER_UA } }, TEST_ENV);
    expect(res.status).toBe(200);
    expectHardened(res);
  });

  it('the catch-all crawler HTML (404 + no-store — OG-9)', async () => {
    const res = await app.request('/harmony/anything/else', { headers: { 'User-Agent': CRAWLER_UA } }, TEST_ENV);
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expectHardened(res);
    expect(await res.text()).toContain('og:title');
  });
});

describe('FINDING-024: 400 bodies do not echo the offending parameter (OG-8)', () => {
  it.each([
    ['/og/harmony/1/junkvalue', 'Invalid harmony type'],
    ['/og/harmony/1/complementary?algo=junkvalue', 'Invalid algorithm'],
    ['/og/gradient/1/2/5?algo=junkvalue', 'Invalid algorithm'],
    ['/og/accessibility/1/junkvalue', 'Invalid vision type'],
  ])('%s → "%s"', async (path, error) => {
    const res = await app.request(path, {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(error);
    expect(JSON.stringify(body)).not.toContain('junkvalue');
  });
});

describe('FINDING-024 / OG-5: the human pass-through only ever fetches the app host', () => {
  it('passes humans through to the SPA on the APP_BASE_URL host', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('spa'));
    const res = await app.request('https://xivdyetools.app/harmony/?dye=1', {}, TEST_ENV);
    expect(await res.text()).toBe('spa');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('redirects humans to the app instead of self-fetching on any other ingress host', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    for (const url of [
      'https://xivdyetools-og-worker-dev.example.workers.dev/harmony/?dye=1', // workers.dev (OG-5)
      'https://og.xivdyetools.app/harmony/', // the image host (BUG-069)
      'http://localhost/gradient/', // wrangler dev
      'https://xivdyetools-og-worker-dev.example.workers.dev/unknown/path', // catch-all on workers.dev
    ]) {
      const res = await app.request(url, {}, TEST_ENV);
      expect(res.status, url).toBe(302);
      expect(res.headers.get('Location'), url).toBe('https://xivdyetools.app/');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('keeps answering 404 JSON for unknown paths on the image host itself (BUG-069)', async () => {
    const res = await app.request('https://og.xivdyetools.app/not/a/card', {}, TEST_ENV);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});

describe('FINDING-024 / OG-7: analytics datapoints only for crawler hits', () => {
  it('a human page view on a tool path writes no datapoint; a crawler hit writes one', async () => {
    const writeDataPoint = vi.fn();
    const env = { ...TEST_ENV, ANALYTICS: { writeDataPoint } };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('spa'));
    await app.request('https://xivdyetools.app/harmony/?dye=1', {}, env);
    expect(writeDataPoint).not.toHaveBeenCalled();
    await app.request('https://xivdyetools.app/harmony/?dye=1', { headers: { 'User-Agent': CRAWLER_UA } }, env);
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint.mock.calls[0][0].blobs).toEqual(['og_request', 'harmony', 'discord']);
    fetchSpy.mockRestore();
  });
});

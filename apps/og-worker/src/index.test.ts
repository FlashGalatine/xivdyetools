/**
 * Route-level integration tests for og-worker index.ts
 *
 * Tests parameter validation, error responses, crawler vs non-crawler routing,
 * and the health endpoint. SVG rendering is mocked since resvg-wasm requires
 * a WASM runtime not available in test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the renderer before importing the app
vi.mock('./services/renderer', () => ({
  renderOGImage: vi.fn(async (_svg: string, _cacheMaxAge?: number) => {
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
    const res = await app.request('/og/harmony/5771/complementary', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('strips .png extension from harmonyType', async () => {
    const res = await app.request('/og/harmony/5771/tetradic.png', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Image Routes: Gradient
// ============================================================================

describe('GET /og/gradient/:startId/:endId/:steps', () => {
  it('returns 400 for NaN start dye ID', async () => {
    const res = await app.request('/og/gradient/abc/5772/5', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Invalid dye ID');
  });

  it('returns 400 for NaN end dye ID', async () => {
    const res = await app.request('/og/gradient/5771/abc/5', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for steps below minimum (< 2)', async () => {
    const res = await app.request('/og/gradient/5771/5772/1', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('steps must be between 2 and 20');
  });

  it('returns 400 for steps above maximum (> 20)', async () => {
    const res = await app.request('/og/gradient/5771/5772/21', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('steps must be between 2 and 20');
  });

  it('returns 400 for NaN steps', async () => {
    const res = await app.request('/og/gradient/5771/5772/abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/gradient/5771/5772/5', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('accepts boundary value steps=2', async () => {
    const res = await app.request('/og/gradient/5771/5772/2', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary value steps=20', async () => {
    const res = await app.request('/og/gradient/5771/5772/20', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Image Routes: Mixer (2 dyes)
// ============================================================================

describe('GET /og/mixer/:dyeAId/:dyeBId/:ratio', () => {
  it('returns 400 for NaN dye A ID', async () => {
    const res = await app.request('/og/mixer/abc/5772/50', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Invalid dye ID');
  });

  it('returns 400 for NaN dye B ID', async () => {
    const res = await app.request('/og/mixer/5771/abc/50', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for ratio below minimum (< 1)', async () => {
    const res = await app.request('/og/mixer/5771/5772/0', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('ratio must be between 1 and 99');
  });

  it('returns 400 for ratio above maximum (> 99)', async () => {
    const res = await app.request('/og/mixer/5771/5772/100', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for NaN ratio', async () => {
    const res = await app.request('/og/mixer/5771/5772/abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/mixer/5771/5772/50', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('accepts boundary ratio=1', async () => {
    const res = await app.request('/og/mixer/5771/5772/1', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary ratio=99', async () => {
    const res = await app.request('/og/mixer/5771/5772/99', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OG Image Routes: Mixer (3 dyes)
// ============================================================================

describe('GET /og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio', () => {
  it('returns 400 for NaN dye C ID', async () => {
    const res = await app.request('/og/mixer/5771/5772/abc/50', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Invalid dye ID');
  });

  it('returns 400 for invalid ratio in 3-dye mode', async () => {
    const res = await app.request('/og/mixer/5771/5772/5773/0', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid 3-dye parameters', async () => {
    const res = await app.request('/og/mixer/5771/5772/5773/50', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });
});

// ============================================================================
// OG Image Routes: Swatch
// ============================================================================

describe('GET /og/swatch/:color/:limit', () => {
  it('returns 400 for limit below minimum (< 1)', async () => {
    const res = await app.request('/og/swatch/ff5500/0', {}, TEST_ENV);
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toContain('limit must be between 1 and 20');
  });

  it('returns 400 for limit above maximum (> 20)', async () => {
    const res = await app.request('/og/swatch/ff5500/21', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns 400 for NaN limit', async () => {
    const res = await app.request('/og/swatch/ff5500/abc', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/swatch/ff5500/5', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('accepts boundary limit=1', async () => {
    const res = await app.request('/og/swatch/ff5500/1', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary limit=20', async () => {
    const res = await app.request('/og/swatch/ff5500/20', {}, TEST_ENV);
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
    const ids = Array.from({ length: 17 }, (_, i) => 5770 + i).join(',');
    const res = await app.request(`/og/comparison/${ids}`, {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('filters out NaN IDs from comma-separated list', async () => {
    // "abc,5771" should parse to [5771] which is valid (length 1)
    const res = await app.request('/og/comparison/abc,5771', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('returns 400 when all IDs are NaN', async () => {
    const res = await app.request('/og/comparison/abc,def,ghi', {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for single valid dye', async () => {
    const res = await app.request('/og/comparison/5771', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns image for multiple valid dyes', async () => {
    const res = await app.request('/og/comparison/5771,5772,5773', {}, TEST_ENV);
    expect(res.status).toBe(200);
  });

  it('accepts boundary value of 16 dyes', async () => {
    const ids = Array.from({ length: 16 }, (_, i) => 5770 + i).join(',');
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
    const ids = Array.from({ length: 17 }, (_, i) => 5770 + i).join(',');
    const res = await app.request(`/og/accessibility/${ids}/protanopia`, {}, TEST_ENV);
    expect(res.status).toBe(400);
  });

  it('returns image for valid parameters', async () => {
    const res = await app.request('/og/accessibility/5771,5772/protanopia', {}, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('strips .png extension from visionType', async () => {
    const res = await app.request('/og/accessibility/5771/deuteranopia.png', {}, TEST_ENV);
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
  it('returns OG HTML for crawlers on unknown paths', async () => {
    const req = makeRequest('/unknown/path');
    req.headers.set('User-Agent', CRAWLER_UA);
    const res = await app.fetch(req, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('og:title');
    expect(html).toContain('XIV Dye Tools');
  });
});

/**
 * `bodyGuards()` parity tests.
 *
 * REFACTOR-009 (docs/audits/2026-09-16-deep-dive): the two describe blocks
 * below are the `apps/oauth` and `apps/presets-api` configurations, with the
 * cases ported from those apps' own suites
 * (`apps/oauth/src/__tests__/body-validation.test.ts`,
 * `apps/presets-api/tests/middleware/body-validation.test.ts` and
 * `body-validation-preview.test.ts`). Where a ported case only asserted a
 * status code, the whole response body is asserted here as well — the point of
 * the factory is that neither Worker changes a response byte when it adopts it.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { bodyGuards } from './index.js';
import type { BodyGuardMiddleware } from './index.js';

type TestEnv = { Bindings: Record<string, never> };

const OAUTH_MAX_BODY_SIZE = 10 * 1024;
const PRESETS_MAX_BODY_SIZE = 100 * 1024;
const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

/** `apps/presets-api`'s one exempt request shape, verbatim. */
const PREVIEW_IMAGE_PATH = /^\/api\/v1\/presets\/[^/]+\/preview-image\/?$/;

function isPreviewImageUpload(method: string, path: string): boolean {
  return method === 'POST' && PREVIEW_IMAGE_PATH.test(path);
}

/** The `apps/oauth` configuration. */
function oauthGuards(): BodyGuardMiddleware<TestEnv> {
  return bodyGuards<TestEnv>({
    maxSize: OAUTH_MAX_BODY_SIZE,
    onTooLarge: (c) =>
      c.json(
        {
          error: 'Payload too large',
          message: `Request body exceeds maximum size of ${OAUTH_MAX_BODY_SIZE} bytes`,
        },
        413
      ),
    onInvalidJson: (c, message) =>
      c.json({ success: false, error: 'Invalid request body', message }, 400),
  });
}

/** The `apps/presets-api` configuration, exemption included. */
function presetsGuards(): BodyGuardMiddleware<TestEnv> {
  return bodyGuards<TestEnv>({
    maxSize: PRESETS_MAX_BODY_SIZE,
    onTooLarge: (c) =>
      c.json(
        {
          success: false,
          error: 'PAYLOAD_TOO_LARGE',
          message: `Request body exceeds maximum size of ${PRESETS_MAX_BODY_SIZE} bytes`,
        },
        413
      ),
    onInvalidJson: (c, message) => c.json({ success: false, error: 'BAD_REQUEST', message }, 400),
    exempt: {
      match: (c) => isPreviewImageUpload(c.req.method, c.req.path),
      maxSize: MAX_PREVIEW_IMAGE_BYTES,
      onTooLarge: (c) =>
        c.json(
          { success: false, error: 'VALIDATION_ERROR', message: 'Image must be at most 5 MB' },
          400
        ),
    },
  });
}

interface Harness {
  app: Hono<TestEnv>;
  /** True once a route handler has run — proves a guard let the request past. */
  reached: () => boolean;
}

/**
 * Mount a pair of guards under `prefix` with an echo route that parses the
 * body and a GET route that does not.
 */
function harness(guards: BodyGuardMiddleware<TestEnv>, prefix: string): Harness {
  let reached = false;
  const app = new Hono<TestEnv>();
  app.use(`${prefix}/*`, guards.bodySizeLimit);
  app.use(`${prefix}/*`, guards.jsonDepthLimit);
  app.post(`${prefix}/test`, async (c) => {
    reached = true;
    const body: unknown = await c.req.json();
    return c.json({ success: true, body });
  });
  app.get(`${prefix}/test`, (c) => {
    reached = true;
    return c.json({ success: true });
  });
  return { app, reached: () => reached };
}

function jsonPost(body: string): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };
}

/** A value whose deepest leaf sits at exactly `depth`. */
function nestToDepth(depth: number): unknown {
  let value: unknown = 'leaf';
  for (let i = 0; i < depth; i++) {
    value = { level: value };
  }
  return value;
}

describe('bodyGuards — the apps/oauth configuration', () => {
  function app(): Harness {
    return harness(oauthGuards(), '/auth');
  }

  describe('bodySizeLimit (SEC-004)', () => {
    it('lets a request within the 10 KB cap through to the route', async () => {
      const h = app();
      const res = await h.app.request(
        '/auth/test',
        jsonPost(JSON.stringify({ code: 'test-code', code_verifier: 'test-verifier' }))
      );

      expect(res.status).toBe(200);
      expect(h.reached()).toBe(true);
    });

    it('rejects a body over 10 KB with oauth’s exact 413 body', async () => {
      const h = app();
      const res = await h.app.request(
        '/auth/test',
        jsonPost(JSON.stringify({ data: 'x'.repeat(11 * 1024) }))
      );

      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({
        error: 'Payload too large',
        message: 'Request body exceeds maximum size of 10240 bytes',
      });
      expect(h.reached()).toBe(false);
    });

    it('lets a GET through regardless', async () => {
      const h = app();
      const res = await h.app.request('/auth/test');

      expect(res.status).toBe(200);
      expect(h.reached()).toBe(true);
    });
  });

  describe('jsonDepthLimit (SEC-003)', () => {
    it('lets JSON within the depth limit through', async () => {
      const h = app();
      const res = await h.app.request(
        '/auth/test',
        jsonPost(JSON.stringify({ a: { b: { c: 'value' } } }))
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, body: { a: { b: { c: 'value' } } } });
    });

    it('rejects JSON past the depth limit with oauth’s exact 400 body', async () => {
      const h = app();
      let nested: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 12; i++) {
        nested = { level: nested };
      }
      const res = await h.app.request('/auth/test', jsonPost(JSON.stringify(nested)));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'Invalid request body',
        message: 'JSON nesting exceeds maximum depth of 10',
      });
      expect(h.reached()).toBe(false);
    });

    it('accepts depth 10 and rejects depth 11 on the default budget', async () => {
      const accepted = await app().app.request(
        '/auth/test',
        jsonPost(JSON.stringify(nestToDepth(10)))
      );
      expect(accepted.status).toBe(200);

      const rejected = await app().app.request(
        '/auth/test',
        jsonPost(JSON.stringify(nestToDepth(11)))
      );
      expect(rejected.status).toBe(400);
      expect((await rejected.json()) as { message: string }).toMatchObject({
        message: 'JSON nesting exceeds maximum depth of 10',
      });
    });

    it('rejects __proto__ with oauth’s exact 400 body', async () => {
      const h = app();
      const res = await h.app.request('/auth/test', jsonPost('{"__proto__": {"isAdmin": true}}'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'Invalid request body',
        message: 'Invalid JSON structure',
      });
      expect(h.reached()).toBe(false);
    });

    it('rejects constructor pollution', async () => {
      const res = await app().app.request(
        '/auth/test',
        jsonPost('{"constructor": {"prototype": {"isAdmin": true}}}')
      );

      expect(res.status).toBe(400);
      expect((await res.json()) as { message: string }).toMatchObject({
        message: 'Invalid JSON structure',
      });
    });

    it('rejects unparseable JSON with oauth’s exact 400 body', async () => {
      const h = app();
      const res = await h.app.request('/auth/test', jsonPost('{bad json}'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'Invalid request body',
        message: 'Invalid JSON syntax',
      });
      expect(h.reached()).toBe(false);
    });

    it('does not inspect a non-JSON content type', async () => {
      const h = app();
      const res = await h.app.request('/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json',
      });

      // The echo route still fails to parse it — what matters is that the guard
      // handed the request on rather than answering 400/413 itself.
      expect(h.reached()).toBe(true);
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(413);
    });

    it('does not inspect an empty body', async () => {
      const h = app();
      const res = await h.app.request('/auth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(h.reached()).toBe(true);
      expect(res.status).not.toBe(400);
    });
  });
});

describe('bodyGuards — the apps/presets-api configuration', () => {
  function app(): Harness {
    return harness(presetsGuards(), '/api');
  }

  describe('bodySizeLimit (SEC-004)', () => {
    it('lets a request within the 100 KB cap through', async () => {
      const h = app();
      const res = await h.app.request('/api/test', jsonPost(JSON.stringify({ name: 'test' })));

      expect(res.status).toBe(200);
      expect(h.reached()).toBe(true);
    });

    it('rejects a body over 100 KB with presets-api’s exact 413 body', async () => {
      const h = app();
      const res = await h.app.request(
        '/api/test',
        jsonPost(JSON.stringify({ data: 'x'.repeat(110 * 1024) }))
      );

      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds maximum size of 102400 bytes',
      });
      expect(h.reached()).toBe(false);
    });

    it('lets a GET through regardless of a content-length header', async () => {
      const h = app();
      const res = await h.app.request('/api/test', {
        method: 'GET',
        headers: { 'Content-Length': String(200 * 1024) },
      });

      expect(res.status).toBe(200);
      expect(h.reached()).toBe(true);
    });
  });

  describe('jsonDepthLimit (SEC-003)', () => {
    it('lets JSON within the depth limit through', async () => {
      const res = await app().app.request(
        '/api/test',
        jsonPost(JSON.stringify({ a: { b: { c: { d: 'value' } } } }))
      );

      expect(res.status).toBe(200);
    });

    it('rejects JSON past the depth limit with presets-api’s exact 400 body', async () => {
      const h = app();
      let nested: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 12; i++) {
        nested = { level: nested };
      }
      const res = await h.app.request('/api/test', jsonPost(JSON.stringify(nested)));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'BAD_REQUEST',
        message: 'JSON nesting exceeds maximum depth of 10',
      });
      expect(h.reached()).toBe(false);
    });

    it('rejects prototype pollution keys with presets-api’s exact 400 body', async () => {
      const res = await app().app.request('/api/test', jsonPost('{"__proto__": {"isAdmin": true}}'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Invalid JSON structure',
      });
    });

    it('rejects constructor pollution', async () => {
      const res = await app().app.request(
        '/api/test',
        jsonPost('{"constructor": {"prototype": {"isAdmin": true}}}')
      );

      expect(res.status).toBe(400);
    });

    it('rejects unparseable JSON with presets-api’s exact 400 body', async () => {
      const res = await app().app.request('/api/test', jsonPost('{invalid json}'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Invalid JSON syntax',
      });
    });

    it('allows arrays within the depth limit', async () => {
      const res = await app().app.request(
        '/api/test',
        jsonPost(JSON.stringify({ items: [1, 2, 3, { nested: true }] }))
      );

      expect(res.status).toBe(200);
    });

    it('does not inspect a non-JSON content type', async () => {
      const h = app();
      const res = await h.app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json',
      });

      expect(h.reached()).toBe(true);
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(413);
    });

    it('does not inspect an empty body', async () => {
      const h = app();
      const res = await h.app.request('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(h.reached()).toBe(true);
      expect(res.status).not.toBe(400);
    });
  });

  describe('the preview-image exemption (FINDING-004 / PAPI-3)', () => {
    function uploadApp(): Harness {
      let reached = false;
      const guards = presetsGuards();
      const app = new Hono<TestEnv>();
      app.use('*', guards.bodySizeLimit);
      app.use('*', guards.jsonDepthLimit);
      app.post('/api/v1/presets/:id/preview-image', async (c) => {
        reached = true;
        const bytes = new Uint8Array(await c.req.arrayBuffer());
        return c.json({ received: bytes.byteLength });
      });
      return { app, reached: () => reached };
    }

    it('rejects an upload over 5 MB from Content-Length before the route runs', async () => {
      const h = uploadApp();
      const res = await h.app.request('/api/v1/presets/abc/preview-image', {
        method: 'POST',
        headers: {
          'Content-Length': String(MAX_PREVIEW_IMAGE_BYTES + 1),
          'Content-Type': 'image/png',
        },
        body: new Uint8Array([1, 2, 3]),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Image must be at most 5 MB',
      });
      expect(h.reached()).toBe(false);
    });

    it('rejects an oversized streamed upload with no Content-Length before the route runs', async () => {
      const h = uploadApp();
      const big = new Uint8Array(MAX_PREVIEW_IMAGE_BYTES + 16);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(big);
          controller.close();
        },
      });
      const init = { method: 'POST', body, duplex: 'half' } as unknown as RequestInit;
      const res = await h.app.request('/api/v1/presets/abc/preview-image', init);

      expect(res.status).toBe(400);
      expect(h.reached()).toBe(false);
    });

    it('lets an in-limit upload through to the route', async () => {
      const h = uploadApp();
      const res = await h.app.request('/api/v1/presets/abc/preview-image', {
        method: 'POST',
        body: new Uint8Array(1024),
        headers: { 'Content-Type': 'image/png' },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: 1024 });
      expect(h.reached()).toBe(true);
    });

    it('raises the cap: a 200 KB upload passes the 100 KB default that would reject it elsewhere', async () => {
      const h = uploadApp();
      const res = await h.app.request('/api/v1/presets/abc/preview-image', {
        method: 'POST',
        body: new Uint8Array(200 * 1024),
        headers: { 'Content-Type': 'image/png' },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: 200 * 1024 });
    });

    it('skips the JSON check entirely on the exempt route', async () => {
      const h = uploadApp();
      // Both a depth violation and a prototype-pollution key, declared as JSON:
      // a non-exempt route answers 400 for either.
      const res = await h.app.request('/api/v1/presets/abc/preview-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deep: nestToDepth(20) }),
      });

      expect(res.status).toBe(200);
      expect(h.reached()).toBe(true);
    });

    it('still applies the JSON check to a path that only looks like the exempt one', async () => {
      const h = uploadApp();
      const res = await h.app.request('/api/v1/presets/abc/preview-image-x', {
        method: 'POST',
        body: JSON.stringify({ deep: nestToDepth(20) }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        error: 'BAD_REQUEST',
        message: 'JSON nesting exceeds maximum depth of 10',
      });
    });

    it('still applies the default 100 KB cap on the exempt path under a non-exempt method', async () => {
      const h = uploadApp();
      // The exemption is POST-only, so a PUT to the same path gets the default
      // cap and the default 413 envelope.
      const res = await h.app.request('/api/v1/presets/abc/preview-image', {
        method: 'PUT',
        body: new Uint8Array(200 * 1024),
        headers: { 'Content-Type': 'image/png' },
      });

      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds maximum size of 102400 bytes',
      });
      expect(h.reached()).toBe(false);
    });
  });
});

describe('bodyGuards — options that neither consumer uses yet', () => {
  it('honours a custom maxDepth', async () => {
    const guards = bodyGuards<TestEnv>({
      maxSize: 1024,
      maxDepth: 2,
      onTooLarge: (c) => c.text('too large', 413),
      onInvalidJson: (c, message) => c.json({ message }, 422),
    });
    const h = harness(guards, '/api');

    const rejected = await h.app.request('/api/test', jsonPost(JSON.stringify(nestToDepth(3))));
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({
      message: 'JSON nesting exceeds maximum depth of 2',
    });

    const accepted = await harness(guards, '/api').app.request(
      '/api/test',
      jsonPost(JSON.stringify(nestToDepth(2)))
    );
    expect(accepted.status).toBe(200);
  });

  it('lets a body it cannot read through instead of rejecting it', async () => {
    let reached = false;
    const guards = bodyGuards<TestEnv>({
      maxSize: 1024,
      onTooLarge: (c) => c.text('too large', 413),
      onInvalidJson: (c, message) => c.json({ message }, 400),
    });
    const app = new Hono<TestEnv>();
    // Only the JSON guard — the size guard would drain the stream first.
    app.use('/api/*', guards.jsonDepthLimit);
    app.post('/api/test', (c) => {
      reached = true;
      return c.json({ success: true });
    });

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error('stream failure'));
      },
    });
    const init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      duplex: 'half',
    } as unknown as RequestInit;
    const res = await app.request('/api/test', init);

    expect(reached).toBe(true);
    expect(res.status).toBe(200);
  });

  it('applies the JSON check to PUT and PATCH but not to DELETE', async () => {
    const guards = bodyGuards<TestEnv>({
      maxSize: 10 * 1024,
      onTooLarge: (c) => c.text('too large', 413),
      onInvalidJson: (c, message) => c.json({ message }, 400),
    });
    const app = new Hono<TestEnv>();
    app.use('/api/*', guards.jsonDepthLimit);
    app.on(['PUT', 'PATCH', 'DELETE'], '/api/test', (c) => c.json({ success: true }));

    const bad = '{"__proto__": {"isAdmin": true}}';
    const headers = { 'Content-Type': 'application/json' };

    const put = await app.request('/api/test', { method: 'PUT', headers, body: bad });
    expect(put.status).toBe(400);

    const patch = await app.request('/api/test', { method: 'PATCH', headers, body: bad });
    expect(patch.status).toBe(400);

    const del = await app.request('/api/test', { method: 'DELETE', headers, body: bad });
    expect(del.status).toBe(200);
  });
});

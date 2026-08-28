/**
 * Preview-image upload body cap (FINDING-004 / PAPI-3, 2026-08-21 audit).
 *
 * The upload route used to buffer the whole body with `c.req.arrayBuffer()`
 * and only then compare against MAX_PREVIEW_IMAGE_BYTES. The body-size
 * middleware must enforce the 5 MB cap on this route while streaming (Content-
 * Length first, then the actual stream), so an oversized upload is refused
 * before it is held in memory — same status and message as the route's own
 * check so the client contract does not change.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { bodySizeLimit } from '../../src/middleware/body-validation';
import { MAX_PREVIEW_IMAGE_BYTES } from '../../src/services/preview-image-service';
import type { Env } from '../../src/types';
import { createMockEnv } from '../test-utils';

function buildApp(onRoute: () => void): Hono<{ Bindings: Env }> {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', bodySizeLimit);
    app.post('/api/v1/presets/:id/preview-image', async (c) => {
        onRoute();
        const bytes = new Uint8Array(await c.req.arrayBuffer());
        return c.json({ received: bytes.byteLength });
    });
    return app;
}

describe('bodySizeLimit on the preview-image upload route', () => {
    it('rejects an upload over 5 MB from Content-Length before the route runs', async () => {
        let reached = false;
        const app = buildApp(() => {
            reached = true;
        });
        const res = await app.request(
            '/api/v1/presets/abc/preview-image',
            {
                method: 'POST',
                headers: { 'Content-Length': String(MAX_PREVIEW_IMAGE_BYTES + 1), 'Content-Type': 'image/png' },
                body: new Uint8Array([1, 2, 3]),
            },
            createMockEnv()
        );
        expect(res.status).toBe(400);
        const json = (await res.json()) as { message: string };
        expect(json.message).toBe('Image must be at most 5 MB');
        expect(reached).toBe(false);
    });

    it('rejects an oversized streamed upload without Content-Length before the route runs', async () => {
        let reached = false;
        const app = buildApp(() => {
            reached = true;
        });
        const big = new Uint8Array(MAX_PREVIEW_IMAGE_BYTES + 16);
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(big);
                controller.close();
            },
        });
        const res = await app.request(
            '/api/v1/presets/abc/preview-image',
            // @ts-expect-error duplex is required by undici for streaming bodies
            { method: 'POST', body, duplex: 'half' },
            createMockEnv()
        );
        expect(res.status).toBe(400);
        expect(reached).toBe(false);
    });

    it('lets an in-limit upload through to the route', async () => {
        let reached = false;
        const app = buildApp(() => {
            reached = true;
        });
        const res = await app.request(
            '/api/v1/presets/abc/preview-image',
            { method: 'POST', body: new Uint8Array(1024), headers: { 'Content-Type': 'image/png' } },
            createMockEnv()
        );
        expect(res.status).toBe(200);
        expect(reached).toBe(true);
    });
});

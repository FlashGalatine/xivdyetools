import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createMockKV } from '@xivdyetools/test-utils';
import { errorResponse, ErrorCode } from '../src/utils/api-response.js';

describe('test module resolution', () => {
  it('loads dependency JavaScript and relative TypeScript .js imports together', async () => {
    // The relative import above resolves to api-response.ts; dependencies keep
    // their actual .js filenames. A global .js-stripping alias breaks the latter.
    const kv = createMockKV();
    await kv.put('message', 'Resolution boundary reached');
    const app = new Hono();
    app.get('/loader', async (context) =>
      errorResponse(context, ErrorCode.NOT_FOUND, (await kv.get('message')) ?? 'Missing fixture', 404)
    );

    const response = await app.request('/loader');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      success: false,
      error: 'NOT_FOUND',
      message: 'Resolution boundary reached',
    });
  });
});

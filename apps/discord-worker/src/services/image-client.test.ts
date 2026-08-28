import { describe, it, expect, vi } from 'vitest';
import { extractImagePixels } from './image-client.js';
import type { Env } from '../types/env.js';

function envWith(fetchImpl: (req: Request) => Promise<Response>): Env {
  return { IMAGE_WORKER: { fetch: vi.fn(fetchImpl) } } as unknown as Env;
}

describe('extractImagePixels', () => {
  it('returns pixels and dimensions from the binding', async () => {
    const env = envWith(async () =>
      new Response(new Uint8Array([1, 2, 3, 255]), {
        status: 200,
        headers: { 'X-Image-Width': '2', 'X-Image-Height': '3' },
      })
    );

    const result = await extractImagePixels(env, 'https://cdn.discordapp.com/x.png');

    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(result.pixels).toEqual(new Uint8Array([1, 2, 3, 255]));
  });

  it('rethrows the server error message verbatim', async () => {
    const env = envWith(async () =>
      new Response(JSON.stringify({ error: 'Image too large: 12MB exceeds 10MB limit' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      extractImagePixels(env, 'https://cdn.discordapp.com/x.png')
    ).rejects.toThrow('Image too large: 12MB exceeds 10MB limit');
  });

  it('throws when the binding is missing', async () => {
    await expect(
      extractImagePixels({} as Env, 'https://cdn.discordapp.com/x.png')
    ).rejects.toThrow('IMAGE_WORKER binding is not configured');
  });

  it('sends the url and maxDimension in the request body', async () => {
    let seen: unknown;
    const env = envWith(async (req) => {
      seen = await req.json();
      return new Response(new Uint8Array([0, 0, 0, 255]), {
        status: 200,
        headers: { 'X-Image-Width': '1', 'X-Image-Height': '1' },
      });
    });

    await extractImagePixels(env, 'https://cdn.discordapp.com/x.png', { maxDimension: 64 });

    expect(seen).toEqual({ url: 'https://cdn.discordapp.com/x.png', maxDimension: 64 });
  });
});

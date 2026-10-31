import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  extractImagePixels,
  IMAGE_WORKER_BUSY_RETRY_DELAY_MS,
  IMAGE_WORKER_TIMEOUT_MS,
} from './image-client.js';
import { imageInputReason } from './image-input-errors.js';
import type { Env } from '../types/env.js';

function envWith(fetchImpl: (req: Request) => Promise<Response>): Env {
  return { IMAGE_WORKER: { fetch: vi.fn(fetchImpl) } } as unknown as Env;
}

function fetchMock(env: Env) {
  return env.IMAGE_WORKER!.fetch as ReturnType<typeof vi.fn>;
}

function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const busy = () => errorResponse(503, 'Image processing unavailable');

function pixelsResponse(): Response {
  return new Response(new Uint8Array([4, 5, 6, 255]), {
    status: 200,
    headers: { 'X-Image-Width': '1', 'X-Image-Height': '1' },
  });
}

/** Settle a call that may wait out the busy-retry delay under fake timers. */
async function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  );
  await vi.advanceTimersByTimeAsync(IMAGE_WORKER_BUSY_RETRY_DELAY_MS);
  return outcome;
}

describe('extractImagePixels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

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

  it('preserves admission unavailability without classifying it as an invalid image', async () => {
    vi.useFakeTimers();
    const env = envWith(async () => busy());
    const { error: failure } = await settle(
      extractImagePixels(env, 'https://cdn.discordapp.com/x.png')
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Image processing unavailable');
    expect(imageInputReason(failure)).toBeNull();
  });

  it('retries once after a busy 503 and returns the second reply', async () => {
    vi.useFakeTimers();
    const replies = [busy(), pixelsResponse()];
    const env = envWith(async () => replies.shift()!);
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    const pending = extractImagePixels(env, 'https://cdn.discordapp.com/x.png');
    await vi.advanceTimersByTimeAsync(IMAGE_WORKER_BUSY_RETRY_DELAY_MS - 1);
    expect(fetchMock(env)).toHaveBeenCalledTimes(1);
    const { value, error } = await settle(pending);

    expect(error).toBeUndefined();
    expect(value?.pixels).toEqual(new Uint8Array([4, 5, 6, 255]));
    expect(fetchMock(env)).toHaveBeenCalledTimes(2);
    // Both attempts share one deadline: the retry never extends the round-trip bound.
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(IMAGE_WORKER_TIMEOUT_MS);
    const second = fetchMock(env).mock.calls[1]![0] as Request;
    expect(await second.json()).toEqual({ url: 'https://cdn.discordapp.com/x.png' });
  });

  it('rethrows a second busy 503 verbatim without a third attempt', async () => {
    vi.useFakeTimers();
    const env = envWith(async () => busy());

    const { error: failure } = await settle(
      extractImagePixels(env, 'https://cdn.discordapp.com/x.png')
    );
    await vi.advanceTimersByTimeAsync(IMAGE_WORKER_BUSY_RETRY_DELAY_MS * 4);

    expect((failure as Error).message).toBe('Image processing unavailable');
    expect(imageInputReason(failure)).toBeNull();
    expect(fetchMock(env)).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a 503 with another error', () => errorResponse(503, 'Service restarting')],
    ['a 500', () => errorResponse(500, 'Image processing unavailable')],
    ['a 503 without a JSON body', () => new Response('busy', { status: 503 })],
  ])('does not retry %s', async (_label, reply) => {
    vi.useFakeTimers();
    const env = envWith(async () => reply());

    const { error: failure } = await settle(
      extractImagePixels(env, 'https://cdn.discordapp.com/x.png')
    );

    expect(failure).toBeInstanceOf(Error);
    expect(fetchMock(env)).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the shared deadline passes during the busy pause', async () => {
    vi.useFakeTimers();
    const env = envWith(async () => busy());
    const abort = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(abort.signal);

    const pending = extractImagePixels(env, 'https://cdn.discordapp.com/x.png');
    await vi.advanceTimersByTimeAsync(0);
    abort.abort(new DOMException('deadline', 'TimeoutError'));
    const { error: failure } = await settle(pending);
    expect(timeout).toHaveBeenCalledTimes(1);

    expect((failure as Error).name).toBe('TimeoutError');
    expect(fetchMock(env)).toHaveBeenCalledTimes(1);
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

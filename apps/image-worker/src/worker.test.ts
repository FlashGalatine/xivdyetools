import { describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import app from './index.js';

vi.mock('./index.js', () => ({ default: { fetch: vi.fn() } }));

describe('image-worker execution lifetime', () => {
  it('registers the complete pending dispatch before returning it to the caller', async () => {
    let complete!: (response: Response) => void;
    const dispatch = new Promise<Response>(resolve => { complete = resolve; });
    vi.mocked(app.fetch).mockReturnValueOnce(dispatch);
    const waitUntil = vi.fn();
    const context = { waitUntil } as unknown as ExecutionContext;
    const request = new Request('https://image-worker/health');
    const result = worker.fetch(request, {}, context);
    expect(result).toBe(dispatch);
    expect(app.fetch).toHaveBeenLastCalledWith(request, {}, context);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    let backgroundFinished = false;
    const background = waitUntil.mock.calls[0][0] as Promise<unknown>;
    void background.then(() => { backgroundFinished = true; });
    await Promise.resolve();
    expect(backgroundFinished).toBe(false);
    const response = new Response('done');
    complete(response);
    expect(await result).toBe(response);
    await background;
    expect(backgroundFinished).toBe(true);
  });

  it('preserves a dispatch failure for the caller while handling the background rejection', async () => {
    const failure = new Error('dispatch failed');
    const dispatch = Promise.reject(failure);
    vi.mocked(app.fetch).mockReturnValueOnce(dispatch);
    const waitUntil = vi.fn();
    const result = worker.fetch(new Request('https://image-worker/thumbnail', { method: 'POST' }), {}, { waitUntil } as unknown as ExecutionContext);
    await expect(result).rejects.toBe(failure);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});

import type { MiddlewareHandler } from 'hono';
import type { Env } from './types.js';

export const IMAGE_UNAVAILABLE_ERROR = 'Image processing unavailable';

/** Abandon unused bytes without draining or waiting on an uncooperative source. */
export function cancelWithoutWaiting(
  source: { cancel(reason?: unknown): Promise<unknown> } | null,
  reason?: unknown
): void {
  try {
    void source?.cancel(reason).catch(() => undefined);
  } catch {
    // A locked body or a non-standard source can throw synchronously too.
  }
}

// Shared by both routes in this isolate. There is deliberately no waiting queue.
let active = false;

export const imageAdmission: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (active || c.req.raw.signal.aborted) {
    cancelWithoutWaiting(c.req.raw.body);
    return c.json({ error: IMAGE_UNAVAILABLE_ERROR }, 503);
  }
  active = true;
  try {
    // Await actual work: aborting a caller does not prove its work has stopped.
    await next();
  } finally {
    active = false;
  }
};

import app from './index.js';
import type { Env } from './types.js';

/** Keep admission cleanup alive when a service-binding caller disconnects. */
export default {
  fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const work = Promise.resolve(app.fetch(request, env, context));
    // Protect the whole dispatch, including the admission middleware's finally.
    // The caller still receives the original result/error. This is bounded by
    // the platform's waitUntil lifetime, not an unconditional cleanup guarantee.
    context.waitUntil(work.catch(() => undefined));
    return work;
  },
};

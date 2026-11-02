import { WorkerEntrypoint } from 'cloudflare:workers';
import app, { fetchPresetNotification } from './index.js';
import type { Env } from './types/env.js';

/** Private Fetcher protocol for presets-api notifications; bearer authentication remains required. */
export class PresetNotifications extends WorkerEntrypoint<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (
      request.method !== 'POST' ||
      new URL(request.url).pathname !== '/webhooks/preset-submission'
    ) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return fetchPresetNotification(request, this.env, this.ctx);
  }
}

// The public Worker keeps the existing Hono app and interaction/GitHub routes.
export default app;

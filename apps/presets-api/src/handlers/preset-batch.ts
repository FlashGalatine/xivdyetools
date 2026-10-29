import { Hono } from 'hono';
import type { AuthContext, Env } from '../types.js';
import { getApprovedPresetBatch } from '../services/preset-batch-service.js';
import { readJsonObject } from '../utils/request-body.js';
import { unauthorizedResponse, validationErrorResponse } from '../utils/api-response.js';

export const presetBatchRouter = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// A logical read: mount before presetsRouter's mutation-ban middleware.
presetBatchRouter.post('/batch', async (c) => {
  const auth = c.get('auth');
  // With a configured signing secret, authMiddleware only authenticates bot
  // context after v2 signature and nonce verification, including in development.
  if (
    !c.env.BOT_SIGNING_SECRET ||
    !auth.isAuthenticated ||
    auth.authSource !== 'bot' ||
    !auth.userDiscordId
  ) {
    return unauthorizedResponse(c, 'Signed bot authentication with user context required');
  }
  const body = await readJsonObject<{ ids?: unknown }>(c);
  if (
    !body ||
    Object.keys(body).length !== 1 ||
    !Array.isArray(body.ids) ||
    body.ids.length === 0 ||
    body.ids.length > 50 ||
    body.ids.some((id: unknown) => typeof id !== 'string' || id.length === 0 || id.length > 128)
  ) {
    return validationErrorResponse(
      c,
      'Body must contain only ids: an array of 1 to 50 nonempty strings, each at most 128 characters',
    );
  }
  const batch = await getApprovedPresetBatch(c.env.DB, body.ids as string[]);
  return c.json({ success: true, ...batch });
});

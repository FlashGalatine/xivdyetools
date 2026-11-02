import type { Env } from '../../src/types/env.js';
import { resolveIdentities } from '../../src/services/identity-lookup.js';
import {
  createBanReview,
  applyBanReview,
  reviewMessage,
} from '../../src/services/ban-confirmation-service.js';
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const input = (await request.json()) as {
      ids: string[];
      actorId: string;
      nonce: string;
      action: 'ban' | 'unban';
      reason: string;
    };
    const path = new URL(request.url).pathname;
    try {
      if (path === '/lookup') return Response.json(await resolveIdentities(env, input.ids));
      if (path === '/inactive')
        return Response.json(
          await resolveIdentities({ ...env, LINKED_BAN_CONFIRMATION_ENABLED: 'false' }, input.ids),
        );
      if (path === '/review') {
        const review = await createBanReview(env, input.actorId, input.action, input.ids);
        return Response.json({ review, message: reviewMessage(review) });
      }
      if (path === '/apply')
        return Response.json(
          await applyBanReview(env, input.nonce, input.actorId, input.action, input.reason),
        );
      return new Response(null, { status: 404 });
    } catch {
      return Response.json({ error: 'unavailable' }, { status: 503 });
    }
  },
};

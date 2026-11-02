import type { OAuthIdentityBinding, OAuthSessionRequest } from '../../src/types.js';
interface ContinuityBinding {
  apply(input: unknown): Promise<unknown>;
  getOperation(input: unknown): Promise<unknown>;
  acknowledge(input: unknown): Promise<unknown>;
}
export default {
  async fetch(
    request: Request,
    env: { CONTINUITY: ContinuityBinding; OAUTH_IDENTITY: OAuthIdentityBinding },
  ) {
    const input: unknown = await request.json();
    const path = new URL(request.url).pathname;
    let result: unknown;
    if (path === '/apply') result = await env.CONTINUITY.apply(input);
    else if (path === '/get') result = await env.CONTINUITY.getOperation(input);
    else if (path === '/ack') result = await env.CONTINUITY.acknowledge(input);
    else if (path === '/session')
      result = await env.OAUTH_IDENTITY.validateSession(input as OAuthSessionRequest);
    else return new Response(null, { status: 404 });
    return Response.json(result);
  },
};

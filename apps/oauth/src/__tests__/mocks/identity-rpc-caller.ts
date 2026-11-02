import type {
  LookupResult,
  SessionResult,
  BanContinuity,
} from '../../services/identity-contract.js';
interface Env {
  IDENTITY: {
    lookupStoredIdentity(input: unknown): Promise<LookupResult>;
    validateSession(input: unknown): Promise<SessionResult>;
  };
  CONTINUITY: BanContinuity;
}
/** Local test caller exercises a real named-entrypoint service binding. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const input: unknown = await request.json();
    try {
      const result =
        new URL(request.url).pathname === '/lookup'
          ? await env.IDENTITY.lookupStoredIdentity(input)
          : new URL(request.url).pathname === '/session'
            ? await env.IDENTITY.validateSession(input)
            : await env.CONTINUITY.apply(input as Parameters<BanContinuity['apply']>[0]);
      return Response.json(result);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'RPC failed' },
        { status: 503 },
      );
    }
  },
};

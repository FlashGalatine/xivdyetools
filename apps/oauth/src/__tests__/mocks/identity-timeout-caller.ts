import { findOrCreateUser } from '../../services/user-service.js';
import { createJWTForUser } from '../../services/jwt-service.js';
import { IdentityError } from '../../services/identity-contract.js';
import type { Env } from '../../types.js';
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const params = (await request.json()) as Parameters<typeof findOrCreateUser>[1];
      const user = await findOrCreateUser(env.DB, params, undefined, env);
      const session = await createJWTForUser(user, env);
      await env.DB.prepare('INSERT INTO test_mints (user_id) VALUES (?)').bind(user.id).run();
      return Response.json({ user, token: session.token });
    } catch (error) {
      return Response.json(
        { error: error instanceof IdentityError ? error.code : 'unexpected' },
        { status: 503 },
      );
    }
  },
};

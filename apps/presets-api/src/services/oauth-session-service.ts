import type { Env, OAuthSessionRequest } from '../types.js';

/** Caller deadline only: a late RPC result cannot grant request authority. */
const SESSION_TIMEOUT_MS = 2000;
type SessionDecision = 'valid' | 'stale' | 'unavailable';
interface SessionClaims {
  sub: string;
  auth_provider?: unknown;
  identity_revision?: unknown;
  discord_id?: unknown;
}

/** Private, minimal OAuth RPC; membership data never supplies session authority. */
export async function checkOAuthSession(env: Env, claims: SessionClaims): Promise<SessionDecision> {
  if (env.OAUTH_SESSION_CHECK_ENABLED !== 'true') return 'valid';

  if (
    !claims.sub ||
    (claims.auth_provider !== 'discord' && claims.auth_provider !== 'xivauth') ||
    (claims.identity_revision !== undefined &&
      (!Number.isSafeInteger(claims.identity_revision) ||
        (claims.identity_revision as number) < 0)) ||
    (claims.discord_id !== undefined &&
      claims.discord_id !== null &&
      (typeof claims.discord_id !== 'string' || claims.discord_id.length === 0))
  )
    return 'stale';

  const request: OAuthSessionRequest = {
    sub: claims.sub,
    authProvider: claims.auth_provider,
    // Preserve absent legacy revision: only OAuth can decide whether current revision is zero.
    ...(claims.identity_revision !== undefined
      ? { identityRevision: claims.identity_revision as number }
      : {}),
    ...(claims.discord_id !== undefined ? { discordId: claims.discord_id } : {}),
  };
  let timer: number | undefined;
  try {
    const binding = env.OAUTH_IDENTITY;
    if (!binding || typeof binding.validateSession !== 'function') return 'unavailable';
    const result: unknown = await Promise.race([
      Promise.resolve().then(() => binding.validateSession(request)),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(resolve, SESSION_TIMEOUT_MS);
      }),
    ]);
    if (
      typeof result !== 'object' ||
      result === null ||
      Array.isArray(result) ||
      Object.keys(result).length !== 2 ||
      Object.keys(result).some((key) => key !== 'version' && key !== 'status') ||
      !('version' in result) ||
      result.version !== 1 ||
      !('status' in result)
    )
      return 'unavailable';
    if (result.status === 'valid') return 'valid';
    if (result.status === 'stale' || result.status === 'missing') return 'stale';
    return 'unavailable';
  } catch {
    // RPC errors may carry identifiers or provider internals; do not log or expose them.
    return 'unavailable';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * OAuth Security Constants
 * Shared constants for OAuth flow validation and security
 */

/**
 * Allowed redirect URI origins
 * These origins are permitted as OAuth callback destinations
 */
export const ALLOWED_REDIRECT_ORIGINS = [
  'https://xivdyetools.app',
  // Beta web app — a separate Cloudflare Pages project (xivdyetools-beta)
  // serving non-main branches. It uses this production OAuth worker on
  // purpose, so testers log in with their real accounts.
  // See docs/superpowers/specs/2026-08-09-beta-web-app-deployment-design.md
  'https://beta.xivdyetools.app',
  'https://xivdyetools.projectgalatine.com', // Transition period - remove after migration complete
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

/**
 * FINDING-012 / OAUTH-4 (2026-08-21 security audit): the only path on an
 * allowlisted origin that may receive the `?code=` bounce. Every frontend
 * (xivdyetools.app, beta, the transition domain, the localhost dev servers)
 * mounts its callback route here. Origin-only matching let an attacker-chosen
 * path on a trusted origin receive the authorization code; RFC 8252 §8.4 /
 * OAuth 2.1 want an exact redirect-URI match.
 */
export const REDIRECT_CALLBACK_PATH = '/auth/callback';

/**
 * BUG-018 (2026-07-18 audit): the single redirect-URI allowlist used by every
 * authorize handler AND every GET callback. Three divergent inline lists
 * previously let a login start on the transition domain and then bounce at
 * the callback. Localhost entries are only honored in development.
 */
export function getAllowedRedirectOrigins(env: {
  FRONTEND_URL: string;
  ENVIRONMENT: string;
}): string[] {
  const origins = [...ALLOWED_REDIRECT_ORIGINS, env.FRONTEND_URL];
  return env.ENVIRONMENT === 'development'
    ? origins
    : origins.filter((o) => !o.includes('localhost') && !o.includes('127.0.0.1'));
}

/**
 * State parameter expiration time (seconds)
 * OAuth state tokens expire after this duration
 */
export const STATE_EXPIRY_SECONDS = 600; // 10 minutes

/**
 * Request timeout for external API calls (milliseconds)
 */
export const REQUEST_TIMEOUT_MS = 10000; // 10 seconds

/**
 * User info fetch timeout (milliseconds)
 * Shorter timeout for user info endpoints
 */
export const USER_INFO_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Required OAuth scopes for XIVAuth provider
 * Must be present in token response
 */
export const XIVAUTH_REQUIRED_SCOPES = ['user', 'character'];

/**
 * Required OAuth scopes for Discord provider
 * Must be present in token response
 */
export const DISCORD_REQUIRED_SCOPES = ['identify'];

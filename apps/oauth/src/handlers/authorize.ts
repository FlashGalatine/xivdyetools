/**
 * Authorization Handler
 * Redirects users to Discord OAuth with PKCE parameters
 *
 * REFACTOR-008 (2026-07-18 audit): the flow pipeline lives in oauth-flow.ts,
 * shared with the XIVAuth provider; this file is just the Discord config.
 */

import { Hono } from 'hono';
import type { Env } from '../types.js';
import { buildAuthorizeHandler, type OAuthFlowConfig } from './oauth-flow.js';

export const DISCORD_FLOW_CONFIG: OAuthFlowConfig = {
  provider: 'discord',
  authUrl: 'https://discord.com/oauth2/authorize',
  scopes: 'identify',
  clientId: (env) => env.DISCORD_CLIENT_ID,
  workerCallbackPath: '/auth/callback',
  markProviderOnRedirect: false,
};

export const authorizeRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /auth/discord
 * Initiates the OAuth flow by redirecting to Discord.
 * See buildAuthorizeHandler for the pipeline (PKCE validation, redirect-URI
 * allowlisting, state signing).
 */
authorizeRouter.get('/discord', buildAuthorizeHandler(DISCORD_FLOW_CONFIG));

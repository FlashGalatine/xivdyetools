import type { RateLimitBinding } from '@xivdyetools/worker-kit/rate-limiter';

/**
 * Environment bindings for Cloudflare Worker
 *
 * Secrets are set via: wrangler secret put <NAME>
 * Variables are set in wrangler.toml [vars]
 * Bindings (KV, service bindings) are configured in wrangler.toml
 */
export interface Env {
  // =========================================================================
  // Secrets (set via wrangler secret put)
  // =========================================================================

  /** Discord Bot Token - for sending follow-up messages */
  DISCORD_TOKEN: string;

  /** Discord Application Public Key - for verifying interaction signatures */
  DISCORD_PUBLIC_KEY: string;

  /** Shared secret for authenticating with the Presets API */
  BOT_API_SECRET?: string;

  /** HMAC signing key for bot request verification */
  BOT_SIGNING_SECRET?: string;

  /** Shared secret for incoming webhook notifications */
  INTERNAL_WEBHOOK_SECRET?: string;

  /** HMAC secret for verifying GitHub webhook signatures */
  GITHUB_WEBHOOK_SECRET?: string;

  /** Discord channel ID for changelog announcements */
  ANNOUNCEMENT_CHANNEL_ID?: string;

  // =========================================================================
  // Moderation Configuration (set via wrangler secret put)
  // =========================================================================

  /** Comma-separated Discord user IDs who can moderate presets */
  MODERATOR_IDS?: string;

  /** Discord channel ID for moderation queue (pending presets) */
  MODERATION_CHANNEL_ID?: string;
  /**
   * BUG-009 (2026-07-18 audit): bot token of the MODERATION Discord
   * application. When set, moderation-channel embeds are posted with this
   * token so their approve/reject buttons route to moderation-worker (the
   * application that owns the button handlers). When unset, embeds are
   * posted without buttons plus a "/preset moderate" hint.
   */
  MODERATION_BOT_TOKEN?: string;

  /** Discord channel ID for submission logs (all presets) */
  SUBMISSION_LOG_CHANNEL_ID?: string;

  // =========================================================================
  // Variables (from wrangler.toml [vars])
  // =========================================================================

  /** Discord Application ID */
  DISCORD_CLIENT_ID: string;

  /** URL of the Presets API worker */
  PRESETS_API_URL: string;

  // =========================================================================
  // Bindings (configured in wrangler.toml)
  // =========================================================================

  /** KV Namespace for analytics, user preferences, favorites, and collections */
  KV: KVNamespace;

  /** Service Binding to Presets API Worker (for Worker-to-Worker communication) */
  PRESETS_API?: Fetcher;

  /** Service Binding to Universalis Proxy Worker (for market board prices) */
  UNIVERSALIS_PROXY?: Fetcher;

  /** Service binding → xivdyetools-image-worker (photon pixel extraction). */
  IMAGE_WORKER?: Fetcher;

  /** Fallback URL for Universalis Proxy (for local development) */
  UNIVERSALIS_PROXY_URL?: string;

  /** Analytics Engine for command usage tracking */
  ANALYTICS?: AnalyticsEngineDataset;

  // =========================================================================
  // Rate limiting (FINDING-007 — native `[[ratelimits]]` bindings; the
  // per-user counters used to live in a third-party Redis). One binding per
  // distinct effective limit in worker-kit's DISCORD_COMMAND_LIMITS; all
  // optional so tests and local dev fall back to KV.
  // =========================================================================

  /** 5 req/min — `/extractor image` (the Photon path) */
  RL_5?: RateLimitBinding;

  /** 10 req/min — `/accessibility`, `/budget`, `/preset` */
  RL_10?: RateLimitBinding;

  /** 15 req/min — the rendering commands and the default tier */
  RL_15?: RateLimitBinding;

  /** 20 req/min — `/dye`, `/preferences` */
  RL_20?: RateLimitBinding;

  /** 30 req/min — `/about`, `/manual`, `/changelog` */
  RL_30?: RateLimitBinding;

  /** 70 req/min — autocomplete (60 + 10 burst) */
  RL_70?: RateLimitBinding;

  // =========================================================================
  // Stats Command Access Control
  // =========================================================================

  /** Comma-separated Discord user IDs who can view /stats */
  STATS_AUTHORIZED_USERS?: string;
}

/**
 * Discord Interaction type (simplified)
 * Consolidated to avoid duplicate definitions across command handlers
 * Full types would come from a Discord types package
 */
export interface DiscordInteraction {
  id: string;
  type?: number; // Interaction type (1=PING, 2=APPLICATION_COMMAND, etc.) - optional for handler tests
  application_id: string;
  token: string;
  locale?: string; // User's locale (e.g., "en-US", "ja")
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: {
      id: string;
      username?: string;
      discriminator?: string;
      avatar?: string;
      global_name?: string;
    };
  };
  user?: {
    id: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
    global_name?: string;
  };
  data?: {
    id?: string;
    name?: string;
    type?: number;
    custom_id?: string; // For button/modal interactions
    component_type?: number; // For message component interactions
    options?: Array<{
      name: string;
      type?: number;
      value?: string | number | boolean;
      focused?: boolean;
      options?: Array<{
        name: string;
        type?: number;
        value?: string | number | boolean;
        focused?: boolean;
        options?: Array<{
          name: string;
          type?: number;
          value?: string | number | boolean;
          focused?: boolean;
        }>;
      }>;
    }>;
    components?: Array<{
      type: number;
      components?: Array<{
        type: number;
        custom_id?: string;
        value?: string;
      }>;
    }>;
    resolved?: {
      attachments?: Record<
        string,
        {
          id: string;
          filename: string;
          size: number;
          url: string;
          proxy_url: string;
          content_type?: string;
          width?: number;
          height?: number;
        }
      >;
    };
  };
}

/**
 * Discord Interaction Types
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding
 */
export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

/**
 * Discord Interaction Response Types
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type
 */
export enum InteractionResponseType {
  /** ACK a Ping */
  PONG = 1,
  /** Respond to an interaction with a message */
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  /** ACK an interaction and edit a response later, the user sees a loading state */
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  /** For components, ACK an interaction and edit the original message later */
  DEFERRED_UPDATE_MESSAGE = 6,
  /** Respond to an autocomplete interaction with suggested choices */
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
}

/**
 * Discord Interaction Response Body
 * Used for typing response.json() in tests
 */
export interface InteractionResponseBody {
  type: InteractionResponseType;
  data?: {
    content?: string;
    flags?: number;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      image?: { url: string };
      footer?: { text: string };
      timestamp?: string;
    }>;
    components?: Array<{
      type: number;
      components?: Array<{
        type: number;
        style?: number;
        label?: string;
        custom_id?: string;
        url?: string;
        emoji?: { name: string };
        placeholder?: string;
        min_length?: number;
        max_length?: number;
        required?: boolean;
        value?: string;
      }>;
    }>;
    choices?: Array<{ name: string; value: string }>;
    custom_id?: string;
    title?: string;
  };
}

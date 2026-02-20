/**
 * Configuration loaded from environment variables.
 */
export interface BotConfig {
  /** Stoat/Revolt bot token */
  botToken: string;
  /** Admin user IDs (Stoat ULIDs) authorized for admin/stats commands */
  authorizedUsers: string[];
  /** Upstash Redis REST URL for rate limiting */
  upstashRedisUrl?: string;
  /** Upstash Redis REST token */
  upstashRedisToken?: string;
}

/** Stoat ULIDs use Crockford's Base32 — no I, L, O, U */
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Validate that a string is a valid Stoat ULID.
 */
export function isValidUlid(id: string): boolean {
  return ULID_PATTERN.test(id);
}

/**
 * Load and validate bot configuration from environment variables.
 */
export function loadConfig(): BotConfig {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    throw new Error('BOT_TOKEN environment variable is required');
  }

  const authorizedUsers = (process.env.STATS_AUTHORIZED_USERS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  // Validate ULIDs at startup
  for (const id of authorizedUsers) {
    if (!isValidUlid(id)) {
      throw new Error(`Invalid Stoat ULID in STATS_AUTHORIZED_USERS: "${id}"`);
    }
  }

  return {
    botToken,
    authorizedUsers,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}

/**
 * Check if a user is authorized for admin commands.
 */
export function isAuthorized(config: BotConfig, userId: string): boolean {
  return config.authorizedUsers.includes(userId);
}

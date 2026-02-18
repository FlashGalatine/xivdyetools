/**
 * Crawler Detection Module
 *
 * Detects social media crawlers by analyzing the User-Agent header.
 * When crawlers request a page, we return custom HTML with OG meta tags
 * instead of letting them see the SPA's empty shell.
 *
 * @module crawler-detector
 */

import type { CrawlerInfo, CrawlerType } from './types';

/**
 * User-Agent patterns for known social media crawlers.
 *
 * These bots fetch URLs to generate link previews. They don't execute
 * JavaScript, so they need pre-rendered HTML with <meta> tags.
 */
const CRAWLER_PATTERNS: Array<{ pattern: RegExp; type: CrawlerType }> = [
  // Discord - most common for gaming community
  { pattern: /Discordbot/i, type: 'discord' },

  // Twitter/X
  { pattern: /Twitterbot/i, type: 'twitter' },

  // Facebook (includes Instagram and WhatsApp's crawler)
  { pattern: /facebookexternalhit/i, type: 'facebook' },
  { pattern: /Facebot/i, type: 'facebook' },

  // LinkedIn
  { pattern: /LinkedInBot/i, type: 'linkedin' },

  // Slack
  { pattern: /Slackbot/i, type: 'slack' },

  // Telegram
  { pattern: /TelegramBot/i, type: 'telegram' },

  // WhatsApp (sometimes uses its own crawler, not Facebook's)
  { pattern: /WhatsApp/i, type: 'whatsapp' },

  // Generic Open Graph fetchers
  { pattern: /Open Graph/i, type: 'other' },
  { pattern: /MetaInspector/i, type: 'other' },

  // Apple iMessage preview
  { pattern: /Applebot/i, type: 'other' },

  // Google (for rich results, not just search indexing)
  // Note: We might want to let Googlebot through to the SPA for SEO
  // { pattern: /Googlebot/i, type: 'other' },
];

/**
 * Detect if a request is from a social media crawler.
 *
 * @param userAgent - The User-Agent header from the request
 * @returns CrawlerInfo with detection results
 *
 * @example
 * const info = detectCrawler('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)');
 * // { isCrawler: true, type: 'discord', userAgent: '...' }
 */
export function detectCrawler(userAgent: string | null): CrawlerInfo {
  if (!userAgent) {
    return {
      isCrawler: false,
      type: 'none',
      userAgent: '',
    };
  }

  for (const { pattern, type } of CRAWLER_PATTERNS) {
    if (pattern.test(userAgent)) {
      return {
        isCrawler: true,
        type,
        userAgent,
      };
    }
  }

  return {
    isCrawler: false,
    type: 'none',
    userAgent,
  };
}

/**
 * Check if a specific request should receive OG metadata.
 *
 * This is a convenience wrapper that extracts the User-Agent
 * from a Request object.
 *
 * @param request - The incoming Request
 * @returns CrawlerInfo with detection results
 */
export function detectCrawlerFromRequest(request: Request): CrawlerInfo {
  const userAgent = request.headers.get('user-agent');
  return detectCrawler(userAgent);
}

/**
 * Get a human-readable name for a crawler type.
 *
 * @param type - The crawler type
 * @returns Human-readable name
 */
export function getCrawlerName(type: CrawlerType): string {
  const names: Record<CrawlerType, string> = {
    discord: 'Discord',
    twitter: 'Twitter/X',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    slack: 'Slack',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    other: 'Other',
    none: 'Browser',
  };

  return names[type];
}

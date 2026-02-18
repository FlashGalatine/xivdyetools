/**
 * Tests for Crawler Detection Module
 *
 * @module crawler-detector.test
 */

import { describe, it, expect } from 'vitest';
import { detectCrawler, detectCrawlerFromRequest, getCrawlerName } from './crawler-detector';
import type { CrawlerType } from './types';

describe('crawler-detector', () => {
  describe('detectCrawler', () => {
    it('should return not a crawler for null user agent', () => {
      const result = detectCrawler(null);
      expect(result).toEqual({
        isCrawler: false,
        type: 'none',
        userAgent: '',
      });
    });

    it('should return not a crawler for empty string', () => {
      const result = detectCrawler('');
      expect(result).toEqual({
        isCrawler: false,
        type: 'none',
        userAgent: '',
      });
    });

    it('should return not a crawler for regular browser user agent', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      const result = detectCrawler(userAgent);
      expect(result).toEqual({
        isCrawler: false,
        type: 'none',
        userAgent,
      });
    });

    describe('Discord crawler detection', () => {
      it('should detect Discordbot', () => {
        const userAgent = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'discord',
          userAgent,
        });
      });

      it('should detect discordbot (lowercase)', () => {
        const userAgent = 'discordbot/2.0';
        const result = detectCrawler(userAgent);
        expect(result.isCrawler).toBe(true);
        expect(result.type).toBe('discord');
      });
    });

    describe('Twitter crawler detection', () => {
      it('should detect Twitterbot', () => {
        const userAgent = 'Twitterbot/1.0';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'twitter',
          userAgent,
        });
      });

      it('should detect twitterbot (case insensitive)', () => {
        const userAgent = 'TWITTERBOT/1.0';
        const result = detectCrawler(userAgent);
        expect(result.isCrawler).toBe(true);
        expect(result.type).toBe('twitter');
      });
    });

    describe('Facebook crawler detection', () => {
      it('should detect facebookexternalhit', () => {
        const userAgent = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'facebook',
          userAgent,
        });
      });

      it('should detect Facebot', () => {
        const userAgent = 'Facebot';
        const result = detectCrawler(userAgent);
        expect(result.isCrawler).toBe(true);
        expect(result.type).toBe('facebook');
      });
    });

    describe('LinkedIn crawler detection', () => {
      it('should detect LinkedInBot', () => {
        const userAgent = 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'linkedin',
          userAgent,
        });
      });
    });

    describe('Slack crawler detection', () => {
      it('should detect Slackbot', () => {
        const userAgent = 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'slack',
          userAgent,
        });
      });
    });

    describe('Telegram crawler detection', () => {
      it('should detect TelegramBot', () => {
        const userAgent = 'TelegramBot/1.0';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'telegram',
          userAgent,
        });
      });
    });

    describe('WhatsApp crawler detection', () => {
      it('should detect WhatsApp', () => {
        const userAgent = 'WhatsApp/2.19.244 Android/10';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'whatsapp',
          userAgent,
        });
      });
    });

    describe('Other crawler detection', () => {
      it('should detect Open Graph fetcher', () => {
        const userAgent = 'Open Graph Scraper';
        const result = detectCrawler(userAgent);
        expect(result).toEqual({
          isCrawler: true,
          type: 'other',
          userAgent,
        });
      });

      it('should detect MetaInspector', () => {
        const userAgent = 'MetaInspector/5.2.1 (+https://github.com/jaimeiniesta/metainspector)';
        const result = detectCrawler(userAgent);
        expect(result.isCrawler).toBe(true);
        expect(result.type).toBe('other');
      });

      it('should detect Applebot', () => {
        const userAgent = 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)';
        const result = detectCrawler(userAgent);
        expect(result.isCrawler).toBe(true);
        expect(result.type).toBe('other');
      });
    });

    it('should return the first matching crawler when multiple patterns match', () => {
      // Craft a user agent that could match multiple patterns
      // Discord is checked first, so it should win
      const userAgent = 'Discordbot WhatsApp';
      const result = detectCrawler(userAgent);
      expect(result.type).toBe('discord');
    });
  });

  describe('detectCrawlerFromRequest', () => {
    it('should extract user agent from request headers', () => {
      const request = new Request('https://example.com', {
        headers: {
          'user-agent': 'Discordbot/2.0',
        },
      });
      const result = detectCrawlerFromRequest(request);
      expect(result.isCrawler).toBe(true);
      expect(result.type).toBe('discord');
    });

    it('should handle missing user agent header', () => {
      const request = new Request('https://example.com');
      const result = detectCrawlerFromRequest(request);
      expect(result.isCrawler).toBe(false);
      expect(result.type).toBe('none');
    });
  });

  describe('getCrawlerName', () => {
    const testCases: Array<{ type: CrawlerType; expected: string }> = [
      { type: 'discord', expected: 'Discord' },
      { type: 'twitter', expected: 'Twitter/X' },
      { type: 'facebook', expected: 'Facebook' },
      { type: 'linkedin', expected: 'LinkedIn' },
      { type: 'slack', expected: 'Slack' },
      { type: 'telegram', expected: 'Telegram' },
      { type: 'whatsapp', expected: 'WhatsApp' },
      { type: 'other', expected: 'Other' },
      { type: 'none', expected: 'Browser' },
    ];

    testCases.forEach(({ type, expected }) => {
      it(`should return "${expected}" for type "${type}"`, () => {
        expect(getCrawlerName(type)).toBe(expected);
      });
    });
  });
});

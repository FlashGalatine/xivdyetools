/**
 * Tests for Error UX Standard
 */

import { describe, it, expect } from 'vitest';
import {
  createErrorEmbed,
  createErrorResponse,
  validationError,
  notFoundError,
  rateLimitError,
  externalError,
  internalError,
  permissionError,
  invalidHexError,
  invalidDyeError,
  invalidCountError,
  collectionNotFoundError,
  collectionLimitError,
  dyeAlreadyInCollectionError,
  presetNotFoundError,
  universalisError,
  renderError,
  adminOnlyError,
  guildOnlyError,
  ERROR_CODE_DESCRIPTIONS,
} from './error-response.js';
import { MessageFlags } from './response.js';

describe('Error Response Utilities', () => {
  describe('createErrorEmbed', () => {
    it('creates validation error with correct styling', () => {
      const embed = createErrorEmbed({
        category: 'validation',
        message: 'Invalid input',
      });

      expect(embed.title).toBe('❌ Invalid Input');
      expect(embed.description).toBe('Invalid input');
      expect(embed.color).toBe(0xed4245); // Red
    });

    it('creates notFound error with alternatives', () => {
      const embed = createErrorEmbed({
        category: 'notFound',
        message: 'Dye not found',
        alternatives: ['Snow White', 'Soot Black', 'Pure White'],
      });

      expect(embed.title).toBe('🔍 Not Found');
      expect(embed.color).toBe(0xf5a623); // Orange
      expect(embed.fields).toBeDefined();
      expect(embed.fields?.[0].name).toBe('Did you mean?');
      expect(embed.fields?.[0].value).toContain('Snow White');
    });

    it('creates rateLimit error with retry time', () => {
      const embed = createErrorEmbed({
        category: 'rateLimit',
        message: 'Too many requests',
        retryAfterSeconds: 30,
      });

      expect(embed.title).toBe('⏳ Slow Down');
      expect(embed.color).toBe(0xfee75c); // Yellow
      expect(embed.description).toContain('<t:'); // Discord timestamp
    });

    it('creates external error with correct styling', () => {
      const embed = createErrorEmbed({
        category: 'external',
        message: 'API unavailable',
      });

      expect(embed.title).toBe('🌐 Service Unavailable');
      expect(embed.color).toBe(0xf5a623); // Orange
    });

    it('creates internal error with correct styling', () => {
      const embed = createErrorEmbed({
        category: 'internal',
        message: 'Something broke',
      });

      expect(embed.title).toBe('⚠️ Something Went Wrong');
      expect(embed.color).toBe(0xed4245); // Red
    });

    it('creates permission error with correct styling', () => {
      const embed = createErrorEmbed({
        category: 'permission',
        message: 'Access denied',
      });

      expect(embed.title).toBe('🔒 Access Denied');
      expect(embed.color).toBe(0x99aab5); // Gray
    });

    it('includes details when provided', () => {
      const embed = createErrorEmbed({
        category: 'validation',
        message: 'Invalid input',
        details: 'Please check the format',
      });

      expect(embed.description).toContain('Please check the format');
    });

    it('includes suggestions as bullet points', () => {
      const embed = createErrorEmbed({
        category: 'validation',
        message: 'Invalid input',
        suggestions: ['Try option A', 'Try option B'],
      });

      expect(embed.description).toContain('**Suggestions:**');
      expect(embed.description).toContain('• Try option A');
      expect(embed.description).toContain('• Try option B');
    });

    it('includes error code in footer', () => {
      const embed = createErrorEmbed({
        category: 'validation',
        message: 'Test',
        code: 'ERR-V001',
      });

      expect(embed.footer?.text).toContain('ERR-V001');
    });

    it('includes custom footer text', () => {
      const embed = createErrorEmbed({
        category: 'validation',
        message: 'Test',
        footer: 'Use /help for more info',
      });

      expect(embed.footer?.text).toContain('Use /help for more info');
    });

    it('combines error code and footer text', () => {
      const embed = createErrorEmbed({
        category: 'validation',
        message: 'Test',
        code: 'ERR-V001',
        footer: 'Custom footer',
      });

      expect(embed.footer?.text).toBe('ERR-V001 • Custom footer');
    });

    it('limits alternatives to 5', () => {
      const embed = createErrorEmbed({
        category: 'notFound',
        message: 'Not found',
        alternatives: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      });

      const altText = embed.fields?.[0].value ?? '';
      expect(altText).toContain('`A`');
      expect(altText).toContain('`E`');
      expect(altText).not.toContain('`F`');
      expect(altText).not.toContain('`G`');
    });
  });

  describe('createErrorResponse', () => {
    it('creates ephemeral response by default', () => {
      const response = createErrorResponse({
        category: 'validation',
        message: 'Test',
      });

      expect(response.flags).toBe(MessageFlags.EPHEMERAL);
      expect(response.embeds).toHaveLength(1);
    });
  });

  describe('Convenience Functions', () => {
    describe('validationError', () => {
      it('creates validation error with message', () => {
        const response = validationError('Invalid color');

        expect(response.embeds?.[0].title).toBe('❌ Invalid Input');
        expect(response.embeds?.[0].description).toBe('Invalid color');
      });

      it('includes suggestions when provided', () => {
        const response = validationError('Error', ['Fix A', 'Fix B']);

        expect(response.embeds?.[0].description).toContain('• Fix A');
      });
    });

    describe('notFoundError', () => {
      it('creates not found error with alternatives', () => {
        const response = notFoundError('Dye', 'Snow Wite', ['Snow White']);

        expect(response.embeds?.[0].description).toContain('Dye `Snow Wite` was not found');
        expect(response.embeds?.[0].fields?.[0].value).toContain('Snow White');
      });
    });

    describe('rateLimitError', () => {
      it('creates rate limit error with retry time', () => {
        const response = rateLimitError(60);

        expect(response.embeds?.[0].title).toBe('⏳ Slow Down');
        expect(response.embeds?.[0].description).toContain('try again');
      });
    });

    describe('externalError', () => {
      it('creates external error with service name', () => {
        const response = externalError('Test API');

        expect(response.embeds?.[0].description).toContain('Unable to reach Test API');
      });
    });

    describe('internalError', () => {
      it('creates internal error without technical details', () => {
        const response = internalError();

        expect(response.embeds?.[0].description).toContain('unexpected error');
        expect(response.embeds?.[0].description).not.toContain('stack');
      });
    });

    describe('permissionError', () => {
      it('creates permission error with reason', () => {
        const response = permissionError('Admin only');

        expect(response.embeds?.[0].description).toBe('Admin only');
        expect(response.embeds?.[0].title).toBe('🔒 Access Denied');
      });
    });
  });

  describe('Specific Error Builders', () => {
    describe('invalidHexError', () => {
      it('creates hex format error with suggestions', () => {
        const response = invalidHexError('GG0000');

        expect(response.embeds?.[0].description).toContain('`GG0000`');
        expect(response.embeds?.[0].description).toContain('#RRGGBB');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-V002');
      });
    });

    describe('invalidDyeError', () => {
      it('creates dye error with alternatives', () => {
        const response = invalidDyeError('Snoo White', ['Snow White']);

        expect(response.embeds?.[0].description).toContain('`Snoo White`');
        expect(response.embeds?.[0].fields?.[0].value).toContain('Snow White');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-N002');
      });
    });

    describe('invalidCountError', () => {
      it('creates count error with range', () => {
        const response = invalidCountError(1, 10);

        expect(response.embeds?.[0].description).toContain('between 1 and 10');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-V003');
      });
    });

    describe('collectionNotFoundError', () => {
      it('creates collection not found error', () => {
        const response = collectionNotFoundError('My Colors');

        expect(response.embeds?.[0].description).toContain('`My Colors`');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-N003');
      });
    });

    describe('collectionLimitError', () => {
      it('creates limit error with max count', () => {
        const response = collectionLimitError(50);

        expect(response.embeds?.[0].description).toContain('maximum of 50');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-V004');
      });
    });

    describe('dyeAlreadyInCollectionError', () => {
      it('creates duplicate dye error', () => {
        const response = dyeAlreadyInCollectionError('Snow White', 'Favorites');

        expect(response.embeds?.[0].description).toContain('`Snow White`');
        expect(response.embeds?.[0].description).toContain('`Favorites`');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-V005');
      });
    });

    describe('presetNotFoundError', () => {
      it('creates preset not found error', () => {
        const response = presetNotFoundError('Summer Vibes');

        expect(response.embeds?.[0].description).toContain('`Summer Vibes`');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-N004');
      });
    });

    describe('universalisError', () => {
      it('creates Universalis API error', () => {
        const response = universalisError();

        expect(response.embeds?.[0].description).toContain('Universalis API');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-E002');
      });
    });

    describe('renderError', () => {
      it('creates render failure error', () => {
        const response = renderError();

        expect(response.embeds?.[0].description).toContain('generate the image');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-I002');
      });
    });

    describe('adminOnlyError', () => {
      it('creates admin-only error', () => {
        const response = adminOnlyError();

        expect(response.embeds?.[0].description).toContain('administrators');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-P002');
      });
    });

    describe('guildOnlyError', () => {
      it('creates guild-only error', () => {
        const response = guildOnlyError();

        expect(response.embeds?.[0].description).toContain('server');
        expect(response.embeds?.[0].description).toContain('not in DMs');
        expect(response.embeds?.[0].footer?.text).toContain('ERR-P003');
      });
    });
  });

  describe('ERROR_CODE_DESCRIPTIONS', () => {
    it('has descriptions for all used error codes', () => {
      // Validation errors
      expect(ERROR_CODE_DESCRIPTIONS['ERR-V001']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-V002']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-V003']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-V004']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-V005']).toBeDefined();

      // Not Found errors
      expect(ERROR_CODE_DESCRIPTIONS['ERR-N001']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-N002']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-N003']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-N004']).toBeDefined();

      // Rate Limit errors
      expect(ERROR_CODE_DESCRIPTIONS['ERR-R001']).toBeDefined();

      // External errors
      expect(ERROR_CODE_DESCRIPTIONS['ERR-E001']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-E002']).toBeDefined();

      // Internal errors
      expect(ERROR_CODE_DESCRIPTIONS['ERR-I001']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-I002']).toBeDefined();

      // Permission errors
      expect(ERROR_CODE_DESCRIPTIONS['ERR-P001']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-P002']).toBeDefined();
      expect(ERROR_CODE_DESCRIPTIONS['ERR-P003']).toBeDefined();
    });
  });
});

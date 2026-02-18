/**
 * Tests for OG Card Layout
 *
 * @module og-card.test
 */

import { describe, it, expect } from 'vitest';
import { generateOGCard, LAYOUT } from './og-card';
import { OG_DIMENSIONS } from './base';

describe('og-card', () => {
  describe('generateOGCard', () => {
    it('should generate valid SVG document', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '<rect/>',
      });

      expect(result).toContain('<svg');
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(result).toContain(`width="${OG_DIMENSIONS.width}"`);
      expect(result).toContain(`height="${OG_DIMENSIONS.height}"`);
      expect(result).toContain('</svg>');
    });

    it('should include gradient definitions', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      expect(result).toContain('<defs>');
      expect(result).toContain('linearGradient');
      expect(result).toContain('id="headerGradient"');
      expect(result).toContain('id="bgGradient"');
      expect(result).toContain('</defs>');
    });

    it('should include branding in header', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      expect(result).toContain('XIV DYE TOOLS');
    });

    it('should include tool name in header', () => {
      const result = generateOGCard({
        toolName: 'Harmony Explorer',
        content: '',
      });

      // Tool name should be uppercase
      expect(result).toContain('HARMONY EXPLORER');
    });

    it('should include subtitle when provided', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        subtitle: 'Test Subtitle',
        content: '',
      });

      expect(result).toContain('TEST SUBTITLE');
    });

    it('should not include subtitle when not provided', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      // Should only have the tool name, not extra text
      const matches = result.match(/text-anchor="end"/g);
      // Footer has text-anchor end, but subtitle would add another
      expect(matches?.length || 0).toBeLessThanOrEqual(1);
    });

    it('should include content in main area', () => {
      const customContent = '<rect id="custom-content" x="100" y="100"/>';
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: customContent,
      });

      expect(result).toContain('id="custom-content"');
    });

    it('should include footer with website URL', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      expect(result).toContain('xivdyetools.app');
    });

    it('should include custom footer text when provided', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
        footerText: 'Custom Footer',
      });

      expect(result).toContain('Custom Footer');
    });

    it('should include algorithm when provided', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
        algorithm: 'oklab',
      });

      expect(result).toContain('Algorithm: OKLAB');
    });

    it('should not include algorithm when not provided', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      expect(result).not.toContain('Algorithm:');
    });

    it('should create header bar with correct height', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      // Header bar should be 60px tall
      expect(result).toContain('height="60"');
    });

    it('should create footer bar', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      // Footer starts at height - 50
      const footerY = OG_DIMENSIONS.height - 50;
      expect(result).toContain(`y="${footerY}"`);
    });

    it('should include header divider line', () => {
      const result = generateOGCard({
        toolName: 'Test Tool',
        content: '',
      });

      // Divider at bottom of header (y=59 for 1px line at bottom of 60px header)
      expect(result).toContain('height="1"');
    });

    it('should uppercase tool name', () => {
      const result = generateOGCard({
        toolName: 'lowercase test',
        content: '',
      });

      expect(result).toContain('LOWERCASE TEST');
    });

    it('should uppercase subtitle', () => {
      const result = generateOGCard({
        toolName: 'Test',
        subtitle: 'lowercase subtitle',
        content: '',
      });

      expect(result).toContain('LOWERCASE SUBTITLE');
    });

    it('should uppercase algorithm', () => {
      const result = generateOGCard({
        toolName: 'Test',
        content: '',
        algorithm: 'ciede2000',
      });

      expect(result).toContain('CIEDE2000');
    });
  });

  describe('LAYOUT constants', () => {
    it('should have correct contentTop', () => {
      // Content starts below header (60px) + some padding
      expect(LAYOUT.contentTop).toBe(80);
    });

    it('should have correct contentBottom', () => {
      // Content ends above footer (630 - 50 - padding)
      expect(LAYOUT.contentBottom).toBe(560);
    });

    it('should have correct contentHeight', () => {
      // Should equal contentBottom - contentTop
      expect(LAYOUT.contentHeight).toBe(480);
    });

    it('should have correct padding', () => {
      expect(LAYOUT.padding).toBe(40);
    });

    it('should have correct contentWidth', () => {
      // Should equal width - padding * 2
      expect(LAYOUT.contentWidth).toBe(1120);
    });

    it('should have consistent values', () => {
      // Verify relationships between constants
      expect(LAYOUT.contentHeight).toBe(LAYOUT.contentBottom - LAYOUT.contentTop);
      expect(LAYOUT.contentWidth).toBe(OG_DIMENSIONS.width - LAYOUT.padding * 2);
    });
  });
});

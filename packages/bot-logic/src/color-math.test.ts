import { describe, it, expect } from 'vitest';
import { getColorDistance, getMatchQualityInfo } from './color-math.js';

describe('color-math', () => {
  describe('getColorDistance', () => {
    it('should return 0 for identical colors', () => {
      expect(getColorDistance('#FF0000', '#FF0000')).toBe(0);
    });

    it('should return correct distance for different colors', () => {
      // Distance between pure red and pure green: sqrt(255^2 + 255^2) ≈ 360.62
      const distance = getColorDistance('#FF0000', '#00FF00');
      expect(distance).toBeCloseTo(360.62, 0);
    });

    it('should return max distance for black and white', () => {
      // sqrt(255^2 + 255^2 + 255^2) ≈ 441.67
      const distance = getColorDistance('#000000', '#FFFFFF');
      expect(distance).toBeCloseTo(441.67, 0);
    });
  });

  describe('getMatchQualityInfo', () => {
    it('should return perfect for distance 0', () => {
      const result = getMatchQualityInfo(0);
      expect(result.key).toBe('perfect');
      expect(result.emoji).toBe('🎯');
    });

    it('should return excellent for distance < 10', () => {
      const result = getMatchQualityInfo(5);
      expect(result.key).toBe('excellent');
      expect(result.emoji).toBe('✨');
    });

    it('should return good for distance < 25', () => {
      const result = getMatchQualityInfo(15);
      expect(result.key).toBe('good');
      expect(result.emoji).toBe('👍');
    });

    it('should return fair for distance < 50', () => {
      const result = getMatchQualityInfo(35);
      expect(result.key).toBe('fair');
      expect(result.emoji).toBe('⚠️');
    });

    it('should return approximate for distance >= 50', () => {
      const result = getMatchQualityInfo(100);
      expect(result.key).toBe('approximate');
      expect(result.emoji).toBe('🔍');
    });

    it('should return correct tier at exact boundaries', () => {
      expect(getMatchQualityInfo(10).key).toBe('excellent');
      expect(getMatchQualityInfo(10.01).key).toBe('good');
      expect(getMatchQualityInfo(25).key).toBe('good');
      expect(getMatchQualityInfo(25.01).key).toBe('fair');
      expect(getMatchQualityInfo(50).key).toBe('fair');
      expect(getMatchQualityInfo(50.01).key).toBe('approximate');
    });
  });
});

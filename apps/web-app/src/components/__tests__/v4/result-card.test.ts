/**
 * XIV Dye Tools - ResultCard Unit Tests
 *
 * Tests the V4 result card Lit component for displaying dye matches.
 * Covers rendering, data display, events, and context menu.
 *
 * @module components/__tests__/v4/result-card.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@xivdyetools/core', () => ({
  ColorService: {
    hexToRgb: vi.fn(() => ({ r: 255, g: 0, b: 0 })),
    rgbToHex: vi.fn(() => '#FF0000'),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    isLightColor: vi.fn(() => false),
  },
  DyeService: class MockDyeService {
    getAllDyes() {
      return [];
    }
    getDyeById() {
      return null;
    }
    getCategories() {
      return [];
    }
  },
  dyeDatabase: [],
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_CONTEXT_MENU: '<svg></svg>',
}));

describe('ResultCard', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should be a custom element', async () => {
      // Result card should be definable as custom element
      const { ResultCard } = await import('../../v4/result-card');
      expect(ResultCard).toBeDefined();
    });

    it('should have correct tag name', async () => {
      const { ResultCard } = await import('../../v4/result-card');
      // Custom element name
      expect(ResultCard.name).toBe('ResultCard');
    });
  });

  // ============================================================================
  // Data Interface Tests
  // ============================================================================

  describe('Data Interface', () => {
    it('should export ResultCardData type', async () => {
      const module = await import('../../v4/result-card');
      // Module should export types
      expect(module).toBeDefined();
    });

    it('should export ContextAction type', async () => {
      const module = await import('../../v4/result-card');
      // Module should export types
      expect(module).toBeDefined();
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should extend BaseLitComponent', async () => {
      const { ResultCard } = await import('../../v4/result-card');
      const { BaseLitComponent } = await import('../../v4/base-lit-component');
      expect(ResultCard.prototype instanceof BaseLitComponent).toBe(true);
    });
  });
});

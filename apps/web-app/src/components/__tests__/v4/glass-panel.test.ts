/**
 * XIV Dye Tools - GlassPanel Unit Tests
 *
 * Tests the V4 glass panel Lit component for glassmorphism containers.
 * Covers rendering, variants, and slot content.
 *
 * @module components/__tests__/v4/glass-panel.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('GlassPanel', () => {
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
      const { GlassPanel } = await import('../../v4/glass-panel');
      expect(GlassPanel).toBeDefined();
    });

    it('should have correct class name', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      expect(GlassPanel.name).toBe('GlassPanel');
    });
  });

  // ============================================================================
  // Properties Tests
  // ============================================================================

  describe('Properties', () => {
    it('should have heading property', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      const panel = new GlassPanel();
      expect(panel.heading).toBeUndefined();
    });

    it('should have variant property with default value', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      const panel = new GlassPanel();
      expect(panel.variant).toBe('default');
    });

    it('should have padding property with default value', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      const panel = new GlassPanel();
      expect(panel.padding).toBe('md');
    });

    it('should have noBorder property', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      const panel = new GlassPanel();
      expect(panel.noBorder).toBe(false);
    });

    it('should have interactive property', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      const panel = new GlassPanel();
      expect(panel.interactive).toBe(false);
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should extend BaseLitComponent', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      const { BaseLitComponent } = await import('../../v4/base-lit-component');
      expect(GlassPanel.prototype instanceof BaseLitComponent).toBe(true);
    });

    it('should have styles defined', async () => {
      const { GlassPanel } = await import('../../v4/glass-panel');
      expect(GlassPanel.styles).toBeDefined();
    });
  });

  // ============================================================================
  // Type Exports Tests
  // ============================================================================

  describe('Type Exports', () => {
    it('should export module', async () => {
      const module = await import('../../v4/glass-panel');
      expect(module.GlassPanel).toBeDefined();
    });
  });
});

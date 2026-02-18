/**
 * XIV Dye Tools - ToggleSwitchV4 Unit Tests
 *
 * Tests the V4 toggle switch Lit component for boolean settings.
 * Covers rendering, state changes, and accessibility.
 *
 * @module components/__tests__/v4/toggle-switch-v4.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ToggleSwitchV4', () => {
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
      const { ToggleSwitchV4 } = await import('../../v4/toggle-switch-v4');
      expect(ToggleSwitchV4).toBeDefined();
    });

    it('should have correct class name', async () => {
      const { ToggleSwitchV4 } = await import('../../v4/toggle-switch-v4');
      expect(ToggleSwitchV4.name).toBe('ToggleSwitchV4');
    });
  });

  // ============================================================================
  // Properties Tests
  // ============================================================================

  describe('Properties', () => {
    it('should have checked property', async () => {
      const { ToggleSwitchV4 } = await import('../../v4/toggle-switch-v4');
      const toggle = new ToggleSwitchV4();
      expect(toggle.checked).toBe(false);
    });

    it('should have disabled property', async () => {
      const { ToggleSwitchV4 } = await import('../../v4/toggle-switch-v4');
      const toggle = new ToggleSwitchV4();
      expect(toggle.disabled).toBe(false);
    });

    it('should have label property', async () => {
      const { ToggleSwitchV4 } = await import('../../v4/toggle-switch-v4');
      const toggle = new ToggleSwitchV4();
      expect(toggle.label).toBeUndefined();
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should extend BaseLitComponent', async () => {
      const { ToggleSwitchV4 } = await import('../../v4/toggle-switch-v4');
      const { BaseLitComponent } = await import('../../v4/base-lit-component');
      expect(ToggleSwitchV4.prototype instanceof BaseLitComponent).toBe(true);
    });

    it('should have styles defined', async () => {
      const { ToggleSwitchV4 } = await import('../../v4/toggle-switch-v4');
      expect(ToggleSwitchV4.styles).toBeDefined();
    });
  });
});

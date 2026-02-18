/**
 * XIV Dye Tools - DyeActionDropdown Unit Tests
 *
 * Tests the dye action dropdown component for quick dye actions.
 * Covers rendering, menu toggle, action dispatch, and accessibility.
 *
 * @module components/__tests__/dye-action-dropdown.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDyeActionDropdown } from '../dye-action-dropdown';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
  getAttr,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
  },
  StorageService: {
    getItem: vi.fn().mockReturnValue([]),
    setItem: vi.fn(),
  },
  RouterService: {
    navigateTo: vi.fn(),
  },
}));

vi.mock('@services/dye-service-wrapper', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getDyeById: vi.fn((id: number) => mockDyes.find((d) => d.id === id)),
    }),
  },
}));

vi.mock('@services/toast-service', () => ({
  ToastService: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@services/modal-service', () => ({
  ModalService: {
    show: vi.fn().mockReturnValue('modal-123'),
    dismiss: vi.fn(),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('DyeActionDropdown', () => {
  let container: HTMLElement;
  let dropdown: HTMLElement | null;

  beforeEach(() => {
    container = createTestContainer();
    dropdown = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (dropdown) {
      // Call cleanup if available
      const cleanupFn = (dropdown as HTMLElement & { __cleanup?: () => void }).__cleanup;
      if (cleanupFn) cleanupFn();
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should create dropdown container', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      expect(dropdown.classList.contains('dye-action-dropdown')).toBe(true);
    });

    it('should render trigger button', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query(dropdown, 'button[aria-haspopup="true"]');
      expect(button).not.toBeNull();
    });

    it('should render three-dot icon', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const svg = query(dropdown, 'button svg');
      expect(svg).not.toBeNull();
    });

    it('should render menu container', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const menu = query(dropdown, '[role="menu"]');
      expect(menu).not.toBeNull();
    });

    it('should have menu hidden initially', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.classList.contains('invisible')).toBe(true);
    });
  });

  // ============================================================================
  // Menu Items Tests
  // ============================================================================

  describe('Menu Items', () => {
    it('should render 6 action menu items', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const menuItems = queryAll(dropdown, '[role="menuitem"]');
      expect(menuItems.length).toBe(6);
    });

    it('should render comparison action', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      expect(dropdown.textContent).toContain('harmony.addToComparison');
    });

    it('should render mixer action', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      expect(dropdown.textContent).toContain('harmony.addToMixer');
    });

    it('should render accessibility action', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      expect(dropdown.textContent).toContain('harmony.addToAccessibility');
    });

    it('should render harmony action', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      expect(dropdown.textContent).toContain('harmony.seeHarmonies');
    });

    it('should render budget action', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      expect(dropdown.textContent).toContain('harmony.seeBudget');
    });

    it('should render copy hex action', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      expect(dropdown.textContent).toContain('harmony.copyHex');
    });
  });

  // ============================================================================
  // Menu Toggle Tests
  // ============================================================================

  describe('Menu Toggle', () => {
    it('should open menu on button click', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query<HTMLButtonElement>(dropdown, 'button[aria-haspopup="true"]');
      click(button);

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.classList.contains('visible')).toBe(true);
    });

    it('should set aria-expanded to true when open', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query<HTMLButtonElement>(dropdown, 'button[aria-haspopup="true"]');
      click(button);

      expect(getAttr(button, 'aria-expanded')).toBe('true');
    });

    it('should close menu on second click', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query<HTMLButtonElement>(dropdown, 'button[aria-haspopup="true"]');
      click(button); // Open
      click(button); // Close

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.classList.contains('invisible')).toBe(true);
    });

    it('should close menu on escape key', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query<HTMLButtonElement>(dropdown, 'button[aria-haspopup="true"]');
      click(button);

      dropdown.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.classList.contains('invisible')).toBe(true);
    });
  });

  // ============================================================================
  // Action Dispatch Tests
  // ============================================================================

  describe('Action Dispatch', () => {
    it('should call onAction callback when action clicked', async () => {
      const onAction = vi.fn();
      dropdown = createDyeActionDropdown(mockDyes[0], onAction);
      container.appendChild(dropdown);

      // Open menu
      const button = query<HTMLButtonElement>(dropdown, 'button[aria-haspopup="true"]');
      click(button);

      // Click copy hex action
      const menuItems = queryAll<HTMLButtonElement>(dropdown, '[role="menuitem"]');
      const copyAction = menuItems[menuItems.length - 1]; // Copy is last
      click(copyAction);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(onAction).toHaveBeenCalledWith('copy', mockDyes[0]);
    });

    it('should close menu after action click', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      // Open menu
      const button = query<HTMLButtonElement>(dropdown, 'button[aria-haspopup="true"]');
      click(button);

      // Click an action
      const menuItem = query<HTMLButtonElement>(dropdown, '[role="menuitem"]');
      click(menuItem);

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.classList.contains('invisible')).toBe(true);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have aria-label on trigger button', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query(dropdown, 'button[aria-haspopup="true"]');
      expect(button?.hasAttribute('aria-label')).toBe(true);
    });

    it('should have aria-controls linking button to menu', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query(dropdown, 'button[aria-haspopup="true"]');
      const menu = query(dropdown, '[role="menu"]');

      expect(getAttr(button, 'aria-controls')).toBe(menu?.id);
    });

    it('should have aria-label on menu', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.hasAttribute('aria-label')).toBe(true);
    });

    it('should use inert attribute when menu is closed', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.hasAttribute('inert')).toBe(true);
    });

    it('should remove inert attribute when menu is open', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const button = query<HTMLButtonElement>(dropdown, 'button[aria-haspopup="true"]');
      click(button);

      const menu = query(dropdown, '[role="menu"]');
      expect(menu?.hasAttribute('inert')).toBe(false);
    });
  });

  // ============================================================================
  // Unique ID Tests
  // ============================================================================

  describe('Unique IDs', () => {
    it('should generate unique menu IDs', () => {
      const dropdown1 = createDyeActionDropdown(mockDyes[0]);
      const dropdown2 = createDyeActionDropdown(mockDyes[1]);

      container.appendChild(dropdown1);
      container.appendChild(dropdown2);

      const menu1 = query(dropdown1, '[role="menu"]');
      const menu2 = query(dropdown2, '[role="menu"]');

      expect(menu1?.id).not.toBe(menu2?.id);

      // Cleanup
      const cleanup1 = (dropdown1 as HTMLElement & { __cleanup?: () => void }).__cleanup;
      const cleanup2 = (dropdown2 as HTMLElement & { __cleanup?: () => void }).__cleanup;
      if (cleanup1) cleanup1();
      if (cleanup2) cleanup2();
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('Cleanup', () => {
    it('should have cleanup function attached', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const cleanupFn = (dropdown as HTMLElement & { __cleanup?: () => void }).__cleanup;
      expect(typeof cleanupFn).toBe('function');
    });

    it('should not throw on cleanup', () => {
      dropdown = createDyeActionDropdown(mockDyes[0]);
      container.appendChild(dropdown);

      const cleanupFn = (dropdown as HTMLElement & { __cleanup?: () => void }).__cleanup;
      expect(() => cleanupFn?.()).not.toThrow();
    });
  });
});

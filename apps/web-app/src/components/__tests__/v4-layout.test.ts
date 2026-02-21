/**
 * XIV Dye Tools - V4Layout Unit Tests
 *
 * Tests the V4 layout entry point for the glassmorphism UI.
 * Covers initialization, tool loading, navigation, and event handling.
 *
 * @module components/__tests__/v4-layout.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeV4Layout } from '../v4-layout';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockNavigateTo, mockGetCurrentToolId, mockSubscribe, mockInitialize } = vi.hoisted(() => ({
  mockNavigateTo: vi.fn(),
  mockGetCurrentToolId: vi.fn().mockReturnValue('harmony'),
  mockSubscribe: vi.fn().mockReturnValue(() => {}),
  mockInitialize: vi.fn(),
}));

vi.mock('@services/router-service', () => ({
  RouterService: {
    initialize: mockInitialize,
    getCurrentToolId: mockGetCurrentToolId,
    subscribe: mockSubscribe,
    navigateTo: mockNavigateTo,
  },
}));

vi.mock('@services/config-controller', () => ({
  ConfigController: {
    getInstance: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({}),
      subscribe: vi.fn().mockReturnValue(() => {}),
    }),
  },
}));

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

vi.mock('@shared/utils', () => ({
  clearContainer: vi.fn((container: HTMLElement) => {
    container.innerHTML = '';
  }),
}));

vi.mock('../modal-container', () => ({
  ModalContainer: class MockModalContainer {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'modal-container';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
  },
}));

vi.mock('../toast-container', () => ({
  ToastContainer: class MockToastContainer {
    container: HTMLElement;
    constructor(container: HTMLElement) {
      this.container = container;
    }
    init() {
      const div = document.createElement('div');
      div.className = 'toast-container';
      this.container.appendChild(div);
    }
    destroy() {
      this.container.innerHTML = '';
    }
  },
}));

vi.mock('../about-modal', () => ({
  showAboutModal: vi.fn(),
}));

vi.mock('../v4/theme-modal', () => ({
  showThemeModal: vi.fn(),
}));

vi.mock('../v4/language-modal', () => ({
  showLanguageModal: vi.fn(),
}));

// Mock V4LayoutShell custom element
class MockV4LayoutShell extends HTMLElement {
  updateComplete = Promise.resolve(true);

  connectedCallback() {
    // Simulate shadow DOM structure
    const shadowRoot = this.attachShadow({ mode: 'open' });
    const contentScroll = document.createElement('div');
    contentScroll.className = 'v4-layout-content-scroll';
    shadowRoot.appendChild(contentScroll);
  }
}

vi.mock('@components/v4/v4-layout-shell', () => ({}));

describe('V4Layout', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createTestContainer();
    vi.clearAllMocks();

    // Register mock custom element if not already registered
    if (!customElements.get('v4-layout-shell')) {
      customElements.define('v4-layout-shell', MockV4LayoutShell);
    }

    // Clean up any existing DOM elements from previous tests
    document.getElementById('modal-root')?.remove();
    document.getElementById('toast-root')?.remove();
  });

  afterEach(() => {
    cleanupTestContainer(container);
    vi.restoreAllMocks();
    // Clean up created elements
    document.getElementById('modal-root')?.remove();
    document.getElementById('toast-root')?.remove();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should initialize router service', async () => {
      await initializeV4Layout(container);

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('should create v4-layout-shell element', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      expect(layoutShell).not.toBeNull();
    });

    it('should set initial tool attribute', async () => {
      mockGetCurrentToolId.mockReturnValue('mixer');

      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      expect(layoutShell?.getAttribute('active-tool')).toBe('mixer');
    });

    it('should subscribe to route changes', async () => {
      await initializeV4Layout(container);

      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Container Creation Tests
  // ============================================================================

  describe('Container Creation', () => {
    it('should create modal root if not exists', async () => {
      await initializeV4Layout(container);

      const modalRoot = document.getElementById('modal-root');
      expect(modalRoot).not.toBeNull();
    });

    it('should create toast root if not exists', async () => {
      await initializeV4Layout(container);

      const toastRoot = document.getElementById('toast-root');
      expect(toastRoot).not.toBeNull();
    });

    it('should use existing modal root if exists', async () => {
      const existingRoot = document.createElement('div');
      existingRoot.id = 'modal-root';
      document.body.appendChild(existingRoot);

      await initializeV4Layout(container);

      const modalRoots = document.querySelectorAll('#modal-root');
      expect(modalRoots.length).toBe(1);
    });

    it('should use existing toast root if exists', async () => {
      const existingRoot = document.createElement('div');
      existingRoot.id = 'toast-root';
      document.body.appendChild(existingRoot);

      await initializeV4Layout(container);

      const toastRoots = document.querySelectorAll('#toast-root');
      expect(toastRoots.length).toBe(1);
    });
  });

  // ============================================================================
  // Event Handling Tests
  // ============================================================================

  describe('Event Handling', () => {
    it('should handle tool-change event', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');
      layoutShell?.dispatchEvent(new CustomEvent('tool-change', { detail: { toolId: 'mixer' } }));

      expect(mockNavigateTo).toHaveBeenCalledWith('mixer');
    });

    it('should handle config-change event', async () => {
      await initializeV4Layout(container);

      const layoutShell = container.querySelector('v4-layout-shell');

      // Should not throw
      layoutShell?.dispatchEvent(
        new CustomEvent('config-change', {
          detail: { tool: 'harmony', key: 'showPrices', value: true },
        })
      );

      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Tool Loading Tests
  // ============================================================================

  describe('Tool Loading', () => {
    it('should render container with layout shell', async () => {
      await initializeV4Layout(container);

      expect(container.children.length).toBeGreaterThan(0);
    });
  });
});

/**
 * XIV Dye Tools - Router Service Tests
 * Tests for History API router with navigation, deep linking, and route management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RouterService, ROUTES, type ToolId, type RouteState } from '../router-service';

// ============================================================================
// Test Setup
// ============================================================================

describe('RouterService', () => {
  // Store original values
  let originalPathname: string;
  let originalSearch: string;
  let originalTitle: string;

  beforeEach(() => {
    // Store original values
    originalPathname = window.location.pathname;
    originalSearch = window.location.search;
    originalTitle = document.title;

    // Reset RouterService state
    RouterService.destroy();

    // Mock history methods
    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    vi.spyOn(history, 'replaceState').mockImplementation(() => {});

    // Reset location to root
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/',
        search: '',
        href: 'http://localhost/',
      },
      writable: true,
    });
  });

  afterEach(() => {
    RouterService.destroy();
    vi.restoreAllMocks();

    // Restore original location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: originalPathname,
        search: originalSearch,
        href: `http://localhost${originalPathname}${originalSearch}`,
      },
      writable: true,
    });
    document.title = originalTitle;
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('ROUTES constant', () => {
    it('should export route definitions', () => {
      expect(ROUTES).toBeDefined();
      expect(Array.isArray(ROUTES)).toBe(true);
      expect(ROUTES.length).toBeGreaterThan(0);
    });

    it('should have all required route properties', () => {
      ROUTES.forEach((route) => {
        expect(route.id).toBeDefined();
        expect(route.path).toBeDefined();
        expect(route.title).toBeDefined();
        expect(route.path.startsWith('/')).toBe(true);
      });
    });

    it('should include harmony route', () => {
      const harmonyRoute = ROUTES.find((r) => r.id === 'harmony');
      expect(harmonyRoute).toBeDefined();
      expect(harmonyRoute?.path).toBe('/harmony');
    });

    it('should include all expected tools', () => {
      const toolIds = ROUTES.map((r) => r.id);
      // V4 tool IDs
      expect(toolIds).toContain('harmony');
      expect(toolIds).toContain('extractor'); // Was 'matcher'
      expect(toolIds).toContain('accessibility');
      expect(toolIds).toContain('comparison');
      expect(toolIds).toContain('gradient'); // Was 'mixer' (Gradient Builder)
      expect(toolIds).toContain('presets');
      expect(toolIds).toContain('budget');
      expect(toolIds).toContain('swatch'); // Was 'character'
      expect(toolIds).toContain('mixer'); // NEW - Dye Mixer
    });
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialize', () => {
    it('should initialize the router service', () => {
      RouterService.initialize();
      expect(history.replaceState).toHaveBeenCalled();
    });

    it('should only initialize once', () => {
      RouterService.initialize();
      RouterService.initialize();
      // Should only replace state once for initial route
      expect(history.replaceState).toHaveBeenCalledTimes(1);
    });

    it('should handle initial route at root', () => {
      Object.defineProperty(window, 'location', {
        value: { pathname: '/', search: '', href: 'http://localhost/' },
        writable: true,
      });

      RouterService.initialize();

      // Should redirect to default tool (harmony)
      expect(history.replaceState).toHaveBeenCalled();
    });

    it('should handle initial route at valid path', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/mixer',
          search: '',
          href: 'http://localhost/mixer',
        },
        writable: true,
      });

      RouterService.initialize();

      const route = RouterService.getCurrentRoute();
      expect(route.toolId).toBe('mixer');
    });

    it('should redirect unknown paths to default tool', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/unknown-route',
          search: '',
          href: 'http://localhost/unknown-route',
        },
        writable: true,
      });

      RouterService.initialize();

      expect(history.replaceState).toHaveBeenCalled();
    });

    it('should set document title on initialization', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/comparison',
          search: '',
          href: 'http://localhost/comparison',
        },
        writable: true,
      });

      RouterService.initialize();

      expect(document.title).toContain('Comparison');
    });
  });

  // ============================================================================
  // Navigation Tests
  // ============================================================================

  describe('navigateTo', () => {
    beforeEach(() => {
      RouterService.initialize();
    });

    it('should navigate to a valid tool', () => {
      RouterService.navigateTo('extractor'); // V4: 'matcher' → 'extractor'

      expect(history.pushState).toHaveBeenCalled();
      expect(RouterService.getCurrentToolId()).toBe('extractor');
    });

    it('should update document title on navigation', () => {
      RouterService.navigateTo('accessibility');

      expect(document.title).toContain('Accessibility');
    });

    it('should handle navigation with additional params', () => {
      RouterService.navigateTo('harmony', { dye: 'JetBlack' });

      expect(history.pushState).toHaveBeenCalled();
      const calls = vi.mocked(history.pushState).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toContain('dye=JetBlack');
    });

    it('should not navigate to unknown tool', () => {
      const initialToolId = RouterService.getCurrentToolId();

      RouterService.navigateTo('invalid-tool' as ToolId);

      expect(RouterService.getCurrentToolId()).toBe(initialToolId);
    });

    it('should preserve existing query parameters', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '?dc=aether&dye=SnowWhite',
          href: 'http://localhost/harmony?dc=aether&dye=SnowWhite',
        },
        writable: true,
      });

      RouterService.navigateTo('extractor'); // V4: 'matcher' → 'extractor'

      const calls = vi.mocked(history.pushState).mock.calls;
      const lastCall = calls[calls.length - 1];
      const url = lastCall[2] as string;

      expect(url).toContain('dc=aether');
      expect(url).toContain('dye=SnowWhite');
    });

    it('should auto-initialize if not initialized', () => {
      RouterService.destroy();

      RouterService.navigateTo('mixer');

      expect(RouterService.getCurrentToolId()).toBe('mixer');
    });
  });

  // ============================================================================
  // Replace Route Tests
  // ============================================================================

  describe('replaceRoute', () => {
    beforeEach(() => {
      RouterService.initialize();
    });

    it('should replace current route without history entry', () => {
      RouterService.replaceRoute('budget');

      expect(history.replaceState).toHaveBeenCalled();
      expect(RouterService.getCurrentToolId()).toBe('budget');
    });

    it('should update document title on replace', () => {
      RouterService.replaceRoute('presets');

      expect(document.title).toContain('Presets');
    });

    it('should handle replace with additional params', () => {
      RouterService.replaceRoute('harmony', { ui: 'compact' });

      const calls = vi.mocked(history.replaceState).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toContain('ui=compact');
    });

    it('should not replace with invalid tool', () => {
      RouterService.replaceRoute('invalid' as ToolId);

      // Should not change from current tool
      expect(RouterService.getCurrentToolId()).not.toBe('invalid');
    });

    it('should preserve existing params on replace', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '?dc=primal',
          href: 'http://localhost/harmony?dc=primal',
        },
        writable: true,
      });

      RouterService.replaceRoute('extractor'); // V4: 'matcher' → 'extractor'

      const calls = vi.mocked(history.replaceState).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toContain('dc=primal');
    });

    it('should auto-initialize if not initialized', () => {
      RouterService.destroy();

      RouterService.replaceRoute('comparison');

      expect(RouterService.getCurrentToolId()).toBe('comparison');
    });
  });

  // ============================================================================
  // Get Current Route Tests
  // ============================================================================

  describe('getCurrentRoute', () => {
    it('should return current route state', () => {
      RouterService.initialize();

      const route = RouterService.getCurrentRoute();

      expect(route).toBeDefined();
      expect(route.toolId).toBeDefined();
      expect(route.params).toBeInstanceOf(URLSearchParams);
    });

    it('should include query parameters', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '?dye=JetBlack&dc=aether',
          href: 'http://localhost/harmony?dye=JetBlack&dc=aether',
        },
        writable: true,
      });

      RouterService.initialize();

      const route = RouterService.getCurrentRoute();
      expect(route.params.get('dye')).toBe('JetBlack');
      expect(route.params.get('dc')).toBe('aether');
    });

    it('should auto-initialize if not initialized', () => {
      const route = RouterService.getCurrentRoute();

      expect(route).toBeDefined();
      expect(route.toolId).toBeDefined();
    });
  });

  // ============================================================================
  // Get Current Tool ID Tests
  // ============================================================================

  describe('getCurrentToolId', () => {
    it('should return current tool ID', () => {
      RouterService.initialize();
      RouterService.navigateTo('mixer');

      expect(RouterService.getCurrentToolId()).toBe('mixer');
    });

    it('should auto-initialize if not initialized', () => {
      const toolId = RouterService.getCurrentToolId();

      expect(toolId).toBeDefined();
    });
  });

  // ============================================================================
  // Subscription Tests
  // ============================================================================

  describe('subscribe', () => {
    it('should notify subscribers on route change', () => {
      RouterService.initialize();

      const listener = vi.fn();
      RouterService.subscribe(listener);

      RouterService.navigateTo('extractor'); // V4: 'matcher' → 'extractor'

      expect(listener).toHaveBeenCalled();
    });

    it('should pass route state to subscriber', () => {
      RouterService.initialize();

      let receivedState: RouteState | null = null;
      RouterService.subscribe((state) => {
        receivedState = state;
      });

      RouterService.navigateTo('accessibility');

      expect(receivedState).not.toBeNull();
      expect((receivedState as unknown as RouteState).toolId).toBe('accessibility');
    });

    it('should return unsubscribe function', () => {
      RouterService.initialize();

      const listener = vi.fn();
      const unsubscribe = RouterService.subscribe(listener);

      RouterService.navigateTo('mixer');
      const callCount = listener.mock.calls.length;

      unsubscribe();
      RouterService.navigateTo('budget');

      expect(listener.mock.calls.length).toBe(callCount);
    });

    it('should support multiple subscribers', () => {
      RouterService.initialize();

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      RouterService.subscribe(listener1);
      RouterService.subscribe(listener2);

      RouterService.navigateTo('presets');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      RouterService.initialize();

      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      RouterService.subscribe(errorListener);
      RouterService.subscribe(goodListener);

      // Should not throw
      expect(() => {
        RouterService.navigateTo('comparison');
      }).not.toThrow();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Route Helper Methods Tests
  // ============================================================================

  describe('getRouteForTool', () => {
    it('should return route definition for valid tool', () => {
      const route = RouterService.getRouteForTool('harmony');

      expect(route).toBeDefined();
      expect(route?.id).toBe('harmony');
      expect(route?.path).toBe('/harmony');
      expect(route?.title).toBe('Harmony Explorer');
    });

    it('should return undefined for invalid tool', () => {
      const route = RouterService.getRouteForTool('invalid' as ToolId);

      expect(route).toBeUndefined();
    });
  });

  describe('getToolFromPath', () => {
    it('should return tool ID for exact path match', () => {
      const toolId = RouterService.getToolFromPath('/harmony');
      expect(toolId).toBe('harmony');
    });

    it('should return tool ID for path without leading slash', () => {
      const toolId = RouterService.getToolFromPath('extractor'); // V4: 'matcher' → 'extractor'
      expect(toolId).toBe('extractor');
    });

    it('should return tool ID for nested routes', () => {
      const toolId = RouterService.getToolFromPath('/presets/community-123');
      expect(toolId).toBe('presets');
    });

    it('should return null for unknown path', () => {
      const toolId = RouterService.getToolFromPath('/unknown');
      expect(toolId).toBeNull();
    });
  });

  describe('getSubPath', () => {
    it('should return sub-path for nested routes', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/presets/community-abc123',
          search: '',
          href: 'http://localhost/presets/community-abc123',
        },
        writable: true,
      });

      const subPath = RouterService.getSubPath();
      expect(subPath).toBe('community-abc123');
    });

    it('should return null for non-nested routes', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '',
          href: 'http://localhost/harmony',
        },
        writable: true,
      });

      const subPath = RouterService.getSubPath();
      expect(subPath).toBeNull();
    });

    it('should return null for unknown paths', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/unknown/path',
          search: '',
          href: 'http://localhost/unknown/path',
        },
        writable: true,
      });

      const subPath = RouterService.getSubPath();
      expect(subPath).toBeNull();
    });
  });

  describe('isValidToolId', () => {
    it('should return true for valid tool IDs', () => {
      // V4 tool IDs
      expect(RouterService.isValidToolId('harmony')).toBe(true);
      expect(RouterService.isValidToolId('extractor')).toBe(true); // Was 'matcher'
      expect(RouterService.isValidToolId('accessibility')).toBe(true);
      expect(RouterService.isValidToolId('comparison')).toBe(true);
      expect(RouterService.isValidToolId('gradient')).toBe(true); // Was 'mixer' (Gradient Builder)
      expect(RouterService.isValidToolId('presets')).toBe(true);
      expect(RouterService.isValidToolId('budget')).toBe(true);
      expect(RouterService.isValidToolId('swatch')).toBe(true); // Was 'character'
      expect(RouterService.isValidToolId('mixer')).toBe(true); // NEW - Dye Mixer
    });

    it('should return false for invalid tool IDs', () => {
      expect(RouterService.isValidToolId('invalid')).toBe(false);
      expect(RouterService.isValidToolId('')).toBe(false);
      expect(RouterService.isValidToolId('HARMONY')).toBe(false);
    });
  });

  describe('getRoutes', () => {
    it('should return all route definitions', () => {
      const routes = RouterService.getRoutes();

      expect(routes).toBeDefined();
      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBe(9); // V4: 9 tools (8 renamed/retained + 1 new)
    });

    it('should return readonly array', () => {
      const routes = RouterService.getRoutes();

      // TypeScript should prevent modification, but we can verify it's the same reference
      expect(routes).toBe(ROUTES);
    });
  });

  // ============================================================================
  // Destroy Tests
  // ============================================================================

  describe('destroy', () => {
    it('should clean up event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      RouterService.initialize();
      RouterService.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    it('should clear listeners', () => {
      RouterService.initialize();

      const listener = vi.fn();
      RouterService.subscribe(listener);

      RouterService.destroy();
      RouterService.initialize();
      RouterService.navigateTo('mixer');

      // Listener should not be called after destroy
      expect(listener).not.toHaveBeenCalled();
    });

    it('should allow re-initialization after destroy', () => {
      RouterService.initialize();
      RouterService.destroy();
      RouterService.initialize();

      expect(RouterService.getCurrentToolId()).toBeDefined();
    });
  });

  // ============================================================================
  // Popstate Event Tests
  // ============================================================================

  describe('popstate handling', () => {
    it('should handle popstate event with state', () => {
      RouterService.initialize();

      const listener = vi.fn();
      RouterService.subscribe(listener);

      // Simulate popstate event with state
      const event = new PopStateEvent('popstate', {
        state: { toolId: 'budget' },
      });
      window.dispatchEvent(event);

      expect(listener).toHaveBeenCalled();
      expect(RouterService.getCurrentToolId()).toBe('budget');
    });

    it('should handle popstate event without state', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/comparison',
          search: '',
          href: 'http://localhost/comparison',
        },
        writable: true,
      });

      RouterService.initialize();

      const listener = vi.fn();
      RouterService.subscribe(listener);

      // Simulate popstate event without state
      const event = new PopStateEvent('popstate', { state: null });
      window.dispatchEvent(event);

      expect(listener).toHaveBeenCalled();
    });

    it('should handle popstate with invalid state', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/mixer',
          search: '',
          href: 'http://localhost/mixer',
        },
        writable: true,
      });

      RouterService.initialize();

      const listener = vi.fn();
      RouterService.subscribe(listener);

      // Simulate popstate event with invalid state
      const event = new PopStateEvent('popstate', {
        state: { toolId: 'invalid-tool' },
      });
      window.dispatchEvent(event);

      expect(listener).toHaveBeenCalled();
      // Should fall back to parsing from URL
      expect(RouterService.getCurrentToolId()).toBe('mixer');
    });

    it('should update document title on popstate', () => {
      RouterService.initialize();

      // Simulate popstate event
      const event = new PopStateEvent('popstate', {
        state: { toolId: 'presets' },
      });
      window.dispatchEvent(event);

      expect(document.title).toContain('Presets');
    });
  });

  // ============================================================================
  // Edge Cases and Branch Coverage
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty pathname', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '',
          search: '',
          href: 'http://localhost/',
        },
        writable: true,
      });

      RouterService.initialize();

      // Should redirect to default tool
      expect(history.replaceState).toHaveBeenCalled();
    });

    it('should handle path with only slash', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/',
          search: '',
          href: 'http://localhost/',
        },
        writable: true,
      });

      RouterService.initialize();

      expect(history.replaceState).toHaveBeenCalled();
    });

    it('should handle nested path that does not exist', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/unknown/nested/path',
          search: '',
          href: 'http://localhost/unknown/nested/path',
        },
        writable: true,
      });

      RouterService.initialize();

      // Should redirect to default
      expect(history.replaceState).toHaveBeenCalled();
    });

    it('should handle special characters in params', () => {
      RouterService.initialize();

      RouterService.navigateTo('harmony', {
        dye: 'Snow White',
        special: 'test&value=true',
      });

      expect(history.pushState).toHaveBeenCalled();
    });

    it('should handle navigation to same tool', () => {
      RouterService.initialize();
      RouterService.navigateTo('harmony');

      const pushCalls = vi.mocked(history.pushState).mock.calls.length;

      RouterService.navigateTo('harmony');

      // Should still push state even for same tool
      expect(vi.mocked(history.pushState).mock.calls.length).toBe(pushCalls + 1);
    });

    it('should preserve UI param across navigation', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '?ui=compact',
          href: 'http://localhost/harmony?ui=compact',
        },
        writable: true,
      });

      RouterService.initialize();
      RouterService.navigateTo('extractor'); // V4: 'matcher' → 'extractor'

      const calls = vi.mocked(history.pushState).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toContain('ui=compact');
    });
  });

  // ============================================================================
  // Query Parameter Tests
  // ============================================================================

  describe('query parameter handling', () => {
    it('should build URL without query string when no params', () => {
      RouterService.initialize();

      RouterService.navigateTo('mixer');

      const calls = vi.mocked(history.pushState).mock.calls;
      const lastCall = calls[calls.length - 1];
      const url = lastCall[2] as string;

      expect(url).toBe('/mixer');
    });

    it('should build URL with query string when params exist', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '?dc=crystal',
          href: 'http://localhost/harmony?dc=crystal',
        },
        writable: true,
      });

      RouterService.initialize();
      RouterService.navigateTo('extractor'); // V4: 'matcher' → 'extractor'

      const calls = vi.mocked(history.pushState).mock.calls;
      const lastCall = calls[calls.length - 1];
      const url = lastCall[2] as string;

      expect(url).toContain('?');
      expect(url).toContain('dc=crystal');
    });

    it('should merge additional params with preserved params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '?dc=elemental',
          href: 'http://localhost/harmony?dc=elemental',
        },
        writable: true,
      });

      RouterService.initialize();
      RouterService.navigateTo('comparison', { dye: 'PureWhite' });

      const calls = vi.mocked(history.pushState).mock.calls;
      const lastCall = calls[calls.length - 1];
      const url = lastCall[2] as string;

      expect(url).toContain('dc=elemental');
      expect(url).toContain('dye=PureWhite');
    });

    it('should override preserved params with additional params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/harmony',
          search: '?dye=OldDye',
          href: 'http://localhost/harmony?dye=OldDye',
        },
        writable: true,
      });

      RouterService.initialize();
      RouterService.navigateTo('mixer', { dye: 'NewDye' });

      const calls = vi.mocked(history.pushState).mock.calls;
      const lastCall = calls[calls.length - 1];
      const url = lastCall[2] as string;

      expect(url).toContain('dye=NewDye');
      expect(url).not.toContain('OldDye');
    });
  });
});

/**
 * XIV Dye Tools v3.0.0 - Router Service
 *
 * Lightweight History API router for the v3 two-panel layout.
 * Provides clean URLs, browser back/forward support, and deep linking.
 *
 * @module services/router-service
 */

import { logger } from '@shared/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * V4 Tool IDs
 * Changes from v3:
 * - 'matcher' → 'extractor' (Palette Extractor)
 * - 'mixer' → 'gradient' (Gradient Builder - old mixer functionality)
 * - 'character' → 'swatch' (Swatch Matcher)
 * - NEW: 'mixer' (Dye Mixer - completely new tool)
 */
export type ToolId =
  | 'harmony'
  | 'extractor' // Was 'matcher' in v3
  | 'accessibility'
  | 'comparison'
  | 'gradient' // Was 'mixer' in v3 (Gradient Builder)
  | 'presets'
  | 'budget'
  | 'swatch' // Was 'character' in v3
  | 'mixer'; // NEW - Dye Mixer tool

export interface RouteDefinition {
  id: ToolId;
  path: string;
  title: string;
}

export interface RouteState {
  toolId: ToolId;
  params: URLSearchParams;
}

type RouteChangeListener = (state: RouteState) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TOOL: ToolId = 'harmony';

/**
 * V4 Route definitions mapping tool IDs to URL paths
 * Updated tool names and paths for v4 UI migration
 */
export const ROUTES: RouteDefinition[] = [
  { id: 'harmony', path: '/harmony', title: 'Harmony Explorer' },
  { id: 'extractor', path: '/extractor', title: 'Palette Extractor' },
  { id: 'accessibility', path: '/accessibility', title: 'Accessibility Checker' },
  { id: 'comparison', path: '/comparison', title: 'Dye Comparison' },
  { id: 'gradient', path: '/gradient', title: 'Gradient Builder' },
  { id: 'presets', path: '/presets', title: 'Community Presets' },
  { id: 'budget', path: '/budget', title: 'Budget Suggestions' },
  { id: 'swatch', path: '/swatch', title: 'Swatch Matcher' },
  { id: 'mixer', path: '/mixer', title: 'Dye Mixer' }, // NEW tool
];

/**
 * Legacy route redirects for backward compatibility
 * Maps old v3 paths to new v4 tool IDs
 * Note: /mixer is NOT redirected - it's now a new tool
 */
const LEGACY_ROUTE_REDIRECTS: Record<string, ToolId> = {
  '/matcher': 'extractor',
  '/character': 'swatch',
  // /mixer stays at /mixer but is now the NEW Dye Mixer
  // Old mixer functionality moved to /gradient
};

/**
 * Query parameters to preserve across navigation
 * - dc: Data Center selection
 * - dye: Selected dye
 * - ui: UI preference (e.g., compact mode)
 */
const PRESERVED_PARAMS = ['dc', 'dye', 'ui'];

// ============================================================================
// Router Service
// ============================================================================

/**
 * Router service for History API navigation
 *
 * Usage:
 * ```typescript
 * // Initialize on app load
 * RouterService.initialize();
 *
 * // Navigate to a tool
 * RouterService.navigateTo('matcher');
 *
 * // Navigate with preserved params
 * RouterService.navigateTo('harmony', { dye: 'JetBlack' });
 *
 * // Subscribe to route changes
 * RouterService.subscribe((state) => {
 *   loadTool(state.toolId);
 * });
 *
 * // Get current route
 * const { toolId, params } = RouterService.getCurrentRoute();
 * ```
 */
export class RouterService {
  private static listeners: Set<RouteChangeListener> = new Set();
  private static initialized = false;
  private static currentToolId: ToolId = DEFAULT_TOOL;

  /**
   * Initialize the router service
   * Sets up popstate listener and handles initial route
   */
  static initialize(): void {
    if (this.initialized) return;

    // Set initialized FIRST to prevent recursion when handleInitialRoute calls replaceRoute
    this.initialized = true;

    // Listen for browser back/forward
    window.addEventListener('popstate', this.handlePopState);

    // Handle initial route
    this.handleInitialRoute();

    logger.info(`[RouterService] Initialized at route: ${this.currentToolId}`);
  }

  /**
   * Navigate to a tool
   * @param toolId - The tool to navigate to
   * @param additionalParams - Additional query parameters to add
   */
  static navigateTo(toolId: ToolId, additionalParams?: Record<string, string>): void {
    if (!this.initialized) this.initialize();

    // Build the new URL
    const route = this.getRouteForTool(toolId);
    if (!route) {
      logger.warn(`[RouterService] Unknown tool ID: ${toolId}`);
      return;
    }

    // Preserve existing params and add new ones
    const currentParams = new URLSearchParams(window.location.search);
    const newParams = new URLSearchParams();

    // Copy preserved params
    PRESERVED_PARAMS.forEach((key) => {
      const value = currentParams.get(key);
      if (value) newParams.set(key, value);
    });

    // Add additional params
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        newParams.set(key, value);
      });
    }

    // Build URL
    const queryString = newParams.toString();
    const url = route.path + (queryString ? `?${queryString}` : '');

    // Update browser history
    history.pushState({ toolId }, route.title, url);

    // Update document title
    document.title = `${route.title} | XIV Dye Tools`;

    // Update internal state and notify listeners
    this.currentToolId = toolId;
    this.notifyListeners();

    logger.info(`[RouterService] Navigated to: ${url}`);
  }

  /**
   * Replace current route without adding history entry
   * Useful for redirects
   */
  static replaceRoute(toolId: ToolId, additionalParams?: Record<string, string>): void {
    if (!this.initialized) this.initialize();

    const route = this.getRouteForTool(toolId);
    if (!route) return;

    const currentParams = new URLSearchParams(window.location.search);
    const newParams = new URLSearchParams();

    PRESERVED_PARAMS.forEach((key) => {
      const value = currentParams.get(key);
      if (value) newParams.set(key, value);
    });

    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        newParams.set(key, value);
      });
    }

    const queryString = newParams.toString();
    const url = route.path + (queryString ? `?${queryString}` : '');

    history.replaceState({ toolId }, route.title, url);
    document.title = `${route.title} | XIV Dye Tools`;

    this.currentToolId = toolId;
    this.notifyListeners();
  }

  /**
   * Get the current route state
   */
  static getCurrentRoute(): RouteState {
    if (!this.initialized) this.initialize();

    return {
      toolId: this.currentToolId,
      params: new URLSearchParams(window.location.search),
    };
  }

  /**
   * Get the current tool ID
   */
  static getCurrentToolId(): ToolId {
    if (!this.initialized) this.initialize();
    return this.currentToolId;
  }

  /**
   * Subscribe to route changes
   * @returns Unsubscribe function
   */
  static subscribe(listener: RouteChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get route definition for a tool
   */
  static getRouteForTool(toolId: ToolId): RouteDefinition | undefined {
    return ROUTES.find((r) => r.id === toolId);
  }

  /**
   * Get tool ID from a URL path
   * Supports both exact matches (/presets) and nested routes (/presets/:id)
   */
  static getToolFromPath(path: string): ToolId | null {
    // First try exact match
    const exactMatch = ROUTES.find((r) => r.path === path || r.path === `/${path}`);
    if (exactMatch) return exactMatch.id;

    // Try prefix match for nested routes (e.g., /presets/community-xxx)
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const prefixMatch = ROUTES.find((r) => normalizedPath.startsWith(r.path + '/'));
    return prefixMatch?.id ?? null;
  }

  /**
   * Get the sub-path after the tool path
   * e.g., /presets/community-xxx returns "community-xxx"
   */
  static getSubPath(): string | null {
    const path = window.location.pathname;
    const toolId = this.getToolFromPath(path);
    if (!toolId) return null;

    const route = this.getRouteForTool(toolId);
    if (!route) return null;

    // Extract the part after the tool path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    if (normalizedPath.startsWith(route.path + '/')) {
      return normalizedPath.slice(route.path.length + 1); // +1 for the slash
    }

    return null;
  }

  /**
   * Check if a tool ID is valid
   */
  static isValidToolId(id: string): id is ToolId {
    return ROUTES.some((r) => r.id === id);
  }

  /**
   * Get all route definitions
   */
  static getRoutes(): readonly RouteDefinition[] {
    return ROUTES;
  }

  /**
   * Clean up the router service
   * Call this on app unmount
   */
  static destroy(): void {
    window.removeEventListener('popstate', this.handlePopState);
    this.listeners.clear();
    this.initialized = false;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private static handlePopState = (event: PopStateEvent): void => {
    const state = event.state as { toolId?: ToolId } | null;

    if (state?.toolId && this.isValidToolId(state.toolId)) {
      this.currentToolId = state.toolId;
    } else {
      // Parse from URL if no state
      const toolId = this.parseCurrentPath();
      this.currentToolId = toolId;
    }

    // Update title
    const route = this.getRouteForTool(this.currentToolId);
    if (route) {
      document.title = `${route.title} | XIV Dye Tools`;
    }

    this.notifyListeners();
    logger.info(`[RouterService] Popstate: ${this.currentToolId}`);
  };

  private static handleInitialRoute(): void {
    const path = window.location.pathname;

    // V4: Check for legacy route redirects FIRST
    const legacyRedirect = LEGACY_ROUTE_REDIRECTS[path];
    if (legacyRedirect) {
      logger.info(`[RouterService] Redirecting legacy route ${path} -> /${legacyRedirect}`);
      this.replaceRoute(legacyRedirect);
      return;
    }

    const toolId = this.parseCurrentPath();

    // If at root or unknown path, redirect to default tool
    if (path === '/' || path === '' || !this.getToolFromPath(path)) {
      this.replaceRoute(DEFAULT_TOOL);
    } else {
      this.currentToolId = toolId;

      // Update title
      const route = this.getRouteForTool(toolId);
      if (route) {
        document.title = `${route.title} | XIV Dye Tools`;
      }
    }
  }

  private static parseCurrentPath(): ToolId {
    const path = window.location.pathname;
    const toolId = this.getToolFromPath(path);
    return toolId ?? DEFAULT_TOOL;
  }

  private static notifyListeners(): void {
    const state = this.getCurrentRoute();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        logger.error('[RouterService] Listener error:', error);
      }
    });
  }
}

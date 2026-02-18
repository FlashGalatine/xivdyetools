/**
 * matchMedia mock for testing
 *
 * Provides a mock implementation of window.matchMedia
 * for testing responsive and theme-aware components.
 *
 * @example
 * ```typescript
 * // Setup mock
 * setupMatchMediaMock();
 *
 * // Test dark mode detection
 * setMediaQueryMatch('(prefers-color-scheme: dark)', true);
 *
 * const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
 * expect(darkMode.matches).toBe(true);
 * ```
 */

type MediaQueryCallback = (event: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  onchange: MediaQueryCallback | null;
  addListener: (callback: MediaQueryCallback) => void;
  removeListener: (callback: MediaQueryCallback) => void;
  addEventListener: (event: string, callback: MediaQueryCallback) => void;
  removeEventListener: (event: string, callback: MediaQueryCallback) => void;
  dispatchEvent: (event: Event) => boolean;
}

/** Store for media query states */
const mediaQueryStates = new Map<string, boolean>();

/** Store for media query listeners */
const mediaQueryListeners = new Map<string, Set<MediaQueryCallback>>();

/**
 * Creates a mock MediaQueryList
 */
function createMockMediaQueryList(query: string): MockMediaQueryList {
  const listeners = mediaQueryListeners.get(query) ?? new Set();
  mediaQueryListeners.set(query, listeners);

  return {
    get matches() {
      return mediaQueryStates.get(query) ?? false;
    },
    media: query,
    onchange: null,
    addListener: (callback: MediaQueryCallback) => {
      listeners.add(callback);
    },
    removeListener: (callback: MediaQueryCallback) => {
      listeners.delete(callback);
    },
    addEventListener: (_event: string, callback: MediaQueryCallback) => {
      listeners.add(callback);
    },
    removeEventListener: (_event: string, callback: MediaQueryCallback) => {
      listeners.delete(callback);
    },
    dispatchEvent: () => true,
  };
}

/**
 * Sets up matchMedia mock on window/globalThis
 */
export function setupMatchMediaMock(): void {
  mediaQueryStates.clear();
  mediaQueryListeners.clear();

  const matchMedia = (query: string): MockMediaQueryList => {
    return createMockMediaQueryList(query);
  };

  Object.defineProperty(globalThis, 'matchMedia', {
    value: matchMedia,
    writable: true,
    configurable: true,
  });

  // Also set on window if it exists
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      value: matchMedia,
      writable: true,
      configurable: true,
    });
  }
}

/**
 * Sets the match state for a media query
 *
 * @param query - The media query string
 * @param matches - Whether it should match
 */
export function setMediaQueryMatch(query: string, matches: boolean): void {
  const previousMatches = mediaQueryStates.get(query) ?? false;
  mediaQueryStates.set(query, matches);

  // Notify listeners if the state changed
  if (previousMatches !== matches) {
    const listeners = mediaQueryListeners.get(query);
    if (listeners) {
      const event = {
        matches,
        media: query,
      } as MediaQueryListEvent;

      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

/**
 * Resets all media query states
 */
export function resetMediaQueries(): void {
  mediaQueryStates.clear();
  mediaQueryListeners.clear();
}

/**
 * Common media query presets
 */
export const MediaQueryPresets = {
  /** Prefer dark color scheme */
  DARK_MODE: '(prefers-color-scheme: dark)',
  /** Prefer light color scheme */
  LIGHT_MODE: '(prefers-color-scheme: light)',
  /** Reduced motion preference */
  REDUCED_MOTION: '(prefers-reduced-motion: reduce)',
  /** Mobile viewport */
  MOBILE: '(max-width: 768px)',
  /** Tablet viewport */
  TABLET: '(min-width: 769px) and (max-width: 1024px)',
  /** Desktop viewport */
  DESKTOP: '(min-width: 1025px)',
} as const;

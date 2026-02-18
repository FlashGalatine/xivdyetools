/**
 * Mock Fetcher for testing Cloudflare Workers Service Bindings
 *
 * Provides a mock implementation of the Fetcher interface used for
 * Worker-to-Worker communication via Service Bindings.
 *
 * @example
 * ```typescript
 * const presetsApi = createMockFetcher();
 *
 * // Setup mock responses
 * presetsApi._setupResponse('/api/v1/presets', {
 *   presets: [{ id: '1', name: 'Test Preset' }],
 *   total: 1,
 * });
 *
 * // Use in tests
 * const env = { PRESETS_API: presetsApi as unknown as Fetcher };
 *
 * // Assert calls were made
 * expect(presetsApi._calls).toHaveLength(1);
 * expect(presetsApi._calls[0].url).toContain('/api/v1/presets');
 * expect(presetsApi._calls[0].method).toBe('GET');
 *
 * // Reset between tests
 * presetsApi._reset();
 * ```
 */

/**
 * Recorded fetch call for assertions
 */
export interface MockFetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

/**
 * Mock response configuration
 */
export interface MockResponseConfig {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Configuration options for the mock fetcher
 */
export interface MockFetcherConfig {
  /** Maximum number of calls to keep in history (prevents memory leaks). Default: 1000 */
  maxCallHistory?: number;
}

/**
 * Extended mock Fetcher with test helpers
 */
export interface MockFetcher {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

  /** Array of all fetch calls made (for assertions). Limited to maxCallHistory entries. */
  _calls: MockFetchCall[];

  /** Setup a response for a specific path pattern */
  _setupResponse: (pathPattern: string | RegExp, response: unknown, config?: Omit<MockResponseConfig, 'body'>) => void;

  /** Setup a custom response handler */
  _setupHandler: (handler: (url: string, init?: RequestInit) => Promise<Response> | Response) => void;

  /** Reset calls and response configurations */
  _reset: () => void;

  /** Set default response for unmatched requests */
  _setDefaultResponse: (response: unknown, config?: Omit<MockResponseConfig, 'body'>) => void;

  /** Set the maximum call history size (for memory management) */
  _setMaxCallHistory: (max: number) => void;
}

/** Default maximum call history size */
const DEFAULT_MAX_CALL_HISTORY = 1000;

/**
 * Creates a mock Fetcher for testing Service Bindings
 *
 * The mock tracks all fetch calls and supports configuring
 * responses for specific URL patterns.
 *
 * @param config - Optional configuration for the mock fetcher
 * @returns A mock Fetcher that can be cast to Fetcher
 */
export function createMockFetcher(config?: MockFetcherConfig): MockFetcher {
  const calls: MockFetchCall[] = [];
  const responses = new Map<string | RegExp, MockResponseConfig>();
  let customHandler: ((url: string, init?: RequestInit) => Promise<Response> | Response) | undefined;
  let defaultResponse: MockResponseConfig = {
    status: 200,
    body: { success: true },
  };
  let maxCallHistory = config?.maxCallHistory ?? DEFAULT_MAX_CALL_HISTORY;

  const createResponse = (config: MockResponseConfig): Response => {
    const { status = 200, headers = {}, body } = config;

    const responseBody = body !== undefined ? JSON.stringify(body) : '';

    return new Response(responseBody, {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  };

  const findMatchingResponse = (url: string): MockResponseConfig | undefined => {
    // First try exact string matches
    for (const [pattern, config] of responses.entries()) {
      if (typeof pattern === 'string' && url.includes(pattern)) {
        return config;
      }
    }

    // Then try regex matches
    for (const [pattern, config] of responses.entries()) {
      if (pattern instanceof RegExp && pattern.test(url)) {
        return config;
      }
    }

    return undefined;
  };

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : input.toString();
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const headers: Record<string, string> = {};

      // Extract headers
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          for (const [key, value] of init.headers) {
            headers[key] = value;
          }
        } else {
          Object.assign(headers, init.headers);
        }
      }

      // Record the call (with memory limit enforcement)
      calls.push({
        url,
        method,
        headers,
        body: init?.body?.toString(),
        timestamp: Date.now(),
      });

      // Enforce max history limit (FIFO eviction) to prevent memory leaks
      while (calls.length > maxCallHistory) {
        calls.shift();
      }

      // Use custom handler if provided
      if (customHandler) {
        return customHandler(url, init);
      }

      // Find matching response
      const matchedConfig = findMatchingResponse(url);
      if (matchedConfig) {
        return createResponse(matchedConfig);
      }

      // Return default response
      return createResponse(defaultResponse);
    },

    _calls: calls,

    _setupResponse: (pathPattern: string | RegExp, response: unknown, config?: Omit<MockResponseConfig, 'body'>) => {
      responses.set(pathPattern, {
        ...config,
        body: response,
      });
    },

    _setupHandler: (handler: (url: string, init?: RequestInit) => Promise<Response> | Response) => {
      customHandler = handler;
    },

    _reset: () => {
      calls.length = 0;
      responses.clear();
      customHandler = undefined;
      defaultResponse = { status: 200, body: { success: true } };
    },

    _setDefaultResponse: (response: unknown, config?: Omit<MockResponseConfig, 'body'>) => {
      defaultResponse = {
        ...config,
        body: response,
      };
    },

    _setMaxCallHistory: (max: number) => {
      maxCallHistory = max;
      // Immediately enforce the new limit
      while (calls.length > maxCallHistory) {
        calls.shift();
      }
    },
  };
}

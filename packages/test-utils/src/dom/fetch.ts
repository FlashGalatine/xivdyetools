/**
 * Fetch mock utilities for testing
 *
 * Provides utilities for mocking the global fetch function.
 * For more complex scenarios, consider using MSW (Mock Service Worker).
 *
 * @example
 * ```typescript
 * // Simple mock
 * const mockFetch = setupFetchMock({ data: 'test' });
 *
 * // Make request
 * const response = await fetch('/api/test');
 * const data = await response.json();
 *
 * // Assert
 * expect(data).toEqual({ data: 'test' });
 * expect(mockFetch.calls).toHaveLength(1);
 *
 * // Reset
 * mockFetch.restore();
 * ```
 */

type MockResponseInit = {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
};

/**
 * Mock fetch tracking interface
 */
export interface MockFetchTracker {
  /** All recorded fetch calls */
  calls: Array<{ url: string; init?: RequestInit }>;

  /** Restore original fetch */
  restore: () => void;

  /** Clear recorded calls */
  clear: () => void;

  /** Update mock response */
  setResponse: (body: unknown, init?: MockResponseInit) => void;
}

/**
 * Sets up a simple fetch mock that returns a fixed response
 *
 * @param responseBody - The response body (will be JSON stringified)
 * @param responseInit - Optional response configuration
 * @returns A tracker object with calls array and restore function
 */
export function setupFetchMock(
  responseBody: unknown,
  responseInit: MockResponseInit = {}
): MockFetchTracker {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  let currentBody = responseBody;
  let currentInit = responseInit;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });

    return new Response(JSON.stringify(currentBody), {
      status: currentInit.status ?? 200,
      statusText: currentInit.statusText ?? 'OK',
      headers: {
        'Content-Type': 'application/json',
        ...currentInit.headers,
      },
    });
  };

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    clear: () => {
      calls.length = 0;
    },
    setResponse: (body: unknown, init?: MockResponseInit) => {
      currentBody = body;
      if (init) currentInit = init;
    },
  };
}

/**
 * Sets up a fetch mock with custom handler
 *
 * @param handler - Function to handle fetch requests
 * @returns A tracker object with calls array and restore function
 */
export function setupFetchMockHandler(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response
): MockFetchTracker {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    calls.push({ url, init });
    return handler(url, init);
  };

  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    clear: () => {
      calls.length = 0;
    },
    setResponse: () => {
      // No-op for handler-based mock
    },
  };
}

/**
 * Creates a mock Response object
 *
 * @param body - Response body
 * @param init - Response init options
 * @returns A Response object
 */
export function createMockResponse(
  body: unknown,
  init: MockResponseInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

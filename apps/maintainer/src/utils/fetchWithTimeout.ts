/**
 * Fetch with timeout
 *
 * SECURITY: Prevents hung HTTP requests from blocking the UI indefinitely
 *
 * Wraps the native fetch API with a configurable timeout using AbortController.
 * This ensures that network requests fail gracefully rather than hanging forever.
 */

/**
 * Fetch with automatic timeout
 *
 * Makes an HTTP request that will automatically abort if it exceeds
 * the specified timeout duration. Uses the AbortController API for
 * clean cancellation.
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options (headers, method, body, etc.)
 * @param timeoutMs - Timeout in milliseconds (default: 15000 = 15 seconds)
 * @returns Promise that resolves with the Response
 * @throws Error if the timeout is exceeded or fetch fails
 *
 * @example
 * ```typescript
 * // Default 15s timeout for reads
 * const response = await fetchWithTimeout('/api/colors')
 *
 * // Custom 30s timeout for writes
 * const response = await fetchWithTimeout(
 *   '/api/colors',
 *   { method: 'POST', body: JSON.stringify(data) },
 *   30000
 * )
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  // Create an AbortController for timeout cancellation
  const controller = new AbortController()

  // Set timeout to abort the request
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    // Add the abort signal to fetch options
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    return response
  } catch (error) {
    // Convert abort errors to timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    // Re-throw other errors (network errors, etc.)
    throw error
  } finally {
    // Always clear the timeout to prevent memory leaks
    clearTimeout(timeoutId)
  }
}

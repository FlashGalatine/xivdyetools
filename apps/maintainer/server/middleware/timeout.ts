/**
 * Request timeout middleware
 *
 * SECURITY: Prevents hung connections and resource exhaustion
 *
 * Automatically terminates requests that exceed the timeout duration.
 * This prevents:
 * - Resource exhaustion from slow or hung operations
 * - DoS attacks using slow requests
 * - Poor user experience from indefinite loading states
 */

import { Request, Response, NextFunction } from 'express'

/**
 * Request timeout in milliseconds
 *
 * 30 seconds is generous for a development tool where file I/O
 * operations should complete in < 1 second under normal conditions.
 */
const TIMEOUT_MS = 30000 // 30 seconds

/**
 * Request timeout middleware
 *
 * Sets both socket-level and response-level timeouts to ensure
 * requests don't hang indefinitely. Automatically sends a 408
 * Request Timeout response if the timeout is exceeded.
 *
 * @example
 * ```typescript
 * // Apply early in middleware stack
 * app.use(requestTimeout)
 * app.use(cors())
 * app.use(express.json())
 * // ... other middleware
 * ```
 */
export function requestTimeout(req: Request, res: Response, next: NextFunction): void {
  // Set socket timeout (low-level TCP timeout)
  req.socket.setTimeout(TIMEOUT_MS)

  // Create timeout handler
  const timeoutId = setTimeout(() => {
    // Only respond if headers haven't been sent
    if (!res.headersSent) {
      console.warn(
        `⏱️  Request timeout after ${TIMEOUT_MS}ms: ${req.method} ${req.path}`
      )

      res.status(408).json({
        success: false,
        error: 'Request timeout',
      })
    }
  }, TIMEOUT_MS)

  // Clear timeout when response finishes successfully
  res.on('finish', () => {
    clearTimeout(timeoutId)
  })

  // Clear timeout when connection closes
  req.on('close', () => {
    clearTimeout(timeoutId)
  })

  // Clear timeout on errors (Express will handle the error)
  res.on('error', () => {
    clearTimeout(timeoutId)
  })

  next()
}

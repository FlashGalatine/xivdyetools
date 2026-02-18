import { Request, Response, NextFunction } from 'express'
import { Logger } from '../utils/logger.js'

/**
 * Global error handler middleware
 *
 * SECURITY: Catches unhandled exceptions and prevents error details from leaking to clients.
 *
 * This is a last-resort error handler that catches exceptions not handled by route-specific
 * error handling. It logs the full error server-side (including stack trace) for debugging,
 * but returns only a generic error message to the client to prevent information disclosure.
 *
 * Must be registered LAST in the middleware stack (after all routes).
 *
 * @example
 * // At the end of api.ts, after all routes:
 * app.use(notFoundHandler)
 * app.use(globalErrorHandler)
 */

/**
 * Global error handler middleware
 *
 * SECURITY: Prevents error details and stack traces from leaking to clients.
 *
 * Express error handlers require 4 parameters to be recognized as error handlers.
 * The error parameter MUST be first, even if marked as unused by linters.
 *
 * @param error - The error that was thrown
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (required for error handler signature)
 */
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // SECURITY: Log full error details server-side for debugging
  Logger.error('Unhandled exception', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: error.message,
    stack: error.stack,
    ip: req.ip,
  })

  // SECURITY: Send generic error to client (no details leaked)
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * 404 Not Found handler
 *
 * Catches requests to undefined routes and returns a standard 404 response.
 * Should be registered before the global error handler but after all valid routes.
 *
 * @param req - Express request object
 * @param res - Express response object
 */
export function notFoundHandler(req: Request, res: Response): void {
  // Log 404 for monitoring/debugging
  Logger.warn('Route not found', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  })

  res.status(404).json({
    success: false,
    error: 'Not Found',
  })
}

import { Request, Response, NextFunction } from 'express'
import { Logger } from '../utils/logger.js'

/**
 * Content-Type validation middleware
 *
 * SECURITY: Enforces strict Content-Type checking for mutation operations.
 *
 * Prevents:
 * - Content confusion attacks
 * - MIME sniffing vulnerabilities
 * - Malformed request processing
 *
 * Only validates requests with bodies (POST, PUT, PATCH, DELETE).
 * Requires Content-Type header to be 'application/json' (with optional charset).
 * Skips validation for requests with no body (Content-Length: 0).
 *
 * @example
 * // In api.ts, apply BEFORE express.json()
 * app.use(validateContentType)
 * app.use(express.json({ limit: '10mb' }))
 */

/**
 * Validates that mutation requests have proper Content-Type header
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  // Only validate mutation operations (requests with bodies)
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next()
    return
  }

  // Skip validation if request has no body (Content-Length: 0 or missing)
  const contentLength = req.headers['content-length']
  if (!contentLength || contentLength === '0') {
    next()
    return
  }

  // Get Content-Type header
  const contentType = req.headers['content-type']

  // Validate Content-Type is application/json (with optional charset)
  // Examples of valid Content-Type:
  // - "application/json"
  // - "application/json; charset=utf-8"
  // - "application/json; charset=UTF-8"
  if (!contentType || !contentType.includes('application/json')) {
    // SECURITY: Log invalid Content-Type attempts
    Logger.warn('Invalid Content-Type header', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      contentType: contentType || 'missing',
      ip: req.ip,
    })

    res.status(415).json({
      success: false,
      error: 'Unsupported Media Type',
      details: 'Content-Type must be application/json',
    })
    return
  }

  next()
}

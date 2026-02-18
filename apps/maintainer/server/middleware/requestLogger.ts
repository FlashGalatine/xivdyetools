import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { Logger } from '../utils/logger.js'

/**
 * Request logging middleware
 *
 * SECURITY: Creates an audit trail of all API requests for debugging and security monitoring.
 *
 * Features:
 * - Generates unique request ID for correlation across logs
 * - Logs all incoming requests with method, path, IP, user-agent
 * - Logs all responses with status code and duration
 * - Special AUDIT logging for successful mutation operations (POST/PUT/DELETE)
 * - Attaches requestId to Request object for use in other middleware/routes
 *
 * @example
 * app.use(requestLogger)
 */

/**
 * Extend Express Request type to include requestId
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * Unique identifier for this request, used for log correlation
       */
      requestId?: string
    }
  }
}

/**
 * Request logger middleware
 *
 * Logs all incoming requests and their responses with structured context.
 * Generates unique request ID for correlation.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID for correlation
  // Using 8 random bytes (16 hex chars) provides ~4.3 billion unique IDs
  req.requestId = crypto.randomBytes(8).toString('hex')

  const startTime = Date.now()

  // Log incoming request
  Logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || 'unknown',
  })

  // Intercept response.send() to log when response is sent
  // We need to preserve the original send function and call it after logging
  const originalSend = res.send

  // Override res.send to capture response completion
  res.send = function (body): Response {
    const duration = Date.now() - startTime

    // Build log context
    const logContext = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    }

    // SECURITY: AUDIT log for successful mutations (write operations)
    // These are security-relevant events that modify data
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
      Logger.audit('Mutation operation completed', logContext)
    }
    // WARN log for failed requests (4xx/5xx)
    else if (res.statusCode >= 400) {
      Logger.warn('Request failed', logContext)
    }
    // INFO log for successful read operations
    else {
      Logger.info('Request completed', logContext)
    }

    // Call original send function to actually send the response
    return originalSend.call(this, body)
  }

  next()
}

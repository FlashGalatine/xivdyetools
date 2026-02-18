import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { SessionManager } from '../auth/SessionManager.js'

// Get API key from environment (optional fallback for direct server calls)
const API_KEY = process.env.MAINTAINER_API_KEY

// Create a singleton session manager instance
export const sessionManager = new SessionManager()

/**
 * Timing-safe string comparison
 *
 * Uses crypto.timingSafeEqual to prevent timing attacks on API key comparison.
 * Regular string comparison (=== or !==) can leak information about the key
 * through response time differences.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Type check - both must be strings
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }

  // Length check - crypto.timingSafeEqual requires same length
  if (a.length !== b.length) {
    return false
  }

  // Convert to buffers and use timing-safe comparison
  const bufA = Buffer.from(a, 'utf-8')
  const bufB = Buffer.from(b, 'utf-8')

  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Authentication Middleware
 *
 * Protects mutation endpoints (POST, PUT, DELETE) with session-based authentication.
 * GET requests are allowed without authentication (read-only operations).
 *
 * Authentication methods (checked in order):
 * 1. Session token (X-Session-Token header) - Primary method for frontend
 * 2. API key (X-API-Key header) - Fallback for direct server calls
 *
 * Security features:
 * - Timing-safe API key comparison (prevents timing attacks)
 * - Session token validation with expiration
 * - GET requests skip authentication (read-only)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip authentication for GET requests (read-only operations)
  if (req.method === 'GET') {
    next()
    return
  }

  // Method 1: Check session token (primary authentication method)
  const sessionToken = req.headers['x-session-token'] as string | undefined

  if (sessionToken && sessionManager.validateSession(sessionToken)) {
    // Valid session token - proceed
    next()
    return
  }

  // Method 2: Check API key (fallback for direct server calls)
  if (API_KEY) {
    const providedKey = req.headers['x-api-key'] as string | undefined

    if (providedKey && timingSafeEqual(providedKey, API_KEY)) {
      // Valid API key - proceed
      next()
      return
    }
  }

  // No valid authentication provided
  console.warn(`🚫 Unauthorized ${req.method} request to ${req.path}`)
  res.status(401).json({
    success: false,
    error: 'Unauthorized',
  })
}

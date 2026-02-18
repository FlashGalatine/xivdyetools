/**
 * Rate limiting middleware for API endpoints
 *
 * SECURITY: Protects against DoS attacks and resource exhaustion
 *
 * Three-tiered rate limiting strategy:
 * - Global: Broad protection for all endpoints
 * - Write: Stricter limits for file mutation operations
 * - Session: Prevents session token spam
 */

import rateLimit from 'express-rate-limit'

/**
 * Global rate limiter - applies to all API endpoints
 *
 * Generous limit appropriate for a development tool while
 * still preventing accidental DoS from runaway loops or scripts.
 *
 * Limit: 1000 requests per 15 minutes (~1 request/second sustained)
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable deprecated `X-RateLimit-*` headers
})

/**
 * Write operations rate limiter - applies to POST/PUT/DELETE endpoints
 *
 * Stricter limits for file mutation operations to prevent
 * excessive file writes and ensure data consistency.
 *
 * Limit: 30 requests per 1 minute
 */
export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 write requests per minute
  message: {
    success: false,
    error: 'Too many write requests, please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, not just successful ones
})

/**
 * Session creation rate limiter - applies to session token generation
 *
 * Prevents session token spam while allowing legitimate reconnections.
 * Normal usage = 1 session per browser session; 10 allows for retries.
 *
 * Limit: 10 requests per 15 minutes
 */
export const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 session creation requests per window
  message: {
    success: false,
    error: 'Too many session requests, please wait.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

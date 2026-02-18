import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { sanitizeZodError } from './errorSanitizer.js'

/**
 * Express middleware for validating request bodies using Zod schemas
 *
 * @param schema - Zod schema to validate the request body against
 * @returns Express middleware function
 *
 * @example
 * app.post('/api/colors', validateBody(DyeArraySchema), async (req, res) => {
 *   // req.body is now validated and typed
 * })
 */
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate the request body
      // If successful, replace req.body with the validated/transformed data
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        // SECURITY: Log detailed error server-side for debugging
        console.warn('🚫 Validation error:', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          errors: error.errors, // Full error details in logs
        })

        // SECURITY: Send sanitized errors to client (no user input exposure)
        const sanitizedErrors = sanitizeZodError(error)

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: sanitizedErrors, // Safe for client
        })
      } else {
        // Handle unexpected errors
        // SECURITY: Log details server-side, send generic message to client
        console.error('❌ Unexpected validation error:', {
          path: req.path,
          method: req.method,
          error,
        })

        res.status(500).json({
          success: false,
          error: 'Internal server error',
        })
      }
    }
  }
}

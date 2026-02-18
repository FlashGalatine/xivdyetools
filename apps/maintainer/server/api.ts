/**
 * Express server for file operations
 * Handles reading/writing to xivdyetools-core data files
 *
 * SECURITY: This is a development-only tool. Do NOT deploy to production.
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { DyeArraySchema, LocaleDataSchema } from './schemas.js'
import { validateBody } from './middleware/validation.js'
// MAINT-REF-003 FIX: Import from centralized constants
import { LOCALE_CODES } from '../src/utils/constants.js'
import { requireAuth, sessionManager } from './middleware/auth.js'
import { validateBasePaths, validateFilePath } from './utils/pathValidation.js'
import { globalLimiter, writeLimiter, sessionLimiter } from './middleware/rateLimiting.js'
import { requestTimeout } from './middleware/timeout.js'
import { requestLogger } from './middleware/requestLogger.js'
import { Logger } from './utils/logger.js'
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { validateContentType } from './middleware/contentType.js'

// ============================================================================
// SECURITY: Production Environment Guard
// ============================================================================
if (process.env.NODE_ENV === 'production') {
  console.error('╔══════════════════════════════════════════════════════════════╗')
  console.error('║  ERROR: Maintainer service must NOT run in production!       ║')
  console.error('║  This tool is for local development only.                    ║')
  console.error('╚══════════════════════════════════════════════════════════════╝')
  process.exit(1)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// ============================================================================
// SECURITY: Request Timeout Middleware
// ============================================================================
// Apply timeout FIRST to prevent hung connections (30s timeout)
app.use(requestTimeout)

// ============================================================================
// SECURITY: Request Logging Middleware
// ============================================================================
// Apply request logging EARLY for full request lifecycle tracking
// Generates unique request ID for log correlation and audit trail
app.use(requestLogger)

// ============================================================================
// SECURITY: Global Rate Limiting
// ============================================================================
// Apply global rate limiter to all endpoints (1000 requests / 15 minutes)
app.use(globalLimiter)

// SECURITY: Restrict CORS to localhost only
app.use(
  cors({
    origin: 'http://localhost:5174',
    credentials: false,
  })
)

// ============================================================================
// SECURITY: Content-Type Validation
// ============================================================================
// Validate Content-Type for mutation operations BEFORE parsing JSON
// Prevents MIME confusion attacks and ensures proper request format
app.use(validateContentType)

app.use(express.json({ limit: '10mb' }))

// ============================================================================
// SECURITY: Authentication Middleware
// ============================================================================
// Apply session-based authentication to all /api routes
// (Mutation operations require valid session token or API key)
app.use('/api', requireAuth)

// Path to xivdyetools-core (sibling directory)
const CORE_PATH = path.resolve(__dirname, '../../xivdyetools-core')
const COLORS_PATH = path.join(CORE_PATH, 'src/data/colors_xiv.json')
const LOCALES_PATH = path.join(CORE_PATH, 'src/data/locales')

// Server configuration
const PORT = parseInt(process.env.PORT || '3001', 10)

// Utility to read JSON file
async function readJsonFile<T>(filePath: string): Promise<T> {
  const data = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(data) as T
}

// Utility to write JSON file with consistent formatting
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  const formatted = JSON.stringify(data, null, 2)
  await fs.writeFile(filePath, formatted + '\n', 'utf-8')
}

// Health check
// SECURITY: Does not expose corePath to prevent information disclosure
// Path validation happens at startup (see validateBasePaths below)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// POST /api/auth/session - Create new session token
// SECURITY: Rate limit session creation to prevent token spam (10 requests / 15 minutes)
app.post('/api/auth/session', sessionLimiter, (req, res) => {
  const token = sessionManager.generateSession()
  res.json({ success: true, token })
})

// GET /api/colors - Read colors_xiv.json
app.get('/api/colors', async (req, res) => {
  try {
    const data = await readJsonFile(COLORS_PATH)
    res.json(data)
  } catch (error) {
    Logger.error('Error reading colors file', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    })
    res.status(500).json({ success: false, error: 'Failed to read colors file' })
  }
})

// POST /api/colors - Write colors_xiv.json
// SECURITY: Rate limit write operations (30 requests / 1 minute)
// SECURITY: Input validation with Zod schema
app.post('/api/colors', writeLimiter, validateBody(DyeArraySchema), async (req, res) => {
  try {
    await writeJsonFile(COLORS_PATH, req.body)
    res.json({ success: true })
  } catch (error) {
    Logger.error('Error writing colors file', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    })
    res.status(500).json({ success: false, error: 'Failed to write colors file' })
  }
})

// GET /api/locale/:code - Read locale JSON file
app.get('/api/locale/:code', async (req, res) => {
  const { code } = req.params
  // MAINT-REF-003 FIX: Use centralized constant
  const validCodes = [...LOCALE_CODES]

  if (!validCodes.includes(code)) {
    return res.status(400).json({ success: false, error: 'Invalid locale code' })
  }

  try {
    const filePath = path.join(LOCALES_PATH, `${code}.json`)

    // SECURITY: Validate path doesn't escape LOCALES_PATH
    if (!validateFilePath(filePath, LOCALES_PATH)) {
      return res.status(400).json({ success: false, error: 'Invalid file path' })
    }

    const data = await readJsonFile(filePath)
    res.json(data)
  } catch (error) {
    Logger.error('Error reading locale file', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      localeCode: code,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    })
    res.status(500).json({ success: false, error: `Failed to read locale file: ${code}` })
  }
})

// POST /api/locale/:code - Write locale JSON file
// SECURITY: Rate limit write operations (30 requests / 1 minute)
// SECURITY: Input validation with Zod schema
app.post('/api/locale/:code', writeLimiter, validateBody(LocaleDataSchema), async (req, res) => {
  const { code } = req.params
  // MAINT-REF-003 FIX: Use centralized constant
  const validCodes = [...LOCALE_CODES]

  if (!validCodes.includes(code)) {
    return res.status(400).json({ success: false, error: 'Invalid locale code' })
  }

  try {
    const filePath = path.join(LOCALES_PATH, `${code}.json`)

    // SECURITY: Validate path doesn't escape LOCALES_PATH
    if (!validateFilePath(filePath, LOCALES_PATH)) {
      return res.status(400).json({ success: false, error: 'Invalid file path' })
    }

    await writeJsonFile(filePath, req.body)
    res.json({ success: true })
  } catch (error) {
    Logger.error('Error writing locale file', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      localeCode: code,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    })
    res.status(500).json({ success: false, error: `Failed to write locale file: ${code}` })
  }
})

// GET /api/validate/:itemId - Check if itemID already exists
app.get('/api/validate/:itemId', async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10)
    if (isNaN(itemId)) {
      return res.status(400).json({ success: false, error: 'Invalid item ID' })
    }

    const dyes = await readJsonFile<Array<{ itemID: number | null }>>(COLORS_PATH)
    const exists = dyes.some((dye) => dye.itemID === itemId)
    res.json({ exists })
  } catch (error) {
    Logger.error('Error validating item ID', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      itemId: req.params.itemId,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    })
    res.status(500).json({ success: false, error: 'Failed to validate item ID' })
  }
})

// GET /api/locales/labels - Get all locale labels (for prefix stripping)
app.get('/api/locales/labels', async (req, res) => {
  try {
    const labels: Record<string, string> = {}
    // MAINT-REF-003 FIX: Use centralized constant
    const codes = [...LOCALE_CODES]

    for (const code of codes) {
      const filePath = path.join(LOCALES_PATH, `${code}.json`)
      const data = await readJsonFile<{ labels: { dye: string } }>(filePath)
      labels[code] = data.labels.dye
    }

    res.json(labels)
  } catch (error) {
    Logger.error('Error reading locale labels', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    })
    res.status(500).json({ success: false, error: 'Failed to read locale labels' })
  }
})

// ============================================================================
// SECURITY: Error Handling Middleware (MUST BE LAST)
// ============================================================================
// 404 handler for undefined routes
app.use(notFoundHandler)

// Global error handler catches unhandled exceptions
// SECURITY: Logs full error server-side, returns generic message to client
app.use(globalErrorHandler)

// ============================================================================
// SECURITY: Startup Path Validation & Server Launch
// ============================================================================
// Validate paths before starting server
validateBasePaths(CORE_PATH, COLORS_PATH, LOCALES_PATH)
  .then(() => {
    // SECURITY: Bind to 127.0.0.1 only (localhost, not accessible from network)
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║  XIV Dye Tools - Maintainer API Server               ║
╠══════════════════════════════════════════════════════╣
║  Server running at: http://127.0.0.1:${PORT}            ║
║  Bound to: 127.0.0.1 (localhost only)                ║
║  Core path: ${CORE_PATH.slice(-40).padStart(40)}  ║
╚══════════════════════════════════════════════════════╝
      `)
    })
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  })

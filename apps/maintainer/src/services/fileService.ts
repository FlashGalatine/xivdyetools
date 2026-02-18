/**
 * File Service - API client for the Express backend server
 */

import type { Dye, LocaleData, LocaleCode, WriteResult } from '@/types'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
// MAINT-REF-003 FIX: Import from centralized constants
import { LOCALE_CODES } from '@/utils/constants'

const SERVER_BASE = 'http://localhost:3001/api'

/**
 * Session token for authentication
 * Stored in memory only (not persisted)
 * Obtained from POST /api/auth/session on server health check
 *
 * MAINT-BUG-005 FIX: Token is now invalidated on 401/403 responses
 * to handle server restarts and token expiration.
 */
let sessionToken: string | null = null

/**
 * Invalidate the cached session token
 * Called when the server returns 401/403 to force a new session
 */
export function invalidateSession(): void {
  sessionToken = null
  console.warn('Session token invalidated - will request new token on next mutation')
}

/**
 * Get or create a session token
 * @param forceRefresh - If true, ignore cached token and request a new one
 * @returns Session token for authentication
 */
async function getSessionToken(forceRefresh = false): Promise<string> {
  // Return cached token if available and not forcing refresh
  if (sessionToken && !forceRefresh) {
    return sessionToken
  }

  // Clear any stale token before requesting new one
  sessionToken = null

  // Request a new session token from the server
  try {
    const response = await fetchWithTimeout(
      `${SERVER_BASE}/auth/session`,
      {
        method: 'POST',
      },
      15000 // 15s timeout
    )

    if (!response.ok) {
      throw new Error('Failed to create session')
    }

    const data = await response.json()
    sessionToken = data.token
    return sessionToken!
  } catch (error) {
    console.error('Failed to get session token:', error)
    throw error
  }
}

/**
 * Create headers for mutation requests (includes session token)
 */
async function getMutationHeaders(): Promise<HeadersInit> {
  // Ensure we have a valid token
  const token = await getSessionToken()
  return {
    'Content-Type': 'application/json',
    'X-Session-Token': token,
  }
}

/**
 * Execute a mutation request with automatic token refresh on 401/403
 *
 * MAINT-BUG-005 FIX: If the server returns 401/403 (expired/invalid token),
 * this function automatically refreshes the token and retries once.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const token = await getSessionToken()
  const headers = {
    'Content-Type': 'application/json',
    'X-Session-Token': token,
    ...options.headers,
  }

  const response = await fetchWithTimeout(url, { ...options, headers }, timeout)

  // If unauthorized, invalidate token, get a new one, and retry once
  if (response.status === 401 || response.status === 403) {
    console.warn('Session token rejected, refreshing...')
    invalidateSession()

    const newToken = await getSessionToken(true)
    const retryHeaders = {
      'Content-Type': 'application/json',
      'X-Session-Token': newToken,
      ...options.headers,
    }

    return fetchWithTimeout(url, { ...options, headers: retryHeaders }, timeout)
  }

  return response
}

/**
 * Check if the server is running
 * Also establishes a session for authenticated mutations
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${SERVER_BASE}/health`, {}, 15000)
    const data = await response.json()

    if (data.status === 'ok') {
      // Establish session on successful health check
      await getSessionToken()
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Read colors_xiv.json
 */
export async function readColorsJson(): Promise<Dye[]> {
  const response = await fetchWithTimeout(`${SERVER_BASE}/colors`, {}, 15000)
  if (!response.ok) {
    throw new Error('Failed to read colors file')
  }
  return response.json()
}

/**
 * Write colors_xiv.json
 */
export async function writeColorsJson(dyes: Dye[]): Promise<WriteResult> {
  const response = await fetchWithRetry(
    `${SERVER_BASE}/colors`,
    {
      method: 'POST',
      body: JSON.stringify(dyes),
    },
    30000 // 30s timeout for file write operations
  )
  return response.json()
}

/**
 * Read a locale JSON file
 */
export async function readLocaleJson(locale: LocaleCode): Promise<LocaleData> {
  const response = await fetchWithTimeout(`${SERVER_BASE}/locale/${locale}`, {}, 15000)
  if (!response.ok) {
    throw new Error(`Failed to read locale file: ${locale}`)
  }
  return response.json()
}

/**
 * Write a locale JSON file
 */
export async function writeLocaleJson(
  locale: LocaleCode,
  data: LocaleData
): Promise<WriteResult> {
  const response = await fetchWithRetry(
    `${SERVER_BASE}/locale/${locale}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    30000 // 30s timeout for file write operations
  )
  return response.json()
}

/**
 * Check if an item ID already exists
 */
export async function checkDuplicateItemId(itemId: number): Promise<boolean> {
  const response = await fetchWithTimeout(`${SERVER_BASE}/validate/${itemId}`, {}, 15000)
  if (!response.ok) {
    throw new Error('Failed to validate item ID')
  }
  const data = await response.json()
  return data.exists
}

/**
 * Get all locale labels (for prefix stripping)
 */
export async function getLocaleLabels(): Promise<Record<string, string>> {
  const response = await fetchWithTimeout(`${SERVER_BASE}/locales/labels`, {}, 15000)
  if (!response.ok) {
    throw new Error('Failed to get locale labels')
  }
  return response.json()
}

/**
 * Add a new dye to the database
 */
export async function addDyeToDatabase(
  dye: Dye,
  localeNames: Record<LocaleCode, string>
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []

  try {
    // 1. Read current colors
    const dyes = await readColorsJson()

    // 2. Add new dye
    dyes.push(dye)

    // 3. Write updated colors
    const colorsResult = await writeColorsJson(dyes)
    if (!colorsResult.success) {
      errors.push(colorsResult.error || 'Failed to write colors file')
      return { success: false, errors }
    }

    // 4. Update each locale file
    // MAINT-REF-003 FIX: Use centralized constant
    const locales: LocaleCode[] = [...LOCALE_CODES]
    for (const locale of locales) {
      try {
        const localeData = await readLocaleJson(locale)

        // Add dye name
        if (dye.itemID !== null) {
          localeData.dyeNames[String(dye.itemID)] = localeNames[locale] || ''
        }

        // Update meta
        localeData.meta.dyeCount = Object.keys(localeData.dyeNames).length
        localeData.meta.generated = new Date().toISOString()

        // Write updated locale
        const localeResult = await writeLocaleJson(locale, localeData)
        if (!localeResult.success) {
          errors.push(`Failed to update ${locale} locale: ${localeResult.error}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to update ${locale} locale: ${message}`)
      }
    }

    return { success: errors.length === 0, errors }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(message)
    return { success: false, errors }
  }
}

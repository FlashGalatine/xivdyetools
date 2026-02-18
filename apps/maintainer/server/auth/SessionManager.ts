import crypto from 'crypto'

/**
 * Session data structure
 */
interface Session {
  token: string
  createdAt: Date
}

/**
 * SessionManager
 *
 * Manages ephemeral session tokens for the maintainer tool.
 * Sessions are stored in memory and expire after 24 hours.
 *
 * Security features:
 * - Tokens are generated using crypto.randomBytes (cryptographically secure)
 * - Sessions automatically expire after SESSION_DURATION_MS
 * - Expired sessions are cleaned up periodically
 * - All sessions are cleared on server restart (intentional for dev tool)
 */
export class SessionManager {
  private sessions = new Map<string, Session>()
  private readonly SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

  /**
   * Generate a new session token
   *
   * @returns A 64-character hex string token
   */
  generateSession(): string {
    // Generate a cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex')

    // Store the session
    this.sessions.set(token, {
      token,
      createdAt: new Date(),
    })

    // Clean up expired sessions to prevent memory leaks
    this.cleanupExpiredSessions()

    console.log(`✓ Generated new session token (${this.sessions.size} active sessions)`)

    return token
  }

  /**
   * Validate a session token
   *
   * @param token - The session token to validate
   * @returns true if the session is valid and not expired, false otherwise
   */
  validateSession(token: string): boolean {
    const session = this.sessions.get(token)

    // Session doesn't exist
    if (!session) {
      return false
    }

    // Check if session has expired
    const isExpired = Date.now() - session.createdAt.getTime() > this.SESSION_DURATION_MS

    if (isExpired) {
      // Remove expired session
      this.sessions.delete(token)
      console.warn('⚠️  Session expired and removed')
      return false
    }

    return true
  }

  /**
   * Remove all expired sessions
   * Called periodically to prevent memory leaks
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now()
    let removedCount = 0

    for (const [token, session] of this.sessions.entries()) {
      if (now - session.createdAt.getTime() > this.SESSION_DURATION_MS) {
        this.sessions.delete(token)
        removedCount++
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} expired session(s)`)
    }
  }

  /**
   * Clear all sessions
   * Useful for testing or manual session reset
   */
  clearAll(): void {
    const count = this.sessions.size
    this.sessions.clear()
    console.log(`🧹 Cleared all ${count} session(s)`)
  }

  /**
   * Get the number of active sessions
   *
   * @returns Number of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size
  }
}

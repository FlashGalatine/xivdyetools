/**
 * Stoat message context tracker.
 *
 * Tracks which dye/command each bot message corresponds to,
 * enabling reaction-based interactions (e.g., 🎨 → show HEX value).
 */

/** Context stored for each bot message */
export interface MessageContext {
  /** The command that generated this message */
  command: string;
  /** Associated dye ID, if applicable */
  dyeId?: number;
  /** Associated dye hex, if applicable */
  dyeHex?: string;
  /** Additional context data */
  data?: Record<string, unknown>;
  /** When this context was created */
  createdAt: number;
}

/** Maximum number of contexts to track */
const MAX_CONTEXTS = 500;

/** TTL for message contexts (1 hour) */
const CONTEXT_TTL_MS = 60 * 60 * 1000;

/**
 * Simple LRU-ish context store for message → dye mapping.
 * Used to handle reaction interactions on bot messages.
 */
export class MessageContextStore {
  private readonly contexts = new Map<string, MessageContext>();

  /**
   * Store context for a bot message.
   */
  set(messageId: string, context: MessageContext): void {
    // Evict oldest entries if at capacity
    if (this.contexts.size >= MAX_CONTEXTS) {
      const oldest = this.contexts.keys().next().value;
      if (oldest) this.contexts.delete(oldest);
    }
    this.contexts.set(messageId, context);
  }

  /**
   * Get context for a message, if it exists and hasn't expired.
   */
  get(messageId: string): MessageContext | undefined {
    const ctx = this.contexts.get(messageId);
    if (!ctx) return undefined;

    // Check TTL
    if (Date.now() - ctx.createdAt > CONTEXT_TTL_MS) {
      this.contexts.delete(messageId);
      return undefined;
    }

    return ctx;
  }

  /**
   * Delete context for a message.
   */
  delete(messageId: string): void {
    this.contexts.delete(messageId);
  }

  /**
   * Get the current number of tracked contexts.
   */
  get size(): number {
    return this.contexts.size;
  }
}

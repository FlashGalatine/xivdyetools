/**
 * Environment bindings for image-worker.
 *
 * Deliberately empty of storage bindings: this Worker is stateless. It holds no
 * secrets, no KV, no D1 — it decodes images and returns pixels.
 *
 * @module types
 */

export interface Env {
  /** Set to "production" by [env.production]; absent in dev. */
  ENVIRONMENT?: string;
}

import { WorkerEntrypoint } from 'cloudflare:workers';
import type { Env } from '../types.js';
import { lookupStoredIdentity, validateSession } from './identity-service.js';
import type { LookupResult, SessionResult } from './identity-contract.js';

/** Named service-binding capability. No corresponding public HTTP routes. */
export class IdentityLookup extends WorkerEntrypoint<Env> {
  lookupStoredIdentity(input: unknown): Promise<LookupResult> {
    return lookupStoredIdentity(this.env.DB, input);
  }
  validateSession(input: unknown): Promise<SessionResult> {
    return validateSession(this.env.DB, input);
  }
}

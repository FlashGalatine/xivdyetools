import { WorkerEntrypoint } from 'cloudflare:workers';
import type { Env } from '../types.js';
import { ContinuityError, validateOperationKey } from './ban-continuity-contract.js';
import {
  applyContinuity,
  getContinuityOperation,
  acknowledgeContinuity,
} from './ban-continuity-service.js';

/** Trusted named service-binding capability; no public HTTP lookup/apply route. */
export class BanContinuity extends WorkerEntrypoint<Env> {
  async apply(input: unknown): Promise<unknown> {
    return this.invoke(input, () => applyContinuity(this.env.DB, input));
  }
  async getOperation(input: unknown): Promise<unknown> {
    return this.invoke(input, () => getContinuityOperation(this.env.DB, input));
  }
  async acknowledge(input: unknown): Promise<unknown> {
    return this.invoke(input, () => acknowledgeContinuity(this.env.DB, input));
  }
  private async invoke(input: unknown, call: () => Promise<unknown>): Promise<unknown> {
    try {
      return await call();
    } catch (error) {
      const status = error instanceof ContinuityError ? error.code : 'unavailable';
      // Return correlation only for well-shaped protocol keys. Never return a
      // raw request, SQL exception, identity list or arbitrary exception text.
      try {
        const { operationId, payloadHash } = validateOperationKey(
          typeof input === 'object' && input !== null
            ? {
                operationId: (input as Record<string, unknown>).operationId,
                payloadHash: (input as Record<string, unknown>).payloadHash,
              }
            : null,
        );
        return { v: 1, operationId, payloadHash, status };
      } catch {
        return { v: 1, status };
      }
    }
  }
}

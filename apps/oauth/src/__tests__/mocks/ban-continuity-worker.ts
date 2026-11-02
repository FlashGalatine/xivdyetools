import { WorkerEntrypoint } from 'cloudflare:workers';
import {
  validateContinuityRequest,
  type ContinuityRequest,
  type AppliedReceipt,
} from '../../services/identity-contract.js';

/** Boundary stub only: no claim to implement the later presets ban transaction. */
export class BanContinuity extends WorkerEntrypoint {
  private receipts = new Map<string, AppliedReceipt>();
  private acknowledgements = new Map<string, number>();
  async apply(input: unknown) {
    const request = await validateContinuityRequest(input, Math.floor(Date.now() / 1000));
    const existing = this.receipts.get(request.operationId);
    if (existing && existing.payloadHash !== request.payloadHash)
      return {
        v: 1,
        operationId: request.operationId,
        payloadHash: request.payloadHash,
        status: 'conflict',
      };
    const receipt: AppliedReceipt = existing ?? {
      v: 1,
      operationId: request.operationId,
      payloadHash: request.payloadHash,
      status: 'applied',
      matchedBanCount: 0,
    };
    this.receipts.set(request.operationId, receipt);
    return receipt;
  }
  getOperation(input: Pick<ContinuityRequest, 'operationId' | 'payloadHash'>) {
    return this.receipts.get(input.operationId) ?? { v: 1, ...input, status: 'missing' };
  }
  acknowledge(
    input: Pick<ContinuityRequest, 'operationId' | 'payloadHash'> & {
      outcome: 'complete' | 'aborted';
    },
  ) {
    const acknowledgedAt =
      this.acknowledgements.get(input.operationId) ?? Math.floor(Date.now() / 1000);
    this.acknowledgements.set(input.operationId, acknowledgedAt);
    return { v: 1, ...input, status: 'acknowledged', acknowledgedAt };
  }
}
export default { fetch: () => new Response('No public RPC', { status: 404 }) };

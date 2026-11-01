import { WorkerEntrypoint } from 'cloudflare:workers';
import type { ContinuityRequest } from '../../services/identity-contract.js';
let mode = 'normal';
let completed = 0;
const receipts = new Map<string, unknown>();
const attempts: ContinuityRequest[] = [];
export class TimeoutContinuity extends WorkerEntrypoint {
  async apply(input: ContinuityRequest) {
    attempts.push(structuredClone(input));
    const finish = async () => {
      if (mode.startsWith('late')) await new Promise((resolve) => setTimeout(resolve, 5500));
      const receipt = {
        v: 1,
        operationId: input.operationId,
        payloadHash: input.payloadHash,
        status: 'applied',
        matchedBanCount: 0,
      };
      receipts.set(input.operationId, receipt);
      completed++;
      if (mode === 'late-reject') throw new Error('synthetic response lost');
      return receipt;
    };
    const task = finish();
    // Intentionally keep a synthetic remote effect alive after the caller abandons the reply.
    this.ctx.waitUntil(task.catch(() => {}));
    return task;
  }
  async getOperation(input: { operationId: string; payloadHash: string }) {
    if (mode === 'stall-get') await new Promise((resolve) => setTimeout(resolve, 60000));
    return receipts.get(input.operationId) ?? { v: 1, ...input, status: 'missing' };
  }
  async acknowledge(input: { operationId: string; payloadHash: string; outcome: string }) {
    if (mode === 'stall-ack') await new Promise((resolve) => setTimeout(resolve, 60000));
    return {
      v: 1,
      ...input,
      status: 'acknowledged',
      acknowledgedAt: Math.floor(Date.now() / 1000),
    };
  }
}
export default {
  async fetch(request: Request) {
    if (request.method === 'POST') mode = await request.text();
    return Response.json({ mode, completed, attempts });
  },
};

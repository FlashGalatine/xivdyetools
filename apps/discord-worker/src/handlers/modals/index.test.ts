/**
 * Tests for modal handlers index exports
 *
 * Note: Modal handlers (handlePresetRejectionModal, handlePresetRevertModal, etc.)
 * have been moved to xivdyetools-moderation-worker. The modals/index.ts now exports
 * nothing, as all modal handling is done by the moderation worker.
 */
import { describe, it, expect } from 'vitest';

describe('modals/index exports', () => {
    it('exports empty module (modal handlers moved to moderation-worker)', async () => {
        const modals = await import('./index.js');

        // Modal handlers have been moved to xivdyetools-moderation-worker
        // This module now exports nothing
        expect(Object.keys(modals)).toHaveLength(0);
    });
});

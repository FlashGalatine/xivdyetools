/**
 * XIV Dye Tools - tool-handoff tests
 *
 * These pin the two properties every past instance of this bug broke: the KEY
 * each receiver reads, and that the VALUE is a stainID rather than an itemID.
 *
 * @module shared/__tests__/tool-handoff.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const navigateTo = vi.fn();
vi.mock('@services/index', () => ({
  RouterService: {
    navigateTo: (...args: unknown[]) => navigateTo(...args),
  },
}));

import type { Dye } from '@xivdyetools/types';
import { HANDOFF_PARAM, handoffTo, type HandoffTarget } from '../tool-handoff';

/** Dalamud Red's real ids: the ranges are disjoint, which is what makes the bug detectable. */
const DYE = { name: 'Dalamud Red', stainID: 45, itemID: 30116 } as unknown as Dye;
const CUSTOM = { name: 'Custom', stainID: null, itemID: 0 } as unknown as Dye;

describe('tool-handoff', () => {
  beforeEach(() => navigateTo.mockReset());

  describe('the param each receiver actually reads', () => {
    // Read off the consumers, not assumed. harmony-tool reads
    // `params.get('dye') ?? params.get('dyeId')`; comparison-tool and
    // accessibility-tool read `params.dyes`; mixer-tool reads `params.dyeA`.
    const EXPECTED: Record<HandoffTarget, string> = {
      harmony: 'dye',
      comparison: 'dyes',
      accessibility: 'dyes',
      mixer: 'dyeA',
    };

    it.each(Object.keys(EXPECTED) as HandoffTarget[])('%s', (tool) => {
      expect(HANDOFF_PARAM[tool]).toBe(EXPECTED[tool]);
    });

    it('never emits `add`, which no tool in this app reads', () => {
      expect(Object.values(HANDOFF_PARAM)).not.toContain('add');
    });
  });

  describe('the value', () => {
    it.each(Object.keys(HANDOFF_PARAM) as HandoffTarget[])(
      'sends %s the stainID, never the itemID',
      (tool) => {
        handoffTo(tool, DYE);

        expect(navigateTo).toHaveBeenCalledTimes(1);
        const [target, params] = navigateTo.mock.calls[0] as [string, Record<string, string>];
        expect(target).toBe(tool);

        const value = params[HANDOFF_PARAM[tool]];
        expect(value).toBe('45');
        // The load-bearing half: ShareService.resolveSharedDye refuses every id
        // >= 5729, and all 125 dyes have itemIDs in 5729-48227. An itemID here
        // does not degrade — it fails for every dye, every time.
        expect(value).not.toBe('30116');
        expect(Number(value)).toBeLessThan(5729);
      }
    );

    it('does not navigate at all for a dye with no stainID', () => {
      handoffTo('harmony', CUSTOM);
      expect(navigateTo).not.toHaveBeenCalled();
    });
  });
});

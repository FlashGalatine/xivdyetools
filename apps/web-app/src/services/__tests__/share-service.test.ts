/**
 * XIV Dye Tools - ShareService Unit Tests
 *
 * Pins the 5.0 share-URL grammar: every dye-class slot keys on a stainID,
 * bare colours travel as the slot's `hex*` param, and the two are mutually
 * exclusive per slot. The gradient (`start`/`end` vs `hexStart`/`hexEnd`)
 * and mixer (`dyeA`/`dyeB` vs `hexA`/`hexB`) rules mirror harmony's
 * (`dye` vs `hex`).
 *
 * @module services/__tests__/share-service.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDyes } from '../../__tests__/mocks/services';

const { mockGetByStainId, mockToastError } = vi.hoisted(() => ({
  mockGetByStainId: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('../toast-service', () => ({
  ToastService: {
    error: mockToastError,
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// The share URL carries the sharer's locale (og-worker localizes the unfurl
// from `?lang=` and from nothing else — OG-I18N-001); tests flip it here.
const langState = { locale: 'en' };
vi.mock('../language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    getCurrentLocale: () => langState.locale,
  },
}));

vi.mock('../dye-service-wrapper', () => ({
  dyeService: {
    getByStainId: mockGetByStainId,
  },
}));

vi.mock('@shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ShareService } from '../share-service';

describe('ShareService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetByStainId.mockImplementation((id: number) => mockDyes.find((d) => d.stainID === id));
  });

  // ==========================================================================
  // validateShareParams — the per-slot "stainID XOR hex" rule
  // ==========================================================================

  describe('validateShareParams', () => {
    describe('swatch', () => {
      it('accepts a cell address (slot + i) — what swatch-tool writes', () => {
        expect(
          ShareService.validateShareParams({
            tool: 'swatch',
            params: { slot: 'eyes', i: 12, algo: 'ciede2000' },
          })
        ).toEqual([]);
        // i = 0 is a real cell
        expect(
          ShareService.validateShareParams({ tool: 'swatch', params: { slot: 'hair', i: 0 } })
        ).toEqual([]);
      });

      it('accepts a bare colour on hex, or the legacy color alias', () => {
        expect(
          ShareService.validateShareParams({ tool: 'swatch', params: { hex: 'aabbcc' } })
        ).toEqual([]);
        expect(
          ShareService.validateShareParams({ tool: 'swatch', params: { color: '#aabbcc' } })
        ).toEqual([]);
      });

      it('rejects a link with neither a cell nor a colour, and a malformed hex', () => {
        expect(
          ShareService.validateShareParams({ tool: 'swatch', params: { algo: 'ciede2000' } })
        ).toEqual(['Missing required parameter: slot + i (or hex)']);
        expect(
          ShareService.validateShareParams({ tool: 'swatch', params: { hex: 'zzz' } })
        ).toEqual(['Invalid hex colour: zzz']);
        // slot without an index is not an address
        expect(
          ShareService.validateShareParams({ tool: 'swatch', params: { slot: 'eyes' } })
        ).toEqual(['Missing required parameter: slot + i (or hex)']);
      });
    });

    describe('gradient', () => {
      it('accepts two stainID endpoints', () => {
        expect(
          ShareService.validateShareParams({ tool: 'gradient', params: { start: 1, end: 2 } })
        ).toEqual([]);
      });

      it('accepts two bare-colour endpoints', () => {
        expect(
          ShareService.validateShareParams({
            tool: 'gradient',
            params: { hexStart: 'aabbcc', hexEnd: '112233' },
          })
        ).toEqual([]);
      });

      it('accepts a mixed pair: one dye, one bare colour', () => {
        expect(
          ShareService.validateShareParams({
            tool: 'gradient',
            params: { start: 1, hexEnd: 'abc' },
          })
        ).toEqual([]);
      });

      it('rejects the pre-fix encoding of a custom endpoint (stainID 0)', () => {
        // `stainID ?? 0` was what the tool used to emit for a custom colour;
        // 0 is not a stainID and must never validate.
        const errors = ShareService.validateShareParams({
          tool: 'gradient',
          params: { start: 0, end: 2 },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/start/);
      });

      it('rejects a slot with neither its stainID nor its hex', () => {
        const errors = ShareService.validateShareParams({ tool: 'gradient', params: {} });
        expect(errors).toHaveLength(2);
        expect(errors[0]).toMatch(/start/);
        expect(errors[1]).toMatch(/end/);
      });

      it('rejects a slot carrying both its stainID and its hex', () => {
        const errors = ShareService.validateShareParams({
          tool: 'gradient',
          params: { start: 1, hexStart: 'aabbcc', end: 2 },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/start/);
        expect(errors[0]).toMatch(/hexStart/);
      });

      it('rejects a malformed hex', () => {
        const errors = ShareService.validateShareParams({
          tool: 'gradient',
          params: { start: 1, hexEnd: 'zzzzzz' },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/hexEnd/);
      });
    });

    describe('mixer', () => {
      it('accepts two stainID inputs', () => {
        expect(
          ShareService.validateShareParams({
            tool: 'mixer',
            params: { dyeA: 1, dyeB: 2, ratio: 50 },
          })
        ).toEqual([]);
      });

      it('accepts bare-colour inputs', () => {
        expect(
          ShareService.validateShareParams({
            tool: 'mixer',
            params: { hexA: 'aabbcc', dyeB: 2, ratio: 50 },
          })
        ).toEqual([]);
        expect(
          ShareService.validateShareParams({
            tool: 'mixer',
            params: { hexA: 'aabbcc', hexB: '#112233', ratio: 50 },
          })
        ).toEqual([]);
      });

      it('rejects the pre-fix encoding of a custom input (stainID 0)', () => {
        const errors = ShareService.validateShareParams({
          tool: 'mixer',
          params: { dyeA: 1, dyeB: 0 },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/dyeB/);
      });

      it('rejects a slot carrying both its stainID and its hex', () => {
        const errors = ShareService.validateShareParams({
          tool: 'mixer',
          params: { dyeA: 1, hexA: 'aabbcc', dyeB: 2 },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/dyeA/);
      });

      it('rejects a malformed hex', () => {
        const errors = ShareService.validateShareParams({
          tool: 'mixer',
          params: { dyeA: 1, hexB: '12345' },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/hexB/);
      });
    });

    describe('harmony', () => {
      it('accepts a bare-colour base (what the tool emits for a custom base)', () => {
        expect(
          ShareService.validateShareParams({
            tool: 'harmony',
            params: { hex: 'aabbcc', harmony: 'complementary' },
          })
        ).toEqual([]);
      });

      it('rejects a base carrying both dye and hex', () => {
        const errors = ShareService.validateShareParams({
          tool: 'harmony',
          params: { dye: 1, hex: 'aabbcc', harmony: 'complementary' },
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/dye/);
      });

      it('still requires the harmony type', () => {
        const errors = ShareService.validateShareParams({
          tool: 'harmony',
          params: { dye: 1 } as never,
        });
        expect(errors).toEqual(['Missing required parameter: harmony']);
      });
    });
  });

  // ==========================================================================
  // generateUrl — the hex slot is emitted instead of (not beside) the dye slot
  // ==========================================================================

  describe('generateUrl', () => {
    it('carries the sharer\'s locale as ?lang= when it is not English (OG-I18N-001)', () => {
      langState.locale = 'ja';
      try {
        const { url } = ShareService.generateUrl({
          tool: 'harmony',
          params: { dye: 1, harmony: 'triadic' },
        });
        expect(new URL(url).searchParams.get('lang')).toBe('ja');
      } finally {
        langState.locale = 'en';
      }
    });

    it('keeps English share URLs free of ?lang= (stable og cache keys)', () => {
      const { url } = ShareService.generateUrl({
        tool: 'harmony',
        params: { dye: 1, harmony: 'triadic' },
      });
      expect(new URL(url).searchParams.get('lang')).toBeNull();
    });

    it('emits hexStart/hexEnd for bare-colour gradient endpoints', () => {
      const { url } = ShareService.generateUrl({
        tool: 'gradient',
        params: { hexStart: 'aabbcc', end: 2, steps: 5 },
      });
      const q = new URL(url).searchParams;
      expect(q.get('hexStart')).toBe('aabbcc');
      expect(q.get('start')).toBeNull();
      expect(q.get('end')).toBe('2');
      expect(q.get('hexEnd')).toBeNull();
    });

    it('emits hexA/hexB for bare-colour mixer inputs', () => {
      const { url } = ShareService.generateUrl({
        tool: 'mixer',
        params: { dyeA: 1, hexB: '112233', ratio: 75 },
      });
      const q = new URL(url).searchParams;
      expect(q.get('dyeA')).toBe('1');
      expect(q.get('hexA')).toBeNull();
      expect(q.get('hexB')).toBe('112233');
      expect(q.get('dyeB')).toBeNull();
      expect(q.get('ratio')).toBe('75');
    });
  });

  // ==========================================================================
  // parseSharedHex — read side of the hex slots
  // ==========================================================================

  describe('parseSharedHex', () => {
    it('normalizes RRGGBB, #RRGGBB and RGB', () => {
      expect(ShareService.parseSharedHex('AaBbCc')).toBe('#aabbcc');
      expect(ShareService.parseSharedHex('#aabbcc')).toBe('#aabbcc');
      expect(ShareService.parseSharedHex('abc')).toBe('#aabbcc');
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('accepts an all-digit hex that parseUrl coerced to a number', () => {
      // parseUrl() turns "112233" into the number 112233 — the value is
      // still a valid RRGGBB and must not be lost on the way in.
      const parsed = ShareService.parseUrl(
        'https://xivdyetools.app/gradient/?hexStart=112233&end=2&v=1'
      );
      expect(parsed?.params.hexStart).toBe(112233);
      expect(ShareService.parseSharedHex(parsed!.params.hexStart)).toBe('#112233');
    });

    it('rejects a malformed value loudly', () => {
      expect(ShareService.parseSharedHex('zzzzzz')).toBeNull();
      expect(ShareService.parseSharedHex(undefined)).toBeNull();
      expect(mockToastError).toHaveBeenCalledWith('share.invalidHex');
    });
  });

  // ==========================================================================
  // resolveSharedDye — stainID grammar, loud rejection of legacy itemIDs
  // ==========================================================================

  describe('resolveSharedDye', () => {
    it('resolves a stainID', () => {
      expect(ShareService.resolveSharedDye(2)).toBe(mockDyes[1]);
      expect(ShareService.resolveSharedDye('2')).toBe(mockDyes[1]);
    });

    it('rejects a legacy itemID loudly instead of guessing', () => {
      expect(ShareService.resolveSharedDye(5729)).toBeNull();
      expect(mockToastError).toHaveBeenCalledWith('share.legacyLink');
      expect(mockGetByStainId).not.toHaveBeenCalled();
    });

    it('rejects an unknown stainID loudly', () => {
      expect(ShareService.resolveSharedDye(200)).toBeNull();
      expect(mockToastError).toHaveBeenCalledWith('share.invalidDye');
    });
  });
});

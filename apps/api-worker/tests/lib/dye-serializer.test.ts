import { describe, it, expect } from 'vitest';
import { serializeDye, serializeDyeWithDistance } from '../../src/lib/dye-serializer.js';
import { createMockDye } from '@xivdyetools/test-utils';

describe('serializeDye', () => {
  it('includes all public Dye fields', () => {
    const dye = createMockDye({ itemID: 5729, name: 'Snow White' });
    const result = serializeDye(dye);

    expect(result.itemID).toBe(5729);
    expect(result.name).toBe('Snow White');
    expect(result.hex).toBeDefined();
    expect(result.rgb).toBeDefined();
    expect(result.hsv).toBeDefined();
    expect(result.category).toBeDefined();
    expect(result.acquisition).toBeDefined();
    expect(result.cost).toBeDefined();
    expect(result.isMetallic).toBeDefined();
    expect(result.isPastel).toBeDefined();
    expect(result.isDark).toBeDefined();
    expect(result.isCosmic).toBeDefined();
    expect(result.isIshgardian).toBeDefined();
    expect(result.consolidationType).toBeDefined();
  });

  it('includes marketItemID', () => {
    const dye = createMockDye({ itemID: 5729, consolidationType: null });
    const result = serializeDye(dye);
    // Pre-consolidation, marketItemID equals itemID
    expect(result.marketItemID).toBe(5729);
  });

  it('strips internal fields', () => {
    const dye = createMockDye() as Record<string, unknown>;
    // Manually add internal fields that DyeDatabase would have
    dye.nameLower = 'snow white';
    dye.categoryLower = 'neutral';
    dye.lab = { l: 50, a: 0, b: 0 };

    const result = serializeDye(dye as any) as Record<string, unknown>;
    expect(result.nameLower).toBeUndefined();
    expect(result.categoryLower).toBeUndefined();
    expect(result.lab).toBeUndefined();
  });

  it('includes localizedName when provided', () => {
    const dye = createMockDye();
    const result = serializeDye(dye, 'スノウホワイト');
    expect(result.localizedName).toBe('スノウホワイト');
  });

  it('omits localizedName when not provided', () => {
    const dye = createMockDye();
    const result = serializeDye(dye);
    expect(result.localizedName).toBeUndefined();
  });

  it('handles Facewear dyes with negative IDs', () => {
    const dye = createMockDye({ itemID: -1, category: 'Facewear', consolidationType: null });
    const result = serializeDye(dye);
    expect(result.itemID).toBe(-1);
    expect(result.marketItemID).toBe(-1);
  });
});

describe('serializeDyeWithDistance', () => {
  it('includes dye and distance', () => {
    const dye = createMockDye();
    const result = serializeDyeWithDistance(dye, 12.3456789);
    expect(result.dye).toBeDefined();
    expect(result.distance).toBe(12.3457); // Rounded to 4 decimal places
  });
});

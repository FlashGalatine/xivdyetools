import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DyeSelectionContext } from '../dye-selection-context';
import type { Dye } from '@shared/types';

describe('DyeSelectionContext', () => {
  let context: DyeSelectionContext;

  const mockDye: Dye = {
    id: 1,
    itemID: 123,
    stainID: null,
    name: 'Snow White',
    hex: '#FFFFFF',
    rgb: { r: 255, g: 255, b: 255 },
    hsv: { h: 0, s: 0, v: 100 },
    category: 'Neutral',
    acquisition: 'Shop',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  };

  beforeEach(() => {
    context = new DyeSelectionContext();
  });

  it('should store and retrieve selections', () => {
    context.select('tool-a', [mockDye]);
    expect(context.get('tool-a')).toEqual([mockDye]);
  });

  it('should return empty array for unknown tool', () => {
    expect(context.get('unknown-tool')).toEqual([]);
  });

  it('should notify subscribers when selection changes', () => {
    const callback = vi.fn();
    context.subscribe(callback);

    context.select('tool-a', [mockDye]);

    expect(callback).toHaveBeenCalledWith('tool-a', [mockDye]);
  });

  it('should unsubscribe correctly', () => {
    const callback = vi.fn();
    const unsubscribe = context.subscribe(callback);

    unsubscribe();
    context.select('tool-a', [mockDye]);

    expect(callback).not.toHaveBeenCalled();
  });

  it('should copy selection from one tool to another', () => {
    context.select('tool-a', [mockDye]);
    context.copyToTool('tool-a', 'tool-b');

    expect(context.get('tool-b')).toEqual([mockDye]);
    // Ensure it's a new array
    expect(context.get('tool-b')).not.toBe(context.get('tool-a'));
  });
});

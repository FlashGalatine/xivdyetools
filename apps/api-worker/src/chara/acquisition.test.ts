import { describe, expect, it } from 'vitest';
import { acquisitionFor } from './acquisition.js';

describe('acquisitionFor', () => {
  it.each(Array.from({ length: 55 }, (_, index) => 33043 + index))(
    'lists Enie for fiend costume equipment %i',
    (itemId) => {
      expect(acquisitionFor(itemId)).toBe(
        "Enie - Ishgard - The Firmament (3,000 Skybuilders' Scrips)"
      );
    }
  );

  it('reads the build-time table', () => {
    expect(acquisitionFor(47252)).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
  });

  it('is undefined for an item the table does not know', () => {
    expect(acquisitionFor(-1)).toBeUndefined();
  });
});

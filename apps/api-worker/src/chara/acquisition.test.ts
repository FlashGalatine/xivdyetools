import { describe, expect, it } from 'vitest';
import { acquisitionFor } from './acquisition.js';

describe('acquisitionFor', () => {
  it('reads the build-time table', () => {
    expect(acquisitionFor(47252)).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
  });

  it('is undefined for an item the table does not know', () => {
    expect(acquisitionFor(-1)).toBeUndefined();
  });
});

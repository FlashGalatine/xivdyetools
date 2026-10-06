import { describe, expect, it } from 'vitest';
import { acquisitionFor, loadAcquisition } from './acquisition.js';

describe('acquisitionFor', () => {
  // OPT-002: read before the first load is a programming error, never a silent "no line".
  it('refuses to answer before the table is loaded', () => {
    expect(() => acquisitionFor(47252)).toThrow(/loadAcquisition/);
  });

  it('reads the build-time table once loaded', async () => {
    await loadAcquisition();
    expect(acquisitionFor(47252)).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
  });

  it('is undefined for an item the table does not know', async () => {
    await loadAcquisition();
    expect(acquisitionFor(-1)).toBeUndefined();
  });

  it('shares one load between callers', async () => {
    expect(loadAcquisition()).toBe(loadAcquisition());
  });
});

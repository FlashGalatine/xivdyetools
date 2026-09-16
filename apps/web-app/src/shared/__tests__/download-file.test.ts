/**
 * Tests for the shared text-download helper: one anchor, clicked once, named
 * as asked, and its object URL released afterwards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadTextFile } from '../download-file';

describe('downloadTextFile', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    clicked = [];
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it('clicks one anchor named as asked, with the text as a blob of the given type', async () => {
    downloadTextFile('**Glamour Items:**', 'glamour-equipment.md', 'text/markdown');

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('glamour-equipment.md');
    expect(clicked[0].href).toBe('blob:mock-url');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/markdown');
    await expect(blob.text()).resolves.toBe('**Glamour Items:**');
  });

  it('removes the anchor and revokes the URL once the click has fired', () => {
    downloadTextFile('x', 'x.txt', 'text/plain');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

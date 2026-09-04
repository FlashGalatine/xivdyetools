/**
 * Parity gate for the app's local copy of the matching-method display tags.
 *
 * `shared/method-tags.ts` deliberately restates core's `MATCHING_METHOD_TAGS`
 * so the Swatch verdict card can read a tag where core is mocked — and
 * `components/__tests__/swatch-tool.test.ts` mocks `@xivdyetools/core`
 * wholesale, so the component genuinely cannot reach into it for a string.
 *
 * The price of a copy is silent drift, and core 5.1.0 charged it: when
 * `getDeltaE_Oklab` became ΔEOK2 the canonical `oklab` tag moved to `ΔEOK2`,
 * and nothing would have told the copy. The verdict card would then have
 * printed `ΔEOK` beside a number on the ΔEOK2 scale, while the OG cards —
 * which read core's map — printed `ΔEOK2` for the same match.
 *
 * This file must NOT mock `@xivdyetools/core`: comparing one copy against
 * another copy proves nothing.
 */
import { describe, it, expect } from 'vitest';

import { MATCHING_METHODS, MATCHING_METHOD_TAGS } from '@xivdyetools/core';

import { METHOD_TAGS } from '@shared/method-tags';

describe('shared/method-tags mirrors core', () => {
  it('covers exactly the suite vocabulary — no extra, no missing', () => {
    expect(Object.keys(METHOD_TAGS).sort()).toEqual([...MATCHING_METHODS].sort());
  });

  it.each([...MATCHING_METHODS])('%s prints core’s tag', (method) => {
    expect(METHOD_TAGS[method]).toBe(MATCHING_METHOD_TAGS[method]);
  });

  it('names oklab ΔEOK2 — the metric is ΔEOK2, not plain ΔEOK', () => {
    // Pinned separately from the parity loop: if core's map were reverted to
    // 'ΔEOK' the loop would still pass (both sides moved together) and only
    // this would fail.
    expect(METHOD_TAGS.oklab).toBe('ΔEOK2');
  });
});

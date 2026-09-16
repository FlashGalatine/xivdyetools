/**
 * XIV Dye Tools - Add to Collection Menu tests
 *
 * BUG-041: this component carried `/* istanbul ignore file *\/` and had no
 * tests. Unlike collection-manager-modal, this component mounts directly
 * into `document.body` (light DOM, not a shadow root) rather than going
 * through `ModalService`, so its queries target `document.body` directly.
 *
 * `@services/index` (the exact barrel this component imports from) is
 * mocked via `importOriginal` so `CollectionService` stays real —
 * add-a-dye exercises actual persisted state through the same
 * localStorage mock `collection-service.test.ts` uses — while
 * `ToastService`/`LanguageService` are spies.
 *
 * The second suite (BUG-029) proves the off-screen clamp now measures the
 * rendered menu instead of assuming a fixed 200px: it fails against the
 * pre-fix `menuWidth = 200` constant, temporarily restored and reverted in
 * the accompanying report, not in this file.
 *
 * @module components/__tests__/add-to-collection-menu.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Dye } from '@xivdyetools/types';

const { mockShow, mockDismissTop, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockShow: vi.fn().mockReturnValue('modal-id-1'),
  mockDismissTop: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@services/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/index')>();
  return {
    ...actual,
    ModalService: {
      show: mockShow,
      showConfirm: vi.fn(),
      dismiss: vi.fn(),
      dismissTop: mockDismissTop,
    },
    LanguageService: {
      t: (key: string) => key,
      tInterpolate: (key: string, vars: Record<string, unknown>) =>
        `${key}:${JSON.stringify(vars)}`,
    },
    ToastService: {
      success: mockToastSuccess,
      error: mockToastError,
      warning: vi.fn(),
    },
  };
});

import { CollectionService } from '@services/collection-service';
import { showAddToCollectionMenu } from '../add-to-collection-menu';

// Same in-memory localStorage mock collection-service.test.ts uses.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function makeDye(stainID: number): Dye {
  return { stainID } as Dye;
}

function menuEl(): HTMLElement {
  const el = document.querySelector('.add-to-collection-menu');
  if (!el) throw new Error('add-to-collection-menu is not mounted');
  return el as HTMLElement;
}

/** Collection rows only — excludes the "+ New collection" button, which also carries role="menuitem". */
function collectionItemButtons(): HTMLButtonElement[] {
  const list = menuEl().querySelector('.max-h-48');
  if (!list) throw new Error('collection list container not found');
  return Array.from(list.querySelectorAll('button[role="menuitem"]')) as HTMLButtonElement[];
}

describe('add-to-collection-menu', () => {
  let anchor: HTMLElement;

  beforeEach(() => {
    localStorageMock.clear();
    CollectionService.reset();
    vi.clearAllMocks();

    anchor = document.createElement('button');
    document.body.appendChild(anchor);
  });

  afterEach(() => {
    anchor.remove();
    // The component's own cleanup removes the menu on click-outside/escape,
    // but a test that asserts mid-flow state may leave it mounted.
    document.querySelector('.add-to-collection-menu')?.remove();
  });

  describe('add a dye to a collection', () => {
    it('adds the dye to the chosen collection and reports success', () => {
      const collection = CollectionService.createCollection('Bucket')!;
      const dye = makeDye(7);
      const onAdded = vi.fn();

      showAddToCollectionMenu({ dye, anchorElement: anchor, onAdded });

      const item = collectionItemButtons().find((b) => b.textContent?.includes('Bucket'));
      // A concrete value check, not a bare existence check: the row must be
      // enabled (not the already-in-collection/full state) for the click
      // below to mean anything.
      expect(item?.disabled).toBe(false);
      item!.click();

      expect(CollectionService.getCollection(collection.id)?.dyes).toContain(7);
      expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ id: collection.id }));
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('collections.addedToCollection')
      );
    });

    it('renders the empty-collections hint and no menu items when there are no collections', () => {
      showAddToCollectionMenu({ dye: makeDye(7), anchorElement: anchor });

      expect(menuEl().textContent).toContain('collections.collectionsEmpty');
      expect(collectionItemButtons().length).toBe(0);
    });
  });

  describe('a dye already in the collection', () => {
    it('disables the item and does not add a duplicate or toast on click', () => {
      const collection = CollectionService.createCollection('Bucket')!;
      CollectionService.addDyeToCollection(collection.id, 7);
      const dye = makeDye(7);

      showAddToCollectionMenu({ dye, anchorElement: anchor });

      const item = collectionItemButtons().find((b) => b.textContent?.includes('Bucket'))!;
      expect(item.disabled).toBe(true);

      item.click();

      expect(CollectionService.getCollection(collection.id)?.dyes).toEqual([7]);
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('positioning clamp (BUG-029)', () => {
    it('keeps a full-width (256px) menu inside the right viewport edge', () => {
      Object.defineProperty(window, 'innerWidth', {
        value: 800,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(window, 'innerHeight', {
        value: 900,
        configurable: true,
        writable: true,
      });

      // Anchor sits close enough to the right edge that `left + 256 > 800`
      // but `left + 200 <= 800` — the exact gap the old fixed-200 constant
      // missed entirely (see BUG-029.md).
      const menuRectSpy = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: HTMLElement) {
          if (this === anchor) {
            return {
              left: 580,
              top: 40,
              bottom: 50,
              right: 610,
              width: 30,
              height: 10,
              x: 580,
              y: 40,
              toJSON: () => ({}),
            } as DOMRect;
          }
          if (this.classList?.contains('add-to-collection-menu')) {
            // The rendered width jsdom can't lay out for real — this
            // simulates a real browser measuring the CSS's max-w-64 (256px).
            return {
              left: 0,
              top: 0,
              bottom: 0,
              right: 0,
              width: 256,
              height: 0,
              x: 0,
              y: 0,
              toJSON: () => ({}),
            } as DOMRect;
          }
          return {
            left: 0,
            top: 0,
            bottom: 0,
            right: 0,
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect;
        });

      try {
        showAddToCollectionMenu({ dye: makeDye(1), anchorElement: anchor });

        const left = parseFloat(menuEl().style.left);
        expect(left + 256).toBeLessThanOrEqual(window.innerWidth);
      } finally {
        menuRectSpy.mockRestore();
      }
    });
  });
});

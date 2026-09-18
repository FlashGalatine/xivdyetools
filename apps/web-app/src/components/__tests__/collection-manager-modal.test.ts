/**
 * XIV Dye Tools - Collection Manager Modal tests
 *
 * BUG-041: this 640-line CRUD / import-export component carried
 * `/* istanbul ignore file *\/` and had no tests. Follows the house mocking
 * style of preset-edit-form.test.ts: `@services/index` (the exact barrel
 * this component imports from) is mocked via `importOriginal` so
 * `CollectionService` and `dyeService` stay real — create/rename/delete/
 * import/export exercise actual persisted state through the same
 * localStorage mock `collection-service.test.ts` uses — while
 * `ModalService`/`ToastService`/`LanguageService` are spies. The modal
 * content is a detached DOM tree grabbed off the `ModalService.show` call
 * (light DOM — this component renders no shadow root).
 *
 * @module components/__tests__/collection-manager-modal.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockShow, mockShowConfirm, mockDismiss, mockDismissTop, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockShow: vi.fn().mockReturnValue('modal-id-1'),
    mockShowConfirm: vi.fn(),
    mockDismiss: vi.fn(),
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
      showConfirm: mockShowConfirm,
      dismiss: mockDismiss,
      dismissTop: mockDismissTop,
    },
    LanguageService: {
      // Echo the key back so a rendered English literal fails loudly, and so
      // selectors below don't depend on locale prose.
      t: (key: string) => key,
      tInterpolate: (key: string, vars: Record<string, unknown>) =>
        `${key}:${JSON.stringify(vars)}`,
      getDyeName: (itemID: number) => `dye-${itemID}`,
    },
    ToastService: {
      success: mockToastSuccess,
      error: mockToastError,
      warning: vi.fn(),
    },
  };
});

import { CollectionService } from '@services/collection-service';
import {
  showCollectionManagerModal,
  showCreateCollectionDialog,
} from '../collection-manager-modal';

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

/** The content element of the most recent `ModalService.show()` call. */
function lastShowContent(): HTMLElement {
  const call = mockShow.mock.calls[mockShow.mock.calls.length - 1] as [{ content: HTMLElement }];
  return call[0].content;
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement {
  const btn = Array.from(root.querySelectorAll('button')).find((b) => b.textContent === text);
  if (!btn) throw new Error(`No button with text "${text}"`);
  return btn as HTMLButtonElement;
}

/**
 * `triggerImport()` creates a file `<input>`, appends it, calls `.click()`,
 * then removes it from the DOM — all synchronously. In a real browser the
 * removed-but-still-referenced element still dispatches `change` once a
 * file is picked, so intercepting `document.createElement` (rather than
 * aliasing `this` off a `.click()` spy) keeps a handle on it for the test
 * to drive.
 */
function interceptFileInput(): { input: () => HTMLInputElement; restore: () => void } {
  const originalCreateElement = document.createElement.bind(document);
  let captured: HTMLInputElement | undefined;
  const spy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const el = originalCreateElement(tagName, options);
      if (tagName === 'input') captured = el as HTMLInputElement;
      return el;
    });
  return {
    input: () => {
      if (!captured) throw new Error('No <input> was created by triggerImport()');
      return captured;
    },
    restore: () => spy.mockRestore(),
  };
}

describe('collection-manager-modal', () => {
  beforeEach(() => {
    localStorageMock.clear();
    CollectionService.reset();
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('renders the empty-state copy and disables export when there is nothing saved', () => {
      showCollectionManagerModal();
      const content = lastShowContent();

      expect(content.textContent).toContain('collections.collectionsEmpty');
      expect(content.textContent).toContain('collections.collectionsEmptyHint');
      expect(findButton(content, 'collections.exportAll').disabled).toBe(true);
    });

    it('does not render a collection list item when there are no collections', () => {
      showCollectionManagerModal();
      const content = lastShowContent();

      expect(content.querySelector('.collection-item')).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a collection from the create dialog and reports it to the caller', () => {
      const onCreated = vi.fn();
      showCreateCollectionDialog(onCreated);
      const content = lastShowContent();

      const nameInput = content.querySelector('input[type="text"]') as HTMLInputElement;
      nameInput.value = 'My Collection';
      findButton(content, 'collections.createCollection').click();

      const created = CollectionService.getCollectionByName('My Collection');
      expect(created).toMatchObject({ name: 'My Collection', dyes: [] });
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Collection' }));
      expect(mockToastSuccess).toHaveBeenCalledWith('collections.collectionCreated');
      expect(mockDismissTop).toHaveBeenCalledTimes(1);
    });

    it('refuses to create a collection with a blank name and does not persist anything', () => {
      showCreateCollectionDialog();
      const content = lastShowContent();

      const nameInput = content.querySelector('input[type="text"]') as HTMLInputElement;
      nameInput.value = '   ';
      findButton(content, 'collections.createCollection').click();

      expect(CollectionService.getCollectionsCount()).toBe(0);
      expect(mockDismissTop).not.toHaveBeenCalled();
    });
  });

  describe('rename', () => {
    it('renames a collection through the edit dialog reached from the list item', () => {
      const collection = CollectionService.createCollection('Old Name')!;
      showCollectionManagerModal();
      const listContent = lastShowContent();

      const editBtn = listContent.querySelector(
        'button[title="collections.editCollection"]'
      ) as HTMLButtonElement;
      editBtn.click();

      const editContent = lastShowContent();
      const nameInput = editContent.querySelector('input[type="text"]') as HTMLInputElement;
      nameInput.value = 'New Name';
      findButton(editContent, 'common.save').click();

      expect(CollectionService.getCollection(collection.id)?.name).toBe('New Name');
      expect(mockToastSuccess).toHaveBeenCalledWith('collections.collectionUpdated');
    });
  });

  describe('delete', () => {
    it('deletes a collection once the confirm dialog is confirmed', () => {
      const collection = CollectionService.createCollection('Delete Me')!;
      showCollectionManagerModal();
      const content = lastShowContent();

      const deleteBtn = content.querySelector(
        'button[title="collections.deleteCollection"]'
      ) as HTMLButtonElement;
      deleteBtn.click();

      expect(mockShowConfirm).toHaveBeenCalledTimes(1);
      const confirmConfig = mockShowConfirm.mock.calls[0][0] as { onConfirm: () => void };
      confirmConfig.onConfirm();

      expect(CollectionService.getCollection(collection.id)).toBeUndefined();
      expect(mockToastSuccess).toHaveBeenCalledWith('collections.collectionDeleted');
    });

    it('leaves the collection untouched if the confirm dialog is never confirmed', () => {
      const collection = CollectionService.createCollection('Keep Me')!;
      const countBefore = CollectionService.getCollectionsCount();
      showCollectionManagerModal();
      const content = lastShowContent();

      const deleteBtn = content.querySelector(
        'button[title="collections.deleteCollection"]'
      ) as HTMLButtonElement;
      deleteBtn.click();

      // Simulate the user dismissing the confirm dialog without confirming —
      // onConfirm is never invoked. A bare existence check would pass even
      // if the record were silently mutated or the count drifted, so assert
      // the stored collection is unchanged (deep-equal to the pre-click
      // object: id, name, dyes), the count is unchanged, and no delete
      // success toast fired.
      expect(CollectionService.getCollection(collection.id)).toEqual(collection);
      expect(CollectionService.getCollectionsCount()).toBe(countBefore);
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe('export', () => {
    it('downloads all collections as a JSON file', () => {
      CollectionService.createCollection('Exportable');
      showCollectionManagerModal();
      const content = lastShowContent();

      const createObjectURL = vi.fn().mockReturnValue('blob:collections');
      const revokeObjectURL = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: createObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: revokeObjectURL,
      });
      const anchorClick = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      try {
        findButton(content, 'collections.exportAll').click();

        expect(createObjectURL).toHaveBeenCalledTimes(1);
        const blob = createObjectURL.mock.calls[0][0] as Blob;
        expect(blob.type).toBe('application/json');
        expect(anchorClick).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:collections');
        expect(mockToastSuccess).toHaveBeenCalledWith('palette.exported');
      } finally {
        anchorClick.mockRestore();
      }
    });
  });

  describe('import', () => {
    it('imports collections from a selected JSON file and refreshes the list', async () => {
      const { input, restore } = interceptFileInput();

      try {
        showCollectionManagerModal();
        const content = lastShowContent();

        findButton(content, 'collections.import').click();
        const capturedInput = input();

        const payload = JSON.stringify({
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          type: 'xivdyetools-collection',
          data: {
            collections: [
              {
                id: 'imported-1',
                name: 'Imported',
                dyes: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        });
        const file = { text: () => Promise.resolve(payload) } as unknown as File;
        Object.defineProperty(capturedInput, 'files', { configurable: true, value: [file] });
        capturedInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
          expect(CollectionService.getCollectionByName('Imported')).not.toBeUndefined();
        });
        expect(mockToastSuccess).toHaveBeenCalled();
      } finally {
        restore();
      }
    });

    it('reports an import failure via a toast without touching collection state', async () => {
      const { input, restore } = interceptFileInput();

      try {
        showCollectionManagerModal();
        const content = lastShowContent();

        findButton(content, 'collections.import').click();
        const capturedInput = input();

        const file = { text: () => Promise.resolve('not valid json') } as unknown as File;
        Object.defineProperty(capturedInput, 'files', { configurable: true, value: [file] });
        capturedInput.dispatchEvent(new Event('change'));

        await vi.waitFor(() => {
          expect(mockToastError).toHaveBeenCalledWith('collections.invalidFormat');
        });
        expect(mockToastSuccess).not.toHaveBeenCalled();
        expect(CollectionService.getCollectionsCount()).toBe(0);
      } finally {
        restore();
      }
    });
  });
});

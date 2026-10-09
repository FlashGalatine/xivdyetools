/**
 * Make-a-palette naming — chara-name privacy.
 *
 * The community preset submission form must never be pre-filled from the
 * `.chara` file: neither the Ktisis nickname nor the export filename (players
 * use their real name in both). The on-device `kind: 'palette'` record may
 * still fall back to it, exactly like the character record does. Real
 * services (setup.ts initialises LanguageService with EN and the dye
 * database); only the equipment resolve round-trip is mocked so nothing
 * reaches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlamourBlock } from '../glamour-block';
import { CollectionService, LanguageService, ToastService } from '@services/index';
import { CharaSessionService } from '@services/chara-session-service';
import { loadCharaFile } from '@services/chara-file-loader';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-resolve-service')>();
  return { ...actual, resolveCharaEquipment: resolveMock };
});

/** Three dyed pieces carrying four unique dyes (a valid 3–6 palette) and a real-name nickname. */
const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  Nickname: 'Real Name',
  REyeColor: 42,
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
  Body: { ModelBase: 9903, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Hands: { ModelBase: 376, ModelVariant: 1, DyeId: 6, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
});

const buttonByText = (root: HTMLElement, text: string): HTMLButtonElement => {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent?.includes(text)
  );
  if (!button) throw new Error(`no button labelled "${text}"`);
  return button;
};

const nameField = (root: HTMLElement): HTMLInputElement => {
  const input = root.querySelector<HTMLInputElement>('input[type="text"]');
  if (!input) throw new Error('no palette name field');
  return input;
};

describe('GlamourBlock — palette naming never leaks the character name', () => {
  let hosts: HTMLElement[] = [];
  let block: GlamourBlock | null = null;
  const onSubmitPalette = vi.fn<(dyes: unknown[], name?: string) => void>();

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockReturnValue(new Promise(() => {}));
    onSubmitPalette.mockReset();
    localStorage.clear();
    // CollectionService keeps its records in memory; clearing storage alone
    // would leak one test's saves into the next one's name and cap checks.
    CollectionService.reset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // The session is app-wide: leave nothing loaded or subscribed behind.
    block?.destroy();
    block = null;
    CharaSessionService.setSession(null);
    hosts.forEach(cleanupTestContainer);
    hosts = [];
  });

  /** Load the fixture (by default as "Real Name.chara") and open the make-a-palette panel. */
  async function mountWithPanelOpen(
    text: string = FIXTURE,
    fileName = 'Real Name.chara'
  ): Promise<HTMLElement> {
    const glamour = createTestContainer('chara-glamour');
    hosts = [glamour];
    block = new GlamourBlock(glamour, { onSubmitPalette });
    block.init();
    const file = new File([text], fileName, { type: 'application/json' });
    if (typeof (file as Blob).text !== 'function') {
      (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(text);
    }
    await loadCharaFile(file);
    buttonByText(glamour, LanguageService.t('swatch.makePalette')).click();
    return glamour;
  }

  it('opens the panel with an EMPTY name field — not the nickname, not the file name', async () => {
    const glamour = await mountWithPanelOpen();

    expect(nameField(glamour).value).toBe('');
  });

  it('hands the community form the typed draft only — blank when nothing was typed', async () => {
    const glamour = await mountWithPanelOpen();
    buttonByText(glamour, LanguageService.t('swatch.submitCommunity')).click();

    expect(onSubmitPalette).toHaveBeenCalledTimes(1);
    const [dyes, name] = onSubmitPalette.mock.calls[0];
    expect(dyes).toHaveLength(4);
    expect(name).toBe('');
  });

  it('hands the community form a typed name, trimmed and unchanged', async () => {
    const glamour = await mountWithPanelOpen();
    const input = nameField(glamour);
    input.value = '  Sunset set  ';
    input.dispatchEvent(new Event('input'));
    buttonByText(glamour, LanguageService.t('swatch.submitCommunity')).click();

    expect(onSubmitPalette.mock.calls[0][1]).toBe('Sunset set');
  });

  it('names the on-device record after the character when the field is empty (local only)', async () => {
    const glamour = await mountWithPanelOpen();
    buttonByText(glamour, LanguageService.t('swatch.saveLocal')).click();

    const saved = CollectionService.getCollections().find((c) => c.kind === 'palette');
    expect(saved?.name).toBe('Real Name');
    expect(saved?.dyes).toHaveLength(4);
    expect(onSubmitPalette).not.toHaveBeenCalled();
  });

  // BUG-082 sibling (2026-10-04 deep-dive, Sprint 4 review): a whitespace
  // Nickname is truthy, so it beat the file-name fallback and createCollection
  // rejected the blank name — "save failed" where the Swatch save succeeds.
  it.each(['', '   '])(
    'names the on-device record after the file when the Nickname is %j',
    async (nickname) => {
      const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
      const glamour = await mountWithPanelOpen(
        JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: nickname }),
        'blank.chara'
      );
      buttonByText(glamour, LanguageService.t('swatch.saveLocal')).click();

      expect(error).not.toHaveBeenCalled();
      const saved = CollectionService.getCollections().find((c) => c.name === 'blank');
      expect(saved?.kind).toBe('palette');
      expect(saved?.dyes).toHaveLength(4);
    }
  );

  // BUG-016 sibling (2026-10-04 deep-dive, Sprint 4 review): a full store made
  // createCollection return null, shown as the generic save failure.
  it('says the collection limit is reached instead of "save failed" when there is no room', async () => {
    const warning = vi.spyOn(ToastService, 'warning').mockImplementation(() => '');
    const error = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    for (let i = 0; i < 50; i++) CollectionService.createCollection(`Seed ${i}`);
    const glamour = await mountWithPanelOpen();
    buttonByText(glamour, LanguageService.t('swatch.saveLocal')).click();

    // The seeds are palette records too, so look for the save by name.
    expect(CollectionService.getCollections()).toHaveLength(50);
    expect(CollectionService.getCollectionByName('Real Name')).toBeUndefined();
    expect(error).not.toHaveBeenCalledWith(LanguageService.t('errors.saveChangesFailed'));
    expect(warning).toHaveBeenCalledWith(LanguageService.t('collections.collectionsLimitReached'));
  });
});

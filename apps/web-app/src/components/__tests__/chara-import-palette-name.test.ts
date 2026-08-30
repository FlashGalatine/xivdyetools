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
import { CharaImport } from '../chara-import';
import { CollectionService, LanguageService } from '@services/index';
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

describe('CharaImport — palette naming never leaks the character name', () => {
  let hosts: HTMLElement[] = [];
  const onSubmitPalette = vi.fn<(dyes: unknown[], name?: string) => void>();

  beforeEach(() => {
    resolveMock.mockReset();
    resolveMock.mockReturnValue(new Promise(() => {}));
    onSubmitPalette.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    hosts.forEach(cleanupTestContainer);
    hosts = [];
  });

  /** Load the fixture as "Real Name.chara" and open the make-a-palette panel. */
  async function mountWithPanelOpen(): Promise<HTMLElement> {
    const container = createTestContainer('chara-host');
    const glamour = createTestContainer('chara-glamour');
    hosts = [container, glamour];
    const importer = new CharaImport(
      container,
      { onSlotPick: vi.fn(), onSubmitPalette },
      { glamourContainer: glamour }
    );
    importer.init();
    const file = new File([FIXTURE], 'Real Name.chara', { type: 'application/json' });
    if (typeof (file as Blob).text !== 'function') {
      (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(FIXTURE);
    }
    await (importer as unknown as { loadFile(f: File): Promise<void> }).loadFile(file);
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
});

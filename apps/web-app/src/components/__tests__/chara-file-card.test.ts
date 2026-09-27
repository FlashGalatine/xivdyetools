/**
 * CharaFileCard — the `.chara` drop zone and file card.
 *
 * Localized surfaces (HC-CHA-001/002): three things used to reach the user in
 * English regardless of locale — the raw PascalCase `SubRace` in the header
 * meta line, core's engineering sentence for a slot failure, and core's
 * parse-failure message as a bare toast. Real services (setup.ts initialises
 * LanguageService with EN), so these assert the shipped EN strings — the point
 * is that they come from the locale files at all, which is what makes the
 * other five locales possible.
 *
 * The card also draws whatever CharaSessionService holds, so a file loaded
 * before it mounted (the tool was left and re-entered, or re-rendered for a
 * language switch) is on the card straight away.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CharaFileCard, type CharaFileCardOptions } from '../chara-file-card';
import { LanguageService, ToastService } from '@services/index';
import { CharaSessionService } from '@services/chara-session-service';
import { loadCharaFile } from '@services/chara-file-loader';
import { MAX_USER_FILE_BYTES } from '@shared/constants';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

/** Miqo'te female; the lip index sits in the unused 96–127 gap. */
const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  Nickname: 'Test Subject',
  Race: 'Miqote',
  Tribe: 'SeekerOfTheSun',
  Gender: 'Feminine',
  REyeColor: 42,
  LEyeColor: 42,
  LipsToneFurPattern: 100,
});

function charaFile(text: string, fileName = 'test.chara'): File {
  const file = new File([text], fileName, { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(text);
  }
  return file;
}

/** The drop/choose handlers' shared path, driven directly so the test can await it. */
type LoadFile = { loadFile(f: File): Promise<void> };

const hosts: HTMLElement[] = [];
const cards: CharaFileCard[] = [];

function mountCard(options?: CharaFileCardOptions): {
  card: CharaFileCard;
  container: HTMLElement;
} {
  const container = createTestContainer('chara-card-host');
  hosts.push(container);
  const card = new CharaFileCard(container, options);
  card.init();
  cards.push(card);
  return { card, container };
}

async function mount(text: string, fileName = 'test.chara', options?: CharaFileCardOptions) {
  const mounted = mountCard(options);
  await (mounted.card as unknown as LoadFile).loadFile(charaFile(text, fileName));
  return mounted;
}

const buttonByText = (root: HTMLElement, text: string): HTMLButtonElement | undefined =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent === text
  );

describe('CharaFileCard — localized surfaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    CharaSessionService.setSession(null);
  });

  afterEach(() => {
    for (const card of cards.splice(0)) card.destroy();
    CharaSessionService.setSession(null);
    for (const host of hosts.splice(0)) cleanupTestContainer(host);
  });

  it('prints the localized clan name in the header, not the raw SubRace value', async () => {
    const { container } = await mount(FIXTURE);

    expect(container.textContent).toContain(LanguageService.getClan('seekerOfTheSun'));
    expect(container.textContent).not.toContain('SeekerOfTheSun');
  });

  it('renders the keyed slot-error sentence instead of core message', async () => {
    const { container } = await mount(FIXTURE);

    expect(container.textContent).toContain(LanguageService.t('swatch.slotError.midRangeIndex'));
    // Core's engineering sentence names the raw field and never reaches the UI.
    expect(container.textContent).not.toContain('LipsToneFurPattern');
  });

  it('wraps a parse failure in the localized sentence, keeping core reason', async () => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');

    await mount('{ not json', 'broken.chara');

    expect(errorToast).toHaveBeenCalledTimes(1);
    const message = errorToast.mock.calls[0]![0];
    expect(message).toContain("Couldn't read this character file:");
    expect(message.length).toBeGreaterThan("Couldn't read this character file: ".length);
  });

  it('refuses a file over the size cap with the size toast (WEB-13)', async () => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { card } = mountCard();
    const file = charaFile('{}', 'huge.chara');
    Object.defineProperty(file, 'size', { value: MAX_USER_FILE_BYTES + 1 });

    await (card as unknown as LoadFile).loadFile(file);

    expect(errorToast).toHaveBeenCalledWith(LanguageService.t('errors.fileTooLarge'));
    // The key is a real translation, not an echo of the key
    expect(LanguageService.t('errors.fileTooLarge')).not.toBe('errors.fileTooLarge');
    expect(CharaSessionService.getSession()).toBeNull();
  });
});

describe('CharaFileCard — the loaded file', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    CharaSessionService.setSession(null);
  });

  afterEach(() => {
    for (const card of cards.splice(0)) card.destroy();
    CharaSessionService.setSession(null);
    for (const host of hosts.splice(0)) cleanupTestContainer(host);
  });

  it('offers the drop zone until a file is loaded through Choose file', async () => {
    const { container } = mountCard();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(container.textContent).toContain(LanguageService.t('swatch.dropTitle'));

    Object.defineProperty(input!, 'files', { value: [charaFile(FIXTURE)] });
    input!.dispatchEvent(new Event('change'));

    await vi.waitFor(() => expect(container.textContent).toContain('Test Subject'));
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('draws a file that was loaded before it mounted', async () => {
    await loadCharaFile(charaFile(FIXTURE, 'galatine.chara'));

    const { container } = mountCard();

    expect(container.textContent).toContain('Test Subject');
    expect(container.textContent).toContain('galatine.chara');
  });

  it('SWAP clears the loaded file for every view of it', async () => {
    const other = mountCard();
    const { container } = await mount(FIXTURE);

    buttonByText(container, LanguageService.t('swatch.swap'))!.click();

    expect(CharaSessionService.getSession()).toBeNull();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(other.container.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('offers Save character colors only when the host passes onSaveCharacter', async () => {
    const onSaveCharacter = vi.fn();
    const withSave = await mount(FIXTURE, 'test.chara', { onSaveCharacter });
    const withoutSave = mountCard();
    const label = LanguageService.t('swatch.saveCharacter');

    expect(buttonByText(withoutSave.container, label)).toBeUndefined();
    buttonByText(withSave.container, label)!.click();
    expect(onSaveCharacter).toHaveBeenCalledWith(CharaSessionService.getSession());
  });

  it('stops following the session once destroyed', async () => {
    const { card, container } = mountCard();
    card.destroy();

    await loadCharaFile(charaFile(FIXTURE));

    expect(container.childElementCount).toBe(0);
  });
});

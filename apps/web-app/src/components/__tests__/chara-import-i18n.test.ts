/**
 * .chara import — localized surfaces (HC-CHA-001/002).
 *
 * Three things used to reach the user in English regardless of locale: the
 * raw PascalCase `SubRace` in the header meta line, core's engineering
 * sentence for a slot failure, and core's parse-failure message as a bare
 * toast. Real services (setup.ts initialises LanguageService with EN), so
 * these assert the shipped EN strings — the point is that they come from the
 * locale files at all, which is what makes the other five locales possible.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CharaImport } from '../chara-import';
import { LanguageService, ToastService } from '@services/index';
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

const hosts: HTMLElement[] = [];

async function mount(text: string, fileName = 'test.chara') {
  const container = createTestContainer('chara-i18n-host');
  hosts.push(container);
  const importer = new CharaImport(container, { onSlotPick: vi.fn() });
  importer.init();
  const file = new File([text], fileName, { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(text);
  }
  await (importer as unknown as { loadFile(f: File): Promise<void> }).loadFile(file);
  return { importer, container };
}

describe('CharaImport — localized surfaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
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
});

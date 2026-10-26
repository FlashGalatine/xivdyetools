/**
 * CharaFileCard — the `.chara` drop zone and file card.
 *
 * Localized surfaces (HC-CHA-001/002): three things used to reach the user in
 * English regardless of locale — the raw PascalCase `SubRace` in the header
 * meta line, core's engineering sentence for a slot failure, and core's
 * parse-failure message as a bare toast. A failed load is now one fixed code
 * per toast (`unreadable`, `workerFailed`, `timedOut`, `notChara`, `tooLarge`).
 *
 * Files load through the real loader and the in-thread inspection stand-in
 * (setup.ts); a test holds or fails one inspection with mockImplementationOnce. Real services (setup.ts initialises
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
import {
  CharaInspectionError,
  cancelCharaInspection,
  inspectCharaBytes,
  prefetchCharaPalettes,
} from '@services/chara-inspection-service';
import { MAX_CHARA_FILE_BYTES, type ImportedCharaCharacter } from '@xivdyetools/core';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { makeImportedCharacter } from '../../__tests__/mocks/imported-chara';

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
  return new File([text], fileName, { type: 'application/json' });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

  // BUG-082 (2026-10-04 deep-dive): `??` let an empty or blank Nickname
  // beat the file name, so the card's title was blank.
  it('titles a file with a blank Nickname by its file name', async () => {
    const blank = JSON.stringify({ ...JSON.parse(FIXTURE), Nickname: '   ' });
    const { container } = await mount(blank, 'Aria.chara');
    const title = Array.from(container.querySelectorAll<HTMLElement>('span')).find((s) =>
      s.style.fontSize.startsWith('16px')
    );

    expect(title?.textContent).toBe('Aria.chara');
  });

  it('renders the keyed slot-error sentence instead of core message', async () => {
    const { container } = await mount(FIXTURE);

    expect(container.textContent).toContain(LanguageService.t('swatch.slotError.midRangeIndex'));
    // Core's engineering sentence names the raw field and never reaches the UI.
    expect(container.textContent).not.toContain('LipsToneFurPattern');
  });

  // The toast used to interpolate core's raw message as {reason}, which can quote a field value.
  // Each failure is now one fixed code with its own localized sentence.
  it('toasts the fixed unreadable sentence for a refused file, quoting nothing from it', async () => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');

    await mount('{ not json RAW-CANARY-0d4b', 'broken.chara');

    expect(errorToast).toHaveBeenCalledTimes(1);
    expect(errorToast).toHaveBeenCalledWith(LanguageService.t('swatch.charaUnreadable'));
    expect(LanguageService.t('swatch.charaUnreadable')).not.toBe('swatch.charaUnreadable');
    expect(errorToast.mock.calls[0]![0]).not.toContain('RAW-CANARY-0d4b');
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it.each([
    ['workerFailed', 'swatch.charaWorkerFailed'],
    ['timedOut', 'swatch.charaTimedOut'],
  ] as const)('toasts the fixed sentence for %s', async (code, key) => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    vi.mocked(inspectCharaBytes).mockRejectedValueOnce(new CharaInspectionError(code));

    await mount(FIXTURE, 'slow.chara');

    expect(LanguageService.t(key)).not.toBe(key);
    expect(errorToast).toHaveBeenCalledWith(LanguageService.t(key));
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it('never reads the retired parseFailed sentence', async () => {
    vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const t = vi.spyOn(LanguageService, 't');
    const tInterpolate = vi.spyOn(LanguageService, 'tInterpolate');

    await mount('{ not json', 'broken.chara');
    vi.mocked(inspectCharaBytes).mockRejectedValueOnce(new CharaInspectionError('workerFailed'));
    await mount(FIXTURE, 'slow.chara');

    const keys = [...t.mock.calls, ...tInterpolate.mock.calls].map((call) => call[0]);
    expect(keys).not.toContain('swatch.parseFailed');
  });

  it('keeps the loaded file when a broken one is dropped on top of it', async () => {
    vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { card, container } = await mount(FIXTURE, 'first.chara');
    const before = CharaSessionService.getSession();

    await (card as unknown as LoadFile).loadFile(charaFile('{', 'broken.chara'));

    expect(CharaSessionService.getSession()).toBe(before);
    expect(container.textContent).toContain('Test Subject');
  });

  it('refuses a file over the size cap with the size toast (WEB-13)', async () => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { card } = mountCard();
    const file = charaFile('{}', 'huge.chara');
    Object.defineProperty(file, 'size', { value: MAX_CHARA_FILE_BYTES + 1 });

    await (card as unknown as LoadFile).loadFile(file);

    const expected = LanguageService.tInterpolate('swatch.charaTooLarge', { kb: 8 });
    expect(errorToast).toHaveBeenCalledWith(expected);
    // A real translation that states the cap and what to do about an image
    expect(expected).toContain('8 KB');
    expect(expected).toContain('Anamnesis');
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it('refuses a file not named .chara with the file-type toast (FINDING-001)', async () => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { card } = mountCard();

    await (card as unknown as LoadFile).loadFile(charaFile(FIXTURE, 'Trick & Treat Duo (L).pose'));

    expect(errorToast).toHaveBeenCalledWith(LanguageService.t('swatch.charaNotChara'));
    expect(LanguageService.t('swatch.charaNotChara')).toContain('.chara');
    expect(CharaSessionService.getSession()).toBeNull();
  });
});

/**
 * The tests above call the private `loadFile` directly. These go through the
 * real DOM events, so a check that lived only in one handler would show up
 * here: both entry points must reach the loader's name and size guards.
 */
describe('CharaFileCard — drop and Choose file reach the same guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    CharaSessionService.setSession(null);
  });

  afterEach(() => {
    for (const card of cards.splice(0)) card.destroy();
    for (const host of hosts.splice(0)) cleanupTestContainer(host);
    CharaSessionService.setSession(null);
  });

  const fileInputOf = (container: HTMLElement): HTMLInputElement =>
    container.querySelector<HTMLInputElement>('input[type="file"]')!;

  /** Drop `file` on the drop zone (the file input's parent). */
  function drop(container: HTMLElement, file: File): void {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
    fileInputOf(container).parentElement!.dispatchEvent(event);
  }

  /** Pick `file` with the hidden file input. */
  function choose(container: HTMLElement, file: File): void {
    const input = fileInputOf(container);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it.each([
    ['drop', drop],
    ['Choose file', choose],
  ] as const)(
    '%s refuses a .pose with the file-type toast and reads nothing',
    async (_entry, deliver) => {
      const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
      const { container } = mountCard();
      const file = charaFile(FIXTURE, 'look.pose');
      const sliceSpy = vi.spyOn(file, 'slice');

      deliver(container, file);

      await vi.waitFor(() =>
        expect(errorToast).toHaveBeenCalledWith(LanguageService.t('swatch.charaNotChara'))
      );
      expect(sliceSpy).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['drop', drop],
    ['Choose file', choose],
  ] as const)('%s refuses an oversized .chara with the size toast', async (_entry, deliver) => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { container } = mountCard();
    const file = charaFile(FIXTURE, 'look.chara');
    Object.defineProperty(file, 'size', { value: MAX_CHARA_FILE_BYTES + 1 });

    deliver(container, file);

    await vi.waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(
        LanguageService.tInterpolate('swatch.charaTooLarge', { kb: 8 })
      )
    );
  });

  it.each([
    ['drop', drop],
    ['Choose file', choose],
  ] as const)('%s still loads a .chara', async (_entry, deliver) => {
    const { container } = mountCard();

    deliver(container, charaFile(FIXTURE, 'look.chara'));

    await vi.waitFor(() => expect(CharaSessionService.getSession()?.fileName).toBe('look.chara'));
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

  it('counts and draws the slots that carry a color preview', async () => {
    // FIXTURE: both eyes on cell 42; the lip index (100) sits in the gap; nothing else stored.
    const { container } = await mount(FIXTURE);
    const meta = Array.from(container.querySelectorAll<HTMLElement>('span')).find((s) =>
      s.style.fontSize.startsWith('10px')
    );
    const strip = container.querySelector<HTMLElement>('span[style*="width: 46px"]');
    const resolved = CharaSessionService.getSession()!.resolved;
    const previews = resolved.slots.filter((s) => s.displayHex !== null);

    expect(previews.map((s) => s.slot)).toEqual(['leftEye', 'rightEye']);
    expect(meta?.textContent).toContain(`2/${resolved.slots.length}`);
    expect(strip?.children).toHaveLength(2);
  });

  it('draws an unknown-activation slot in the strip: its color is preview evidence (D6)', async () => {
    const absent = {
      interpretation: 'unresolved',
      reason: 'missingColor',
      displayHex: null,
    } as const;
    vi.mocked(inspectCharaBytes).mockResolvedValueOnce(
      makeImportedCharacter({
        slots: {
          leftEye: { displayHex: '#112233' },
          rightEye: absent,
          hair: absent,
          highlights: { active: null, reason: 'activityUnknown', displayHex: '#445566' },
          skin: absent,
          limbal: absent,
          lip: absent,
          facePaint: absent,
        },
      })
    );
    const { container } = await mount(FIXTURE);
    const strip = container.querySelector<HTMLElement>('span[style*="width: 46px"]');

    expect(strip?.children).toHaveLength(2);
    expect(container.textContent).toContain('2/8');
  });

  it('an inactive lip with a stray composite adds nothing to the strip or the count', async () => {
    // Red if previewHex falls back to the lip composite when displayHex is null.
    const absent = {
      interpretation: 'unresolved',
      reason: 'missingColor',
      displayHex: null,
    } as const;
    vi.mocked(inspectCharaBytes).mockResolvedValueOnce(
      makeImportedCharacter({
        slots: {
          leftEye: { displayHex: '#112233' },
          rightEye: absent,
          hair: absent,
          highlights: absent,
          skin: absent,
          limbal: absent,
          lip: {
            active: false,
            interpretation: 'inactive',
            reason: 'lipDisabled',
            displayHex: null,
            lipComposite: { hex: '#CC8877', alpha: 0.4, derived: true },
          },
          facePaint: absent,
        },
      })
    );
    const { container } = await mount(FIXTURE);
    const strip = container.querySelector<HTMLElement>('span[style*="width: 46px"]');

    expect(strip?.children).toHaveLength(1);
    expect(container.textContent).toContain('1/8');
    // jsdom serializes an inline background as rgb()
    expect(container.innerHTML.toLowerCase()).not.toContain('#cc8877');
    expect(container.innerHTML).not.toContain('rgb(204, 136, 119)');
  });

  it('SWAP during a pending load cancels the load first, so the late result never publishes', async () => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { card, container } = await mount(FIXTURE, 'first.chara');
    const held = deferred<ImportedCharaCharacter>();
    vi.mocked(inspectCharaBytes).mockClear();
    vi.mocked(cancelCharaInspection).mockClear();
    vi.mocked(inspectCharaBytes).mockImplementationOnce(() => held.promise);
    const pending = (card as unknown as LoadFile).loadFile(charaFile(FIXTURE, 'late.chara'));
    await vi.waitFor(() => expect(inspectCharaBytes).toHaveBeenCalledTimes(1));
    const setSession = vi.spyOn(CharaSessionService, 'setSession');

    buttonByText(container, LanguageService.t('swatch.swap'))!.click();
    held.resolve(makeImportedCharacter({ nickname: 'Late Arrival' }));
    await pending;

    expect(cancelCharaInspection).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith(null);
    expect(vi.mocked(cancelCharaInspection).mock.invocationCallOrder[0]).toBeLessThan(
      setSession.mock.invocationCallOrder[0]!
    );
    expect(CharaSessionService.getSession()).toBeNull();
    expect(container.textContent).not.toContain('Late Arrival');
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(errorToast).not.toHaveBeenCalled();
  });

  it('a refused drop on a loaded card cancels nothing and keeps the file', async () => {
    vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { card } = await mount(FIXTURE, 'first.chara');
    const before = CharaSessionService.getSession();
    vi.mocked(cancelCharaInspection).mockClear();
    const huge = charaFile(FIXTURE, 'huge.chara');
    Object.defineProperty(huge, 'size', { value: MAX_CHARA_FILE_BYTES + 1 });

    await (card as unknown as LoadFile).loadFile(charaFile(FIXTURE, 'look.pose'));
    await (card as unknown as LoadFile).loadFile(huge);

    expect(cancelCharaInspection).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()).toBe(before);
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

  it('links the loaded file to the other tool that reads it (one file, two tools)', async () => {
    const onOpen = vi.fn();
    const linked = await mount(FIXTURE, 'test.chara', {
      crossLink: { label: 'Glamour Reader', onOpen },
    });
    const plain = mountCard();

    const link = linked.container.querySelector<HTMLButtonElement>('[data-role="cross-link"]');
    expect(link?.textContent).toContain('Glamour Reader');
    expect(plain.container.querySelector('[data-role="cross-link"]')).toBeNull();
    link!.click();
    expect(onOpen).toHaveBeenCalledOnce();
    // The file stays loaded: the other tool reads the same session.
    expect(CharaSessionService.getSession()).not.toBeNull();
  });

  it("adds the host's clause to the privacy line (the reader keeps edited acquisition notes)", async () => {
    const noted = await mount(FIXTURE, 'test.chara', { privacyNote: 'Notes are kept here.' });
    const plain = mountCard();
    expect(noted.container.textContent).toContain('Notes are kept here.');
    expect(plain.container.textContent).not.toContain('Notes are kept here.');
  });

  describe('sendsGearIds (Glamour Reader: gear ids reach the API)', () => {
    const plainHint = () => LanguageService.t('swatch.charaHint');
    const glamourHint = () => LanguageService.t('swatch.charaHintGlamour');
    const localOnly = () => LanguageService.t('swatch.localOnly');

    it('uses the gear-ids sentence on the drop zone and drops the "nothing is uploaded" claim', () => {
      const { container } = mountCard({ sendsGearIds: true });
      expect(glamourHint()).not.toBe('swatch.charaHintGlamour');
      expect(container.textContent).toContain(glamourHint());
      expect(container.textContent).not.toContain(plainHint());
    });

    it('uses it under the loaded card (with the host note) and renders no LOCAL ONLY chip', async () => {
      const { container } = await mount(FIXTURE, 'test.chara', {
        sendsGearIds: true,
        privacyNote: 'Notes are kept here.',
      });
      expect(container.textContent).toContain(`${glamourHint()} Notes are kept here.`);
      expect(container.textContent).not.toContain(plainHint());
      expect(container.textContent).not.toContain(localOnly());
      expect(container.querySelector(`[title="${plainHint()}"]`)).toBeNull();
      expect(container.querySelector(`[title="${glamourHint()}"]`)).toBeNull();
    });

    // I18N-012: the hint and the host's clause were joined with an ASCII space,
    // which Japanese and Chinese do not write after 。.
    it('joins the hint and the host clause without a space after 。 (ja)', async () => {
      await LanguageService.setLocale('ja');
      try {
        const note = '編集した入手方法はこの端末に保存されます。';
        const { container } = await mount(FIXTURE, 'test.chara', {
          sendsGearIds: true,
          privacyNote: note,
        });
        expect(glamourHint().endsWith('。')).toBe(true);
        expect(container.textContent).toContain(`${glamourHint()}${note}`);
        expect(container.textContent).not.toContain(`${glamourHint()} ${note}`);
      } finally {
        await LanguageService.setLocale('en');
      }
    });

    it('default mode is unchanged: plain hint at every site and the LOCAL ONLY chip titled with it', async () => {
      const zone = mountCard();
      expect(zone.container.textContent).toContain(plainHint());
      expect(zone.container.textContent).not.toContain(glamourHint());

      const { container } = await mount(FIXTURE);
      expect(container.textContent).toContain(localOnly());
      expect(container.textContent).toContain(plainHint());
      expect(container.textContent).not.toContain(glamourHint());
      const chip = Array.from(container.querySelectorAll<HTMLElement>('[title]')).find(
        (e) => e.textContent === localOnly()
      );
      expect(chip?.title).toBe(plainHint());
    });
  });

  // The Glamour Reader's drop zone used to pitch the Swatch Matcher: hair and
  // skin colors, and a swatch grid the reader does not have.
  describe('dropBody (a host that is not the Swatch Matcher)', () => {
    const swatchBody = () => LanguageService.t('swatch.dropBody');
    const orGrid = () => LanguageService.t('swatch.orGrid');
    const hostBody = 'Every piece, with its dyes.';

    it("pitches the host's body line and leaves out the swatch grid line", () => {
      const { container } = mountCard({ dropBody: hostBody });
      expect(container.textContent).toContain(hostBody);
      expect(container.textContent).not.toContain(swatchBody());
      expect(container.textContent).not.toContain(orGrid());
      // The rest of the offer is the same.
      expect(container.textContent).toContain(LanguageService.t('swatch.dropTitle'));
      expect(container.querySelector('input[type="file"]')).not.toBeNull();
    });

    it('default mode is unchanged: the Swatch Matcher body line and its grid line', () => {
      expect(swatchBody()).not.toBe('swatch.dropBody');
      expect(orGrid()).not.toBe('swatch.orGrid');
      const { container } = mountCard();
      expect(container.textContent).toContain(swatchBody());
      expect(container.textContent).toContain(orGrid());
    });

    it('changes only the drop zone, not the loaded file card', async () => {
      const { container } = await mount(FIXTURE, 'test.chara', { dropBody: hostBody });
      expect(container.textContent).toContain('Test Subject');
      expect(container.textContent).not.toContain(hostBody);
    });
  });

  it('says nothing about a file that a newer drop replaced', async () => {
    const errorToast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const { card } = mountCard();
    const older = new File(['{}'], 'older.chara', { type: 'application/json' });
    let failRead!: (error: Error) => void;
    Object.defineProperty(older, 'slice', {
      value: () => ({
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((_resolve, reject) => {
            failRead = reject;
          }),
      }),
    });

    const olderLoad = (card as unknown as LoadFile).loadFile(older);
    await (card as unknown as LoadFile).loadFile(charaFile(FIXTURE, 'newer.chara'));
    failRead(new Error('file changed on disk'));
    await olderLoad;

    expect(errorToast).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()?.fileName).toBe('newer.chara');
  });

  it('stops following the session once destroyed', async () => {
    const { card, container } = mountCard();
    card.destroy();

    await loadCharaFile(charaFile(FIXTURE));

    expect(container.childElementCount).toBe(0);
  });

  it('warms the palettes when it shows the drop zone, once per card', async () => {
    // Red if the drop zone does not start the idle-time warm-up (a cold import then spends its
    // deadline loading the palettes), or if every re-render starts another one.
    vi.mocked(prefetchCharaPalettes).mockClear();
    const { card, container } = mountCard();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(prefetchCharaPalettes).toHaveBeenCalledTimes(1);

    await (card as unknown as LoadFile).loadFile(charaFile(FIXTURE));
    buttonByText(container, LanguageService.t('swatch.swap'))!.click();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(prefetchCharaPalettes).toHaveBeenCalledTimes(1);

    // A second card is its own mount.
    mountCard();
    expect(prefetchCharaPalettes).toHaveBeenCalledTimes(2);
  });

  it('does not warm the palettes when it mounts on a loaded file', async () => {
    // Red if the warm-up runs on mount whatever the card shows: the palettes the file already
    // used are loaded, so there is nothing to warm.
    await loadCharaFile(charaFile(FIXTURE));
    vi.mocked(prefetchCharaPalettes).mockClear();
    const { container } = mountCard();
    expect(container.textContent).toContain('Test Subject');
    expect(prefetchCharaPalettes).not.toHaveBeenCalled();
  });

  it('destroy() does not cancel a pending load: the import still publishes after a route or language switch', async () => {
    // Red if destroy() calls cancelCharaLoad(): unmounting the card (navigating away, switching
    // language) would silently drop an import the player started.
    const { card } = mountCard();
    const held = deferred<ImportedCharaCharacter>();
    vi.mocked(inspectCharaBytes).mockClear();
    vi.mocked(cancelCharaInspection).mockClear();
    vi.mocked(inspectCharaBytes).mockImplementationOnce(() => held.promise);
    const pending = (card as unknown as LoadFile).loadFile(charaFile(FIXTURE, 'kept.chara'));
    await vi.waitFor(() => expect(inspectCharaBytes).toHaveBeenCalledTimes(1));

    card.destroy();
    held.resolve(makeImportedCharacter({ nickname: 'Still Arrives' }));
    await pending;

    expect(cancelCharaInspection).not.toHaveBeenCalled();
    expect(CharaSessionService.getSession()?.fileName).toBe('kept.chara');
    expect(CharaSessionService.getSession()?.resolved.nickname).toBe('Still Arrives');
  });
});

/**
 * Task 5 (assignment B): the amber warnings card over the new evidence states. Real files through
 * the loader where the plan names a tuple; the shared factory for states a short file cannot
 * produce on demand (an issue code, an off-grid float).
 */
describe('CharaFileCard — the warnings card (slot states and diagnostics)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    CharaSessionService.setSession(null);
  });

  afterEach(() => {
    for (const card of cards.splice(0)) card.destroy();
    CharaSessionService.setSession(null);
    for (const host of hosts.splice(0)) cleanupTestContainer(host);
  });

  const BASE = {
    TypeName: 'Anamnesis Character File',
    Nickname: 'Test Subject',
    Race: 'Miqote',
    Tribe: 'SeekerOfTheSun',
    Gender: 'Feminine',
    REyeColor: 42,
    LEyeColor: 42,
  };
  const t = (key: string): string => LanguageService.t(key);

  /** The amber card, or null when the file has nothing to warn about. */
  const warningsCard = (container: HTMLElement): HTMLElement | null =>
    container.querySelector<HTMLElement>('div[style*="rgba(244, 191, 79, 0.07)"]');
  /** Each row as `TAG|text`. */
  const rows = (container: HTMLElement): string[] =>
    Array.from(warningsCard(container)?.children ?? []).map(
      (row) => `${row.children[0]?.textContent}|${row.children[1]?.textContent}`
    );

  async function mountLoaded(doc: object, options?: CharaFileCardOptions) {
    const mounted = mountCard(options);
    const result = await loadCharaFile(charaFile(JSON.stringify(doc)));
    expect(result).toEqual({ ok: true });
    return mounted;
  }

  it('warns UNCONFIRMED for a resolved color whose control the file does not state', async () => {
    // Plan L165: {"Highlights":0,"FacePaintColor":0} gives active null for both slots.
    const { container } = await mountLoaded({ ...BASE, Highlights: 0, FacePaintColor: 0 });
    const tag = t('swatch.activityUnknownTag');
    const note = t('swatch.activityUnknownNote');

    expect(rows(container)).toEqual([
      `${tag}|${t('swatch.slotHighlights')} · ${note}`,
      `${tag}|${t('swatch.slotFacePaint')} · ${note}`,
    ]);
  });

  it('draws no warnings card for routine producer output (an omitted image, unknown fields)', async () => {
    const { container } = await mountLoaded({
      ...BASE,
      Base64Image:
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      Tags: ['look'],
      SomeToolOnlyField: 1,
    });
    const issues = CharaSessionService.getSession()!.resolved.issues.map((i) => i.code);

    expect(issues).toEqual(expect.arrayContaining(['IMAGE_OMITTED', 'UNSUPPORTED_FIELD']));
    expect(warningsCard(container)).toBeNull();
  });

  it('shows an incomplete gear piece only in the Glamour Reader (D5)', async () => {
    const doc = { ...BASE, HeadGear: { ModelBase: 1.5, ModelVariant: 1, DyeId: 0, DyeId2: 0 } };
    const reader = await mountLoaded(doc, { sendsGearIds: true });
    const matcher = mountCard();
    const expected = `${t('swatch.warnCheckTag')}|${t('swatch.gearSlot.HeadGear')} · ${t('swatch.issue.incompleteModel')}`;

    expect(rows(reader.container)).toEqual([expected]);
    expect(warningsCard(matcher.container)).toBeNull();
  });

  it('gives an unknown diagnostic code the generic sentence, never the code', async () => {
    vi.mocked(inspectCharaBytes).mockResolvedValueOnce(
      makeImportedCharacter({
        issues: [{ code: 'BRAND_NEW_CODE', severity: 'warning', path: ['unknown'] }],
      })
    );
    const { container } = await mount(FIXTURE);

    expect(rows(container)).toEqual([`${t('swatch.warnCheckTag')}|${t('swatch.issue.unknown')}`]);
    expect(container.textContent).not.toContain('BRAND_NEW_CODE');
  });

  it('keeps the error row red and the OFF GRID row amber', async () => {
    vi.mocked(inspectCharaBytes).mockResolvedValueOnce(
      makeImportedCharacter({
        slots: {
          hair: {
            interpretation: 'unresolved',
            reason: 'missingTribeGender',
            displayHex: null,
            creatorHex: null,
          },
          skin: { interpretation: 'offGrid', reason: 'offGrid', displayHex: '#335577' },
        },
      })
    );
    const { container } = await mount(FIXTURE);

    expect(rows(container)).toEqual([
      `${t('swatch.warnErrorTag')}|${t('swatch.slotHair')} · ${t('swatch.slotError.noTribe')}`,
      `${t('swatch.offGrid')}|${t('swatch.slotSkin')} · ${t('swatch.offGridNote')}`,
    ]);
    const [errorChip, offGridChip] = Array.from(warningsCard(container)!.children).map(
      (row) => (row.children[0] as HTMLElement).style.background
    );
    expect(errorChip).toContain('244, 100, 90');
    expect(offGridChip).toContain('244, 191, 79');
  });
});

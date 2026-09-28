/**
 * GlamourTool — the tenth tool's screen (design 1a/1b).
 *
 * One file, two tools: the reader draws the file CharaSessionService holds,
 * so a file loaded in the Swatch Matcher is already here, and the file card
 * links back. Real services (setup.ts initialises LanguageService with EN);
 * only the resolve round-trip is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlamourTool } from '../glamour-tool';
import { ToastService } from '@services/index';
import { RouterService } from '@services/router-service';
import { CharaSessionService } from '@services/chara-session-service';
import { loadCharaFile } from '@services/chara-file-loader';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { logger } from '@shared/logger';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-resolve-service')>();
  return { ...actual, resolveCharaEquipment: resolveMock };
});

/** A stale deploy: the preset form's chunk 404s (BUG-003). */
vi.mock('@components/preset-submission-form', () => {
  throw new Error('chunk missing');
});

const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  Tribe: 'Midlander',
  Gender: 'Feminine',
  REyeColor: 42,
  Body: { ModelBase: 200, ModelVariant: 1, DyeId: 56, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
});

function charaFile(text: string): File {
  const file = new File([text], 'stress-sample.chara', { type: 'application/json' });
  if (typeof (file as Blob).text !== 'function') {
    (file as unknown as { text: () => Promise<string> }).text = () => Promise.resolve(text);
  }
  return file;
}

let container: HTMLElement;
let tool: GlamourTool | null = null;

beforeEach(() => {
  resolveMock.mockResolvedValue({ items: {}, glasses: null, version: 'test' });
  container = createTestContainer('glamour-tool-host');
});

afterEach(() => {
  tool?.destroy();
  tool = null;
  CharaSessionService.setSession(null);
  cleanupTestContainer(container);
  vi.restoreAllMocks();
});

function mount(): GlamourTool {
  tool = new GlamourTool(container);
  tool.init();
  return tool;
}

describe('GlamourTool', () => {
  it('opens on the drop zone when no file is loaded', () => {
    mount();
    expect(container.querySelector('h1')?.textContent).toBe('Glamour Reader');
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(container.querySelector('[data-role="glamour-block"]')).toBeNull();
  });

  it('reads a file the Swatch Matcher loaded: the file card, then DYES ON THIS GLAMOUR', async () => {
    await loadCharaFile(charaFile(FIXTURE));
    mount();

    expect(container.querySelector('input[type="file"]')).toBeNull();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-role="glamour-block"]')).not.toBeNull()
    );
    // Copy list / Export .md sit in the reader's header, not the block's (design 1a).
    const actions = container.querySelector('[data-role="reader-actions"]')!;
    expect(actions.querySelector('[data-role="copy-list"]')).not.toBeNull();
    expect(actions.querySelector('[data-role="export-markdown"]')).not.toBeNull();
    expect(
      container.querySelector('[data-role="glamour-block"] [data-role="copy-list"]')
    ).toBeNull();
  });

  it('says so when a loaded file wears no gear, and stops saying it when one does', async () => {
    const bare = JSON.stringify({ Tribe: 'Midlander', Gender: 'Feminine', REyeColor: 42 });
    await loadCharaFile(charaFile(bare));
    mount();
    const empty = () => container.querySelector<HTMLElement>('[data-role="glamour-empty"]');
    expect(empty()?.textContent).toBe('This file wears no gear.');
    expect(empty()?.hidden).toBe(false);

    await loadCharaFile(charaFile(FIXTURE));
    expect(empty()?.hidden).toBe(true);
  });

  it('says on the file card that edited acquisition notes are kept on this device', async () => {
    await loadCharaFile(charaFile(FIXTURE));
    mount();
    expect(container.textContent).toContain(
      'Your edited acquisition notes are kept on this device.'
    );
  });

  it('links the file to the Swatch Matcher', async () => {
    const navigate = vi.spyOn(RouterService, 'navigateTo').mockImplementation(() => {});
    await loadCharaFile(charaFile(FIXTURE));
    mount();

    const link = container.querySelector<HTMLButtonElement>('[data-role="cross-link"]')!;
    expect(link.textContent).toContain('Swatch Matcher');
    link.click();

    expect(navigate).toHaveBeenCalledWith('swatch');
  });

  it('catches a failed preset-form load instead of leaving Submit silently dead (BUG-003)', async () => {
    const toast = vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    mount();

    const internal = tool as unknown as { submitPalette: (dyes: never[], name?: string) => void };
    expect(() => internal.submitPalette([], 'My Palette')).not.toThrow();

    await vi.waitFor(() => expect(toast).toHaveBeenCalled());
    expect(error).toHaveBeenCalledWith(
      '[GlamourTool] Failed to load the preset submission form',
      expect.anything()
    );
  });
});

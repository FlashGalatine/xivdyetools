/**
 * Imported `.chara` labels never reach a log — FINDING-001 / FINDING-004
 * (xivcharakit integration plan, Task 5).
 *
 * New Swatch character-color records use a localized generic name. Glamour
 * palette saves may use a typed name, nickname, filename or localized default
 * (at most 50 UTF-16 units); backups retain existing saved names. Imported labels
 * must never appear in any log or console output, in development or production,
 * anywhere in the lifecycle:
 * the two component saves, the loader, and every collection-service path that
 * handles a name (create, duplicate refusal, delete, load-time truncation and
 * dye-ID migration, legacy-palette migration, tombstoned reimport, the
 * per-record import catch, and the raw `JSON.parse` failure).
 *
 * Real paths only: the real logger (the global setup mock is lifted below),
 * the real CollectionService on jsdom's localStorage, the real loader, core's
 * xivcharakit reader and the worker's own handler (run in-thread by setup.ts,
 * since jsdom has no Worker), and the real chara-sheet / glamour-block saves.
 * The equipment resolve round-trip is mocked, so nothing reaches the network,
 * and a few loader cases force one inspection to fail.
 *
 * Capture is both channels, serialised before searching: every argument handed
 * to the app logger (whatever the mode then emits) and every console method
 * (Error objects included: name, message, stack, cause).
 *
 * Known blind spot: the global setup imports LanguageService and StorageService
 * (through ThemeService) before this file lifts the logger mock, so those two
 * keep the inert logger and their own log calls reach neither channel. They log
 * fixed keys and storage error text only, never a record; a name-bearing log added
 * to either would have to be caught by reading them, not by this suite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The global setup replaces the logger with inert vi.fn()s; this suite needs
// the real one so the dev/prod gates and the console output are the shipped ones.
vi.unmock('@shared/logger');

import { logger, __setTestEnvironment } from '@shared/logger';
import { CollectionService, LanguageService, ToastService } from '@services/index';
import { CharaSessionService } from '@services/chara-session-service';
import { loadCharaFile, type CharaLoadResult } from '@services/chara-file-loader';
import { CharaInspectionError, inspectCharaBytes } from '@services/chara-inspection-service';
import { dyeService } from '@services/dye-service-wrapper';
import { saveCharacterColors } from '../chara-sheet';
import { GlamourBlock } from '../glamour-block';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-resolve-service')>();
  return { ...actual, resolveCharaEquipment: resolveMock };
});

// ============================================================================
// Canaries
// ============================================================================

/** Stands in for a character nickname (players often use their real name). */
const NICK_CANARY = 'NICK-7f3a9c';
/** Stands in for an export file name. */
const FILE_CANARY = 'FILE-91b2d4';
/** Carried inside forced-error messages: a raw exception must not be forwarded. */
const RAW_ERROR_CANARY = 'RAW-ERR-5c8e1a';
/** Stands in for the file's own `TypeName` (producer text is file-supplied). */
const PRODUCER_CANARY = 'PROD-2e6f80';
/** A hand-edited stored dye ref: untrusted text where a number belongs. */
const STORED_REF_CANARY = 'REF-3d9b27';

const COLLECTIONS_KEY = 'xivdyetools_collections';
const SAVED_PALETTES_KEY = 'xivdyetools_saved_palettes';

// ============================================================================
// Capture harness
// ============================================================================

const CONSOLE_METHODS = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'group',
  'groupCollapsed',
  'table',
  'trace',
  'dir',
] as const;
const LOGGER_METHODS = ['debug', 'info', 'warn', 'error', 'log', 'group', 'table'] as const;

/** One entry per captured call: `<channel>.<method>: <serialised args>`. */
const captured: string[] = [];

/** Flatten anything a caller could hand a logger, Errors and non-enumerables included. */
function serialise(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'function') return '[function]';
  if (value === null || typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (value instanceof Error) {
    const fields = Object.getOwnPropertyNames(value).map(
      (key) => `${key}=${serialise((value as unknown as Record<string, unknown>)[key], seen)}`
    );
    const cause = 'cause' in value ? ` cause=${serialise(value.cause, seen)}` : '';
    return `${value.name}: ${value.message} ${value.stack ?? ''} ${fields.join(' ')}${cause}`;
  }
  if (Array.isArray(value)) return `[${value.map((v) => serialise(v, seen)).join(', ')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.getOwnPropertyNames(record)
    .map((key) => `${key}: ${serialise(record[key], seen)}`)
    .join(', ')}}`;
}

function installCapture(): void {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      captured.push(`console.${method}: ${args.map((a) => serialise(a)).join(' ')}`);
    });
  }
  for (const method of LOGGER_METHODS) {
    const original = logger[method] as (...args: unknown[]) => void;
    vi.spyOn(logger, method).mockImplementation(((...args: unknown[]) => {
      captured.push(`logger.${method}: ${args.map((a) => serialise(a)).join(' ')}`);
      original.apply(logger, args);
    }) as never);
  }
}

/** Forget setup noise: only what the step under test logs counts. */
function beginCapture(): void {
  captured.length = 0;
}

/** Every captured entry that discloses any of the canaries. */
function leaksOf(...canaries: string[]): string[] {
  return captured.filter((entry) => canaries.some((canary) => entry.includes(canary)));
}

// ============================================================================
// Fixtures and drivers
// ============================================================================

/** Miqo'te female, both eyes on cell 42 — chara-sheet's own fixture. */
const SHEET_FIXTURE = {
  TypeName: 'Anamnesis Character File',
  Nickname: 'Test Subject',
  Race: 'Miqote',
  Tribe: 'SeekerOfTheSun',
  Gender: 'Feminine',
  REyeColor: 42,
  LEyeColor: 42,
  LipsToneFurPattern: 100,
};

/** Three dyed pieces, four unique dyes — glamour-block-palette-name's fixture. */
const GLAMOUR_FIXTURE = {
  TypeName: 'Anamnesis Character File',
  Nickname: 'Real Name',
  REyeColor: 42,
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
  Body: { ModelBase: 9903, ModelVariant: 1, DyeId: 56, DyeId2: 33 },
  Hands: { ModelBase: 376, ModelVariant: 1, DyeId: 6, DyeId2: 0 },
  Glasses: { GlassesId: 0 },
};

function charaFile(text: string, fileName: string): File {
  return new File([text], fileName, { type: 'application/json' });
}

async function load(fixture: object, fileName: string): Promise<CharaLoadResult> {
  return loadCharaFile(charaFile(JSON.stringify(fixture), fileName));
}

const hosts: HTMLElement[] = [];
let block: GlamourBlock | null = null;

const buttonByText = (root: HTMLElement, text: string): HTMLButtonElement => {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent?.includes(text)
  );
  if (!button) throw new Error(`no button labelled "${text}"`);
  return button;
};

/** Load a glamour file and open the make-a-palette panel, as the reader does. */
async function mountGlamour(fixture: object, fileName: string): Promise<HTMLElement> {
  const host = createTestContainer('chara-glamour');
  hosts.push(host);
  block = new GlamourBlock(host, { onSubmitPalette: vi.fn() });
  block.init();
  expect(await load(fixture, fileName)).toEqual({ ok: true });
  buttonByText(host, LanguageService.t('swatch.makePalette')).click();
  return host;
}

/** The name importData gives a copy whose original name is taken (mirrors the service). */
function importedCopyName(base: string, n: number): string {
  const key = 'collections.importedSuffix';
  const template = LanguageService.t(key);
  if (template === key || !template.includes('{n}')) return `${base} (${n})`;
  return LanguageService.tInterpolate(key, { name: base, n });
}

/** Stain IDs the offline database really holds (so no ref drops by accident). */
const realStainIds = (): number[] =>
  dyeService
    .getAllDyes()
    .map((dye) => dye.stainID)
    .filter((id): id is number => typeof id === 'number');

function storedRecord(name: string, dyes: number[], id = `stored-${name}`) {
  const now = new Date().toISOString();
  return { id, name, kind: 'palette', dyes, createdAt: now, updatedAt: now };
}

/** Seed storage, then re-run CollectionService's load path from it. */
function seedAndReload(entries: Record<string, unknown>): void {
  CollectionService.reset();
  localStorage.clear();
  for (const [key, value] of Object.entries(entries)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  beginCapture();
  CollectionService.__reloadForTesting();
}

function importPayload(collections: unknown[]): string {
  return JSON.stringify({
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    type: 'xivdyetools-collection',
    data: { collections },
  });
}

// ============================================================================
// Lifecycle
// ============================================================================

beforeEach(() => {
  resolveMock.mockReset();
  resolveMock.mockReturnValue(new Promise(() => {}));
  installCapture();
  localStorage.clear();
  // CollectionService keeps its records in memory; storage alone would leak
  // one test's records into the next one's duplicate-name and cap checks.
  CollectionService.reset();
  CharaSessionService.setSession(null);
  beginCapture();
});

afterEach(() => {
  __setTestEnvironment(null);
  block?.destroy();
  block = null;
  CharaSessionService.setSession(null);
  for (const host of hosts.splice(0)) cleanupTestContainer(host);
  vi.restoreAllMocks();
});

const MODES = [
  { mode: 'development', env: { isDev: true, isProd: false } },
  { mode: 'production', env: { isDev: false, isProd: true } },
] as const;

describe.each(MODES)('imported labels stay out of logs — $mode logging', ({ env }) => {
  beforeEach(() => {
    __setTestEnvironment(env);
  });

  // --------------------------------------------------------------------------
  // (a) Real component saves follow their naming rules and log no imported labels
  // --------------------------------------------------------------------------

  describe('chara-sheet character save', () => {
    it('uses the generic name without saving or logging the nickname', async () => {
      expect(await load({ ...SHEET_FIXTURE, Nickname: NICK_CANARY }, 'sheet.chara')).toEqual({
        ok: true,
      });
      beginCapture();

      saveCharacterColors(CharaSessionService.getSession()!);

      const saved = CollectionService.getCollections().find((c) => c.kind === 'character');
      expect(saved?.name).toBe(LanguageService.t('swatch.characterDefaultName'));
      expect(saved?.name).not.toContain(NICK_CANARY);
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('uses the generic name without saving or logging the file name', async () => {
      expect(await load({ ...SHEET_FIXTURE, Nickname: '' }, `${FILE_CANARY}.chara`)).toEqual({
        ok: true,
      });
      beginCapture();

      saveCharacterColors(CharaSessionService.getSession()!);

      const saved = CollectionService.getCollections().find((c) => c.kind === 'character');
      expect(saved?.name).toBe(LanguageService.t('swatch.characterDefaultName'));
      expect(saved?.name).not.toContain(FILE_CANARY);
      expect(leaksOf(FILE_CANARY)).toEqual([]);
    });
  });

  describe('glamour-block local palette save', () => {
    it('saves under the nickname without logging it', async () => {
      const host = await mountGlamour(
        { ...GLAMOUR_FIXTURE, Nickname: NICK_CANARY },
        'glamour.chara'
      );
      beginCapture();

      buttonByText(host, LanguageService.t('swatch.saveLocal')).click();

      const saved = CollectionService.getCollections().find((c) => c.kind === 'palette');
      expect(saved?.name).toBe(NICK_CANARY);
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('saves under the file name (.chara stripped) without logging it', async () => {
      const host = await mountGlamour({ ...GLAMOUR_FIXTURE, Nickname: '' }, `${FILE_CANARY}.chara`);
      beginCapture();

      buttonByText(host, LanguageService.t('swatch.saveLocal')).click();

      const saved = CollectionService.getCollections().find((c) => c.kind === 'palette');
      expect(saved?.name).toBe(FILE_CANARY);
      expect(leaksOf(FILE_CANARY)).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // (b) The real collection lifecycle
  // --------------------------------------------------------------------------

  describe('collection lifecycle', () => {
    it('creating a record does not log its name', () => {
      const created = CollectionService.createCollection(NICK_CANARY);

      expect(created?.name).toBe(NICK_CANARY);
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('refusing a duplicate name does not log the name', () => {
      CollectionService.createCollection(NICK_CANARY);
      beginCapture();

      expect(CollectionService.createCollection(NICK_CANARY)).toBeNull();
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('deleting a record does not log its name', () => {
      const created = CollectionService.createCollection(NICK_CANARY)!;
      beginCapture();

      expect(CollectionService.deleteCollection(created.id)).toBe(true);
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('deleting every record of a kind does not log their names', () => {
      CollectionService.createCollection(NICK_CANARY, undefined, { kind: 'character' });
      beginCapture();

      expect(CollectionService.deleteCollectionsByKind('character')).toBe(1);
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('skipping a tombstoned record on reimport does not log its name', () => {
      const created = CollectionService.createCollection(NICK_CANARY)!;
      const backup = CollectionService.exportCollection(created.id)!;
      CollectionService.deleteCollection(created.id);
      beginCapture();

      const result = CollectionService.importData(backup);

      expect(result.collectionsImported).toBe(0);
      expect(CollectionService.getCollectionByName(NICK_CANARY)).toBeUndefined();
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('importing a copy under a suffixed name does not log either name', () => {
      const created = CollectionService.createCollection(NICK_CANARY)!;
      CollectionService.addDyeToCollection(created.id, realStainIds()[0]!);
      const backup = CollectionService.exportCollection(created.id)!;
      beginCapture();

      const result = CollectionService.importData(backup);

      expect(result.collectionsImported).toBe(1);
      expect(CollectionService.getCollectionByName(importedCopyName(NICK_CANARY, 1))).toBeDefined();
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // (c) Load-time repairs driven from seeded storage
  // --------------------------------------------------------------------------

  describe('load-time repairs', () => {
    it('truncating a stored record over the dye limit does not log its name', () => {
      const max = CollectionService.getMaxDyesPerCollection();
      const dyes = realStainIds().slice(0, max + 5);
      expect(dyes).toHaveLength(max + 5);

      seedAndReload({
        [COLLECTIONS_KEY]: {
          version: '2.0.0',
          collections: [storedRecord(NICK_CANARY, dyes)],
          lastModified: new Date().toISOString(),
        },
      });

      expect(CollectionService.getCollectionByName(NICK_CANARY)?.dyes).toHaveLength(max);
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('dropping an unresolvable dye ref does not log the record name', () => {
      const [kept] = realStainIds();

      seedAndReload({
        [COLLECTIONS_KEY]: {
          version: '2.0.0',
          collections: [storedRecord(NICK_CANARY, [kept!, 999_999, STORED_REF_CANARY as never])],
          lastModified: new Date().toISOString(),
        },
      });

      expect(CollectionService.getCollectionByName(NICK_CANARY)?.dyes).toEqual([kept]);
      expect(leaksOf(NICK_CANARY, STORED_REF_CANARY)).toEqual([]);
    });

    it('dropping a legacy palette with no resolvable dyes does not log its name', () => {
      seedAndReload({
        [SAVED_PALETTES_KEY]: [
          {
            id: 'legacy-unresolvable',
            name: NICK_CANARY,
            baseColor: '#000001',
            baseDyeName: 'Not A Dye',
            harmonyType: 'complementary',
            companions: ['Not A Dye Either'],
            dateCreated: new Date().toISOString(),
          },
        ],
      });

      expect(CollectionService.getCollectionByName(NICK_CANARY)).toBeUndefined();
      expect(localStorage.getItem(SAVED_PALETTES_KEY)).toBeNull();
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('a legacy palette that cannot migrate at the cap does not log its name', () => {
      const [dye] = dyeService.getAllDyes();
      const seeds = Array.from({ length: 50 }, (_, i) =>
        storedRecord(`Seed ${i}`, [realStainIds()[0]!], `seed-${i}`)
      );

      seedAndReload({
        [COLLECTIONS_KEY]: {
          version: '2.0.0',
          collections: seeds,
          lastModified: new Date().toISOString(),
        },
        [SAVED_PALETTES_KEY]: [
          {
            id: 'legacy-capped',
            name: NICK_CANARY,
            baseColor: dye!.hex,
            baseDyeName: dye!.name,
            harmonyType: 'complementary',
            companions: [],
            dateCreated: new Date().toISOString(),
          },
        ],
      });

      expect(CollectionService.getCollections()).toHaveLength(50);
      expect(CollectionService.getCollectionByName(NICK_CANARY)).toBeUndefined();
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('migrating a legacy palette keeps its name locally without logging it', () => {
      const [dye] = dyeService.getAllDyes();

      seedAndReload({
        [SAVED_PALETTES_KEY]: [
          {
            id: 'legacy-ok',
            name: NICK_CANARY,
            baseColor: dye!.hex,
            baseDyeName: dye!.name,
            harmonyType: 'complementary',
            companions: [],
            dateCreated: new Date().toISOString(),
          },
        ],
      });

      expect(CollectionService.getCollectionByName(NICK_CANARY)?.kind).toBe('palette');
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // (d) importData failures
  // --------------------------------------------------------------------------

  describe('importData failures', () => {
    it('a JSON parse error that quotes the input is not logged', () => {
      // A pasted label instead of a backup. V8 quotes a short input whole and
      // truncates a longer one, so the input is the canary alone.
      const malformed = NICK_CANARY;
      // Harness check: the engine's SyntaxError really does quote the input.
      expect(() => JSON.parse(malformed)).toThrow(NICK_CANARY);

      const result = CollectionService.importData(malformed);

      expect(result.errors).toEqual([{ code: 'parseFailed' }]);
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('an unexpected per-record error logs neither the name nor the raw exception, and the next record still imports', () => {
      const [dye] = realStainIds();
      vi.spyOn(CollectionService, 'isTombstoned').mockImplementationOnce(() => {
        throw new Error(`forced failure ${RAW_ERROR_CANARY}`);
      });

      const result = CollectionService.importData(
        importPayload([
          { id: 'rec-canary', name: NICK_CANARY, dyes: [dye] },
          { id: 'rec-later', name: 'Later Valid', dyes: [dye] },
        ])
      );

      expect(result.errors).toEqual([expect.objectContaining({ code: 'skippedInvalid' })]);
      expect(CollectionService.getCollectionByName(NICK_CANARY)).toBeUndefined();
      expect(CollectionService.getCollectionByName('Later Valid')?.dyes).toEqual([dye]);
      expect(leaksOf(NICK_CANARY, RAW_ERROR_CANARY)).toEqual([]);
    });

    it.each([
      ['a number', 42],
      ['a boolean', true],
      ['an array', ['text']],
      ['an object', { text: 'text' }],
    ])(
      'a record whose description is %s is skipped without logging its name or a raw TypeError',
      (_label, description) => {
        const [dye] = realStainIds();

        const result = CollectionService.importData(
          importPayload([
            { id: 'rec-bad-desc', name: NICK_CANARY, description, dyes: [dye] },
            { id: 'rec-later', name: 'Later Valid', dyes: [dye] },
          ])
        );

        expect(result.errors).toEqual([expect.objectContaining({ code: 'skippedInvalid' })]);
        expect(CollectionService.getCollectionByName(NICK_CANARY)).toBeUndefined();
        expect(CollectionService.getCollectionByName('Later Valid')?.dyes).toEqual([dye]);
        expect(leaksOf(NICK_CANARY, 'TypeError')).toEqual([]);
      }
    );
  });

  // --------------------------------------------------------------------------
  // (e) The loader
  // --------------------------------------------------------------------------

  describe('toast-service', () => {
    afterEach(() => {
      ToastService.dismissAll();
    });

    it('showing a toast does not log its text (import record names, parse reasons)', () => {
      ToastService.warning(`Skipped collection "${NICK_CANARY}"`);
      ToastService.error(`Parse failed: unrecognised value "${RAW_ERROR_CANARY}"`);

      expect(leaksOf(NICK_CANARY, RAW_ERROR_CANARY)).toEqual([]);
    });
  });

  describe('chara-file-loader', () => {
    it('a successful parse does not log the file name', async () => {
      const result = await load(SHEET_FIXTURE, `${FILE_CANARY}.chara`);

      expect(result).toEqual({ ok: true });
      // The in-memory session keeps the label for the file card (allowed).
      expect(CharaSessionService.getSession()?.fileName).toBe(`${FILE_CANARY}.chara`);
      expect(leaksOf(FILE_CANARY)).toEqual([]);
    });

    it('a successful parse does not log the producer text the file carries', async () => {
      const result = await load({ ...SHEET_FIXTURE, TypeName: PRODUCER_CANARY }, 'producer.chara');

      expect(result).toEqual({ ok: true });
      expect(leaksOf(PRODUCER_CANARY)).toEqual([]);
    });

    it('a successful parse does not log the nickname', async () => {
      const result = await load({ ...SHEET_FIXTURE, Nickname: NICK_CANARY }, 'nick.chara');

      expect(result).toEqual({ ok: true });
      expect(leaksOf(NICK_CANARY)).toEqual([]);
    });

    it('a read failure does not log the raw exception', async () => {
      const file = charaFile('{}', 'unreadable.chara');
      // The loader reads through a capped slice; its read is what fails.
      Object.defineProperty(file, 'slice', {
        value: () => ({
          arrayBuffer: (): Promise<never> =>
            Promise.reject(new Error(`stale handle ${RAW_ERROR_CANARY}`)),
        }),
      });

      const result = await loadCharaFile(file);

      expect(result).toEqual({ ok: false, error: 'unreadable' });
      expect(leaksOf(RAW_ERROR_CANARY)).toEqual([]);
    });

    // The legacy parser refused a file with an unrecognized Tribe and quoted the value in its
    // message. The library reads it as an unsupported field instead: the file loads, the identity
    // stays unknown, and the value appears in no log and nowhere in the session.
    it('a file with an unrecognized Tribe loads, and the value goes nowhere', async () => {
      const result = await load({ ...SHEET_FIXTURE, Tribe: RAW_ERROR_CANARY }, 'odd-tribe.chara');

      expect(result).toEqual({ ok: true });
      const session = CharaSessionService.getSession()!;
      expect(session.resolved.tribe).toBeNull();
      expect(JSON.stringify(session)).not.toContain(RAW_ERROR_CANARY);
      expect(leaksOf(RAW_ERROR_CANARY)).toEqual([]);
    });

    it('a structurally refused file is unreadable, and its contents go nowhere', async () => {
      const unterminated = `{"Nickname":"${NICK_CANARY}","Tribe":"${RAW_ERROR_CANARY}"`;

      const result = await loadCharaFile(charaFile(unterminated, `${FILE_CANARY}.chara`));

      expect(result).toEqual({ ok: false, error: 'unreadable' });
      expect(CharaSessionService.getSession()).toBeNull();
      expect(leaksOf(RAW_ERROR_CANARY, NICK_CANARY, FILE_CANARY)).toEqual([]);
    });

    it('an inspection that throws a raw exception is workerFailed, and its text goes nowhere', async () => {
      vi.mocked(inspectCharaBytes).mockRejectedValueOnce(
        new Error(`worker exploded ${RAW_ERROR_CANARY} ${NICK_CANARY}`)
      );

      const result = await load(
        { ...SHEET_FIXTURE, Nickname: NICK_CANARY },
        `${FILE_CANARY}.chara`
      );

      expect(result).toEqual({ ok: false, error: 'workerFailed' });
      expect(leaksOf(RAW_ERROR_CANARY, NICK_CANARY, FILE_CANARY)).toEqual([]);
    });

    it.each(['workerFailed', 'timedOut'] as const)(
      'an inspection that fails %s logs no label',
      async (code) => {
        vi.mocked(inspectCharaBytes).mockRejectedValueOnce(new CharaInspectionError(code));

        const result = await load(
          { ...SHEET_FIXTURE, Nickname: NICK_CANARY },
          `${FILE_CANARY}.chara`
        );

        expect(result).toEqual({ ok: false, error: code });
        expect(leaksOf(NICK_CANARY, FILE_CANARY)).toEqual([]);
      }
    );
  });
});

// ============================================================================
// Preserved local behavior (the exceptions the privacy fix must not remove)
// ============================================================================

describe('preserved local naming', () => {
  it('a long localized generic name keeps its cap, trimming the base and never the suffix', async () => {
    const long = 'Default'.repeat(10);
    const translate = LanguageService.t.bind(LanguageService);
    vi.spyOn(LanguageService, 't').mockImplementation((key, ...args) =>
      key === 'swatch.characterDefaultName' ? long : translate(key, ...args)
    );
    expect(await load({ ...SHEET_FIXTURE, Nickname: NICK_CANARY }, 'long.chara')).toEqual({
      ok: true,
    });
    const session = CharaSessionService.getSession()!;

    saveCharacterColors(session);
    saveCharacterColors(session);

    expect(
      CollectionService.getCollections()
        .filter((c) => c.kind === 'character')
        .map((c) => c.name)
    ).toEqual([long.slice(0, 50), `${long.slice(0, 46)} (1)`]);
    expect(leaksOf(NICK_CANARY)).toEqual([]);
  });

  it('loading a character file alone persists no collection', async () => {
    expect(await load({ ...SHEET_FIXTURE, Nickname: NICK_CANARY }, `${FILE_CANARY}.chara`)).toEqual(
      { ok: true }
    );

    expect(CollectionService.getCollections()).toEqual([]);
    const stored = Object.keys(localStorage)
      .map((key) => localStorage.getItem(key) ?? '')
      .join('\n');
    expect(stored).not.toContain(NICK_CANARY);
    expect(stored).not.toContain(FILE_CANARY);
  });

  it('exporting then reimporting a backup keeps the saved name', () => {
    const [dye] = realStainIds();
    const created = CollectionService.createCollection(NICK_CANARY, undefined, {
      kind: 'character',
    })!;
    CollectionService.addDyeToCollection(created.id, dye!);
    const backup = CollectionService.exportAll();
    CollectionService.reset();
    localStorage.clear();

    const result = CollectionService.importData(backup);

    expect(result.collectionsImported).toBe(1);
    const restored = CollectionService.getCollectionByName(NICK_CANARY);
    expect(restored?.kind).toBe('character');
    expect(restored?.dyes).toEqual([dye]);
  });

  it('a reimported copy whose suffix passes 50 units is refused as createFailed, not truncated', () => {
    const fifty = `${NICK_CANARY}${'x'.repeat(50 - NICK_CANARY.length)}`;
    expect(fifty).toHaveLength(50);
    const created = CollectionService.createCollection(fifty)!;
    const backup = CollectionService.exportCollection(created.id)!;

    const result = CollectionService.importData(backup);

    expect(result.collectionsImported).toBe(0);
    expect(result.errors).toEqual([{ code: 'createFailed', name: importedCopyName(fifty, 1) }]);
    expect(CollectionService.getCollections()).toHaveLength(1);
  });
});

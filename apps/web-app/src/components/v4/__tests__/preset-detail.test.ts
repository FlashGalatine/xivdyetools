/**
 * XIV Dye Tools - PresetDetail Unit Tests
 *
 * Focused regression suite for two deep-dive audit findings
 * (docs/audits/2026-09-16-deep-dive):
 *
 * - BUG-004: `marketConfig`/`priceData`/the `prices-updated` subscription all
 *   write `this.priceData`, but the dye row never read it back — "Show
 *   prices" was a silent no-op on this view.
 * - BUG-026: `checkVoteStatus()` had no request-generation guard, so a check
 *   started by `updated()` could resolve after an optimistic `handleVote()`
 *   and clobber `hasVoted`/`currentVoteCount`.
 *
 * This file does not attempt full coverage of preset-detail.ts (tracked
 * separately as webapp-v4-17) — only these two behaviors.
 *
 * @module components/v4/__tests__/preset-detail.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Dye, PriceData } from '@xivdyetools/types';
import type { UnifiedPreset } from '@services/hybrid-preset-service';
import type { VoteCheckResponse, VoteResponse } from '@services/community-preset-service';
import type { MarketConfig } from '@shared/tool-config-types';

// ============================================================================
// Mocks
// ============================================================================

const translations: Record<string, string> = {
  'common.gilAmount': '{n} {unit}',
};

function tInterpolate(key: string, params: Record<string, string | number>): string {
  const template = translations[key] ?? key;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}

function makeLanguageServiceMock() {
  return {
    t: vi.fn((key: string) => key),
    tInterpolate: vi.fn(tInterpolate),
    getCurrentLocale: vi.fn(() => 'en'),
    getDyeName: vi.fn(() => ''),
    getAcquisition: vi.fn((a: string) => a),
    getCurrency: vi.fn((c: string) => (c === 'Gil' ? 'gil' : c)),
    subscribe: vi.fn(() => () => {}),
    initialize: vi.fn(() => Promise.resolve()),
  };
}

const languageServiceMock = makeLanguageServiceMock();

const authServiceMock = {
  isAuthenticated: vi.fn(() => false),
};

const communityPresetServiceMock = {
  hasVoted: vi.fn<(id: string) => Promise<VoteCheckResponse>>(),
  voteForPreset: vi.fn<(id: string) => Promise<VoteResponse>>(),
  removeVote: vi.fn<(id: string) => Promise<VoteResponse>>(),
};

const toastServiceMock = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

let resolveDyeImpl: (id: number) => Dye | undefined = () => undefined;

vi.mock('@services/index', () => ({
  resolvePresetDye: (id: number) => resolveDyeImpl(id),
  authService: authServiceMock,
  communityPresetService: communityPresetServiceMock,
  ToastService: toastServiceMock,
  LanguageService: languageServiceMock,
}));

// `@shared/format` and `@shared/preset-i18n` import LanguageService directly
// from this path rather than through the `@services/index` barrel.
vi.mock('@services/language-service', () => ({
  LanguageService: languageServiceMock,
}));

class FakeMarketBoardService extends EventTarget {
  static instance: FakeMarketBoardService | null = null;
  static getInstance(): FakeMarketBoardService {
    if (!FakeMarketBoardService.instance) {
      FakeMarketBoardService.instance = new FakeMarketBoardService();
    }
    return FakeMarketBoardService.instance;
  }
  static resetInstance(): void {
    FakeMarketBoardService.instance = null;
  }
  fetchPricesForDyes = vi.fn(async (): Promise<Map<number, PriceData>> => new Map());
  shouldFetchPrice = vi.fn(() => true);
  getWorldNameForPrice = vi.fn((price?: PriceData) => price?.worldName ?? 'Crystal');
  getSelectedServer = vi.fn(() => 'Crystal');
  getShowPrices = vi.fn(() => false);
}

vi.mock('@services/market-board-service', () => ({
  MarketBoardService: FakeMarketBoardService,
}));

let configControllerConfig: MarketConfig = { selectedServer: 'Crystal', showPrices: false };

const configControllerMock = {
  getConfig: vi.fn(() => configControllerConfig),
  subscribe: vi.fn(() => () => {}),
};

vi.mock('@services/config-controller', () => ({
  ConfigController: {
    getInstance: () => configControllerMock,
  },
}));

// ============================================================================
// Fixtures
// ============================================================================

function makeDye(overrides: Partial<Dye> = {}): Dye {
  return {
    itemID: 5729,
    stainID: 1,
    id: 5729,
    name: 'Snow White Dye',
    hex: '#F4F0E3',
    rgb: { r: 244, g: 240, b: 227 },
    hsv: { h: 42, s: 7, v: 96 },
    category: 'White',
    acquisition: 'Merchants & Vendors',
    cost: 216,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
    isIshgardian: false,
    consolidationType: 'A',
    ...overrides,
  };
}

const basePreset: UnifiedPreset = {
  id: 'community-1',
  name: 'Test Preset',
  description: 'A test preset',
  category: 'aesthetics',
  secondaryCategories: [],
  dyes: [1],
  tags: [],
  voteCount: 0,
  isCurated: false,
  isFromAPI: true,
  apiPresetId: 'api-1',
};

type PresetDetailEl = HTMLElement & {
  preset?: UnifiedPreset;
  updateComplete: Promise<unknown>;
};

// ============================================================================
// Tests
// ============================================================================

describe('PresetDetail', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    resolveDyeImpl = () => undefined;
    configControllerConfig = { selectedServer: 'Crystal', showPrices: false };
    FakeMarketBoardService.resetInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
  });

  /** Mount a preset detail element with the given preset and wait for Lit to render. */
  async function mountDetail(preset: UnifiedPreset): Promise<PresetDetailEl> {
    await import('../preset-detail');
    const el = document.createElement('v4-preset-detail') as PresetDetailEl;
    el.preset = preset;
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  /** Flush pending microtasks (mocked service promises) plus a Lit render pass. */
  async function flush(el: PresetDetailEl): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  }

  // --------------------------------------------------------------------
  // BUG-004
  // --------------------------------------------------------------------

  describe('BUG-004: live market prices on the dye row', () => {
    it('renders the fetched market price instead of the vendor cost when prices are on', async () => {
      const dye = makeDye({ itemID: 5729, cost: 216, currency: 'Gil' });
      resolveDyeImpl = (id) => (id === 1 ? dye : undefined);
      configControllerConfig = { selectedServer: 'Crystal', showPrices: true };

      const el = await mountDetail({ ...basePreset, dyes: [1] });
      await flush(el);

      // Simulate MarketBoardService delivering a live price for this dye,
      // keyed by the dye's own itemID (fetchPricesForDyes fans consolidated
      // prices back out onto each member dye's itemID before emitting).
      const priceData: PriceData = {
        itemID: 5729,
        currentAverage: 1500,
        currentMinPrice: 1234,
        currentMaxPrice: 2000,
        lastUpdate: Date.now(),
        worldId: 1,
        worldName: 'Excalibur',
      };
      FakeMarketBoardService.instance!.dispatchEvent(
        new CustomEvent('prices-updated', { detail: { prices: new Map([[5729, priceData]]) } })
      );
      await flush(el);

      const priceCell = el.shadowRoot!.querySelector('.dye-price')!;
      const renderedText = priceCell.textContent!.replace(/\s+/g, ' ').trim();

      // The vendor-cost text this row rendered before the fix.
      expect(renderedText).not.toBe(tInterpolate('common.gilAmount', { n: '216', unit: 'gil' }));
      // The live listing price must actually appear.
      expect(renderedText).toContain('1,234');
    });

    it('renders the vendor cost, unchanged, when prices are off', async () => {
      const dye = makeDye({ itemID: 5729, cost: 216, currency: 'Gil' });
      resolveDyeImpl = (id) => (id === 1 ? dye : undefined);
      configControllerConfig = { selectedServer: 'Crystal', showPrices: false };

      const el = await mountDetail({ ...basePreset, dyes: [1] });
      await flush(el);

      // Even if a price happened to be cached, showPrices=false must not
      // surface it here.
      const priceData: PriceData = {
        itemID: 5729,
        currentAverage: 1500,
        currentMinPrice: 1234,
        currentMaxPrice: 2000,
        lastUpdate: Date.now(),
      };
      FakeMarketBoardService.instance!.dispatchEvent(
        new CustomEvent('prices-updated', { detail: { prices: new Map([[5729, priceData]]) } })
      );
      await flush(el);

      const priceCell = el.shadowRoot!.querySelector('.dye-price')!;
      const renderedText = priceCell.textContent!.replace(/\s+/g, ' ').trim();

      expect(renderedText).toBe(tInterpolate('common.gilAmount', { n: '216', unit: 'gil' }));
      expect(renderedText).not.toContain('1,234');
    });
  });

  // --------------------------------------------------------------------
  // BUG-026
  // --------------------------------------------------------------------

  describe('BUG-026: stale checkVoteStatus() cannot clobber an optimistic vote', () => {
    it('keeps the optimistic vote result after a slow, stale vote-status check resolves', async () => {
      authServiceMock.isAuthenticated.mockReturnValue(true);

      let resolveHasVoted!: (value: VoteCheckResponse) => void;
      const hasVotedPromise = new Promise<VoteCheckResponse>((resolve) => {
        resolveHasVoted = resolve;
      });
      communityPresetServiceMock.hasVoted.mockReturnValue(hasVotedPromise);
      communityPresetServiceMock.voteForPreset.mockResolvedValue({
        success: true,
        new_vote_count: 5,
      });

      const el = await mountDetail({
        ...basePreset,
        dyes: [],
        isCurated: false,
        isFromAPI: true,
        apiPresetId: 'api-1',
        voteCount: 4,
      });
      await flush(el);

      // Both connectedCallback() and updated() started a checkVoteStatus()
      // call on mount; both are now suspended on the same pending promise.

      // The user votes before the slow check resolves. voteForPreset()
      // resolves quickly, so the optimistic update completes in full
      // (including handleVote()'s `finally`) before we resolve the stale
      // check below.
      const voteButton = el.shadowRoot!.querySelector<HTMLButtonElement>('.vote-btn')!;
      voteButton.click();
      await flush(el);

      expect(el.shadowRoot!.querySelector('.vote-btn')!.classList.contains('voted')).toBe(true);
      expect(el.shadowRoot!.querySelector('.vote-btn')!.textContent).toContain('5');

      // The stale check(s) started on mount now resolve with pre-vote data.
      // Without the generation guard this clobbers the vote back to
      // not-voted / the old count.
      resolveHasVoted({ has_voted: false, vote_count: 4 });
      await flush(el);

      const voteButtonAfter = el.shadowRoot!.querySelector<HTMLButtonElement>('.vote-btn')!;
      expect(voteButtonAfter.classList.contains('voted')).toBe(true);
      expect(voteButtonAfter.textContent).toContain('5');
    });
  });
});

/**
 * XIV Dye Tools - PresetCard Unit Tests
 *
 * Tests the V4 preset card Lit component's shot-area render branches: the
 * approved preview image, the striped link-only placeholder, and the
 * palette-as-picture fallback.
 *
 * @module components/__tests__/v4/preset-card.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PresetCardData } from '../../v4/preset-card';
import type { UnifiedPreset } from '@services/hybrid-preset-service';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@xivdyetools/core', () => ({
  ColorService: {
    hexToRgb: vi.fn(() => ({ r: 255, g: 0, b: 0 })),
    rgbToHex: vi.fn(() => '#FF0000'),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    isLightColor: vi.fn(() => false),
  },
  DyeService: class MockDyeService {
    getAllDyes() {
      return [];
    }
    getDyeById() {
      return null;
    }
    getCategories() {
      return [];
    }
  },
  dyeDatabase: [],
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_STAR: '<svg></svg>',
  ICON_STAR_FILLED: '<svg></svg>',
}));

const basePreset: UnifiedPreset = {
  id: 'community-1',
  name: 'Test Preset',
  description: 'A test preset',
  category: 'aesthetics',
  dyes: [1, 2, 3],
  tags: [],
  voteCount: 0,
  isCurated: false,
  isFromAPI: true,
};

const baseCardData: PresetCardData = {
  preset: basePreset,
  colors: ['#ff0000', '#00ff00', '#0000ff'],
};

describe('PresetCard', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  /** Mount a card with the given data and wait for Lit to render. */
  async function mountCard(data: PresetCardData): Promise<HTMLElement> {
    await import('../../v4/preset-card');
    const el = document.createElement('v4-preset-card') as HTMLElement & {
      data: PresetCardData;
      updateComplete: Promise<unknown>;
    };
    el.data = data;
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  it('renders the preview image when one is approved', async () => {
    const el = await mountCard({
      ...baseCardData,
      previewImageUrl: 'https://shots.xivdyetools.app/p1/a.webp',
    });

    const img = el.shadowRoot!.querySelector('img.shot-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://shots.xivdyetools.app/p1/a.webp');
  });

  it('falls back to the striped link treatment when there is no image', async () => {
    const el = await mountCard({
      ...baseCardData,
      previewImageUrl: null,
      exampleLink: 'https://mirapri.com/100814',
    });

    expect(el.shadowRoot!.querySelector('img.shot-img')).toBeNull();
    expect(el.shadowRoot!.querySelector('.shot-caption')).not.toBeNull();
  });

  it('prefers the image over the caption when both an image and a link are present', async () => {
    const el = await mountCard({
      ...baseCardData,
      previewImageUrl: 'https://shots.xivdyetools.app/p1/a.webp',
      exampleLink: 'https://mirapri.com/100814',
    });

    const img = el.shadowRoot!.querySelector('img.shot-img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://shots.xivdyetools.app/p1/a.webp');
    expect(el.shadowRoot!.querySelector('.shot-caption')).toBeNull();
  });

  it('falls back to the palette-as-picture treatment when there is neither image nor link', async () => {
    const el = await mountCard({
      ...baseCardData,
      previewImageUrl: null,
      exampleLink: undefined,
    });

    expect(el.shadowRoot!.querySelector('img.shot-img')).toBeNull();
    expect(el.shadowRoot!.querySelector('.shot-caption')).toBeNull();
    const shot = el.shadowRoot!.querySelector('.shot') as HTMLElement | null;
    expect(shot).not.toBeNull();
    expect(shot!.getAttribute('style')).toContain('linear-gradient');
  });
});

/**
 * v4 color wheel — the rendered wheel.
 *
 * `__tests__/v4-color-wheel.test.ts` is the angle-table regression guard and
 * calls `getHarmonyAngles()` without ever mounting the element. This file is
 * the other half: what those angles actually produce on screen, and what the
 * two clickable surfaces emit.
 *
 * Node placement is checked by geometry rather than by exact percentage
 * strings where possible, but the base node's spoke is pinned exactly — a
 * regression in `hueToPosition`'s -90° offset would rotate the whole wheel
 * away from the "hue 0 sits at the top" convention the ring art assumes.
 *
 * The depth-stacking assertion is the load-bearing one: nodes sharing a spoke
 * (a monochromatic harmony, where every offset is 0°) must step inward, or the
 * wheel renders one puck where the user expects several.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Dye } from '@xivdyetools/types';
import type { V4ColorWheel } from '../../v4/v4-color-wheel';

const { mockT, mockTInterpolate, mockGetHarmonyType, mockLocalizedDyeName } = vi.hoisted(() => ({
  mockT: vi.fn((key: string) => key),
  mockTInterpolate: vi.fn(
    (key: string, params: Record<string, string | number>) =>
      `${key}(${Object.values(params).join(',')})`
  ),
  mockGetHarmonyType: vi.fn((key: string) => `harmony:${key}`),
  mockLocalizedDyeName: vi.fn((d: Dye) => `LOC:${d.name}`),
}));

vi.mock('@services/index', () => ({
  LanguageService: {
    t: mockT,
    tInterpolate: mockTInterpolate,
    getHarmonyType: mockGetHarmonyType,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));
vi.mock('@shared/dye-name', () => ({ localizedDyeName: mockLocalizedDyeName }));

const dye = (name: string): Dye => ({ name, itemID: 1, hex: '#000000' }) as unknown as Dye;

describe('V4ColorWheel rendering', () => {
  let el: V4ColorWheel;
  let container: HTMLElement;

  async function mount(props: Partial<V4ColorWheel> = {}): Promise<V4ColorWheel> {
    await import('../../v4/v4-color-wheel');
    el = document.createElement('v4-color-wheel') as V4ColorWheel;
    Object.assign(el, props);
    container.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const nodes = (): HTMLElement[] => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('.harmony-node'),
  ];
  const lines = (): HTMLElement[] => [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('.harmony-line'),
  ];
  const hub = (): HTMLButtonElement =>
    el.shadowRoot!.querySelector<HTMLButtonElement>('.main-swatch-display')!;
  const label = (): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('.harmony-label')!;

  /** Parse a node's `top`/`left` back into numbers, in percent. */
  function posOf(node: HTMLElement): { top: number; left: number } {
    return { top: parseFloat(node.style.top), left: parseFloat(node.style.left) };
  }

  /** Distance from the wheel centre (50%, 50%), in percent. */
  function radiusOf(node: HTMLElement): number {
    const { top, left } = posOf(node);
    return Math.hypot(top - 50, left - 50);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockT.mockImplementation((key: string) => key);
    mockTInterpolate.mockImplementation(
      (key: string, params: Record<string, string | number>) =>
        `${key}(${Object.values(params).join(',')})`
    );
    mockGetHarmonyType.mockImplementation((key: string) => `harmony:${key}`);
    mockLocalizedDyeName.mockImplementation((d: Dye) => `LOC:${d.name}`);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // --- empty state ---------------------------------------------------------

  it('shows a placeholder wheel with no colour chosen', async () => {
    await mount({ empty: true, harmonyType: 'triadic' });

    expect(hub().classList.contains('empty')).toBe(true);
    expect(hub().querySelector('.empty-placeholder')!.textContent).toBe('?');
    expect(hub().title).toBe('harmony.selectColorPrompt');
    expect(label().textContent!.trim()).toBe('harmony.selectColorPrompt');
    // Placeholder nodes and lines, one per harmony angle.
    expect(nodes()).toHaveLength(3);
    expect(lines()).toHaveLength(3);
    expect(nodes().every((n) => n.classList.contains('empty'))).toBe(true);
  });

  it('numbers the placeholder nodes after the first', async () => {
    await mount({ empty: true, harmonyType: 'triadic' });

    expect(nodes()[0].title).toBe('harmony.selectColorPrompt');
    expect(nodes()[1].title).toBe('harmony.harmonyN(1)');
    expect(nodes()[2].title).toBe('harmony.harmonyN(2)');
  });

  it('renders nothing but the hub when there is no base colour and no empty flag', async () => {
    await mount({ baseColor: '', empty: false });

    expect(nodes()).toHaveLength(0);
    expect(lines()).toHaveLength(0);
    expect(hub()).not.toBeNull();
  });

  // --- populated wheel ------------------------------------------------------

  it('renders one node per harmony angle plus the base', async () => {
    await mount({
      baseColor: '#ff0000',
      harmonyType: 'triadic',
      harmonyColors: ['#00ff00', '#0000ff'],
    });

    // triadic = [0, 120, 240] -> base node + 2 harmony nodes
    expect(nodes()).toHaveLength(3);
    expect(lines()).toHaveLength(3);
    expect(nodes()[0].classList.contains('main')).toBe(true);
    expect(
      nodes()
        .slice(1)
        .map((n) => n.textContent!.trim())
    ).toEqual(['1', '2']);
  });

  it('paints each node with its own harmony colour', async () => {
    await mount({
      baseColor: '#ff0000',
      harmonyType: 'complementary',
      harmonyColors: ['#00ffff'],
    });

    expect(nodes()[0].style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(nodes()[1].style.backgroundColor).toBe('rgb(0, 255, 255)');
  });

  it('falls back to the base colour for a harmony slot with no colour supplied', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'complementary', harmonyColors: [] });

    expect(nodes()[1].style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('puts hue 0 at the top of the wheel', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'complementary' });

    // Red is hue 0; -90° offset places it straight up: left 50%, top 8% (50-42).
    const { top, left } = posOf(nodes()[0]);
    expect(left).toBeCloseTo(50, 5);
    expect(top).toBeCloseTo(8, 5);
  });

  it('places the complement diametrically opposite the base', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'complementary' });

    const base = posOf(nodes()[0]);
    const complement = posOf(nodes()[1]);
    expect(complement.left).toBeCloseTo(100 - base.left, 5);
    expect(complement.top).toBeCloseTo(100 - base.top, 5);
  });

  it('keeps every node on the same ring when the spokes differ', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'triadic' });

    for (const node of nodes()) expect(radiusOf(node)).toBeCloseTo(42, 5);
  });

  it('steps coincident nodes inward so none hides under another', async () => {
    // Monochromatic is every offset on one spoke — without depth stacking all
    // four nodes would land on the same point.
    await mount({
      baseColor: '#ff0000',
      harmonyType: 'monochromatic',
      harmonyColors: ['#cc0000', '#990000', '#660000'],
    });

    const radii = nodes().map(radiusOf);
    expect(radii.length).toBeGreaterThan(1);
    // Each successive node sits 13% further in.
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeCloseTo(radii[i - 1] - 13, 5);
    }
    // ...and no two share a position.
    const seen = new Set(nodes().map((n) => `${n.style.top}|${n.style.left}`));
    expect(seen.size).toBe(nodes().length);
  });

  it('scales the connection lines with the wheel size', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'complementary', size: 400 });

    expect(lines()[0].style.width).toBe('140px'); // 400 * 0.35
  });

  // --- node titles ----------------------------------------------------------

  it('titles the base node with its hex, upper-cased', async () => {
    await mount({ baseColor: '#ab12cd', harmonyType: 'complementary' });

    expect(nodes()[0].title).toBe('harmony.baseColorTitle(#AB12CD)');
  });

  it('titles a harmony node with its dye name when one is supplied', async () => {
    await mount({
      baseColor: '#ff0000',
      harmonyType: 'complementary',
      harmonyColors: ['#00ffff'],
      harmonyDyes: [dye('Ceruleum Blue')],
    });

    expect(nodes()[1].title).toBe('harmony.harmonyN(1) · LOC:Ceruleum Blue');
  });

  it('falls back to the hex when no dye is supplied for a slot', async () => {
    await mount({
      baseColor: '#ff0000',
      harmonyType: 'complementary',
      harmonyColors: ['#00ffff'],
      harmonyDyes: [],
    });

    expect(nodes()[1].title).toBe('harmony.harmonyN(1) · #00FFFF');
    expect(mockLocalizedDyeName).not.toHaveBeenCalled();
  });

  // --- the hub --------------------------------------------------------------

  it('shows the dye name in the hub, preferring it over the hex', async () => {
    await mount({ baseColor: '#ff0000', baseName: 'Dalamud Red' });

    expect(hub().querySelector('.hub-name')!.textContent).toBe('Dalamud Red');
    expect(hub().querySelector('.hub-label')!.textContent).toBe('harmony.baseColorSection');
    expect(hub().title).toBe('harmony.selectDye');
  });

  it('falls back to the upper-cased hex when the dye has no name', async () => {
    await mount({ baseColor: '#ff0000', baseName: '' });

    expect(hub().querySelector('.hub-name')!.textContent).toBe('#FF0000');
  });

  it('tints the hub with the base colour and a matching glow', async () => {
    await mount({ baseColor: '#ff0000' });

    expect(hub().getAttribute('style')).toContain('background-color: #ff0000');
    expect(hub().getAttribute('style')).toContain('box-shadow: 0 0 30px #ff000040');
  });

  // --- readable ink ---------------------------------------------------------

  it.each([
    { hex: '#ffffff', label: 'light', ink: 'rgba(10,10,12,0.8)' },
    { hex: '#000000', label: 'dark', ink: 'rgba(255,255,255,0.9)' },
  ])('picks readable ink for a $label puck', async ({ hex, ink }) => {
    await mount({ baseColor: '#808080', harmonyType: 'complementary', harmonyColors: [hex] });

    expect(nodes()[1].getAttribute('style')).toContain(`color: ${ink}`);
  });

  // --- interaction ----------------------------------------------------------

  it('emits node-click with the colour and hue of the base node', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'complementary' });
    const seen: unknown[] = [];
    el.addEventListener('node-click', (e) => seen.push((e as CustomEvent).detail));

    nodes()[0].click();

    expect(seen).toEqual([{ color: '#ff0000', hue: 0 }]);
  });

  it('emits node-click with the harmony slot colour and its rotated hue', async () => {
    await mount({
      baseColor: '#ff0000',
      harmonyType: 'complementary',
      harmonyColors: ['#00ffff'],
    });
    const seen: { color: string; hue: number }[] = [];
    el.addEventListener('node-click', (e) =>
      seen.push((e as CustomEvent<{ color: string; hue: number }>).detail)
    );

    nodes()[1].click();

    expect(seen).toEqual([{ color: '#00ffff', hue: 180 }]);
  });

  it('emits hub-click when the centre is tapped', async () => {
    await mount({ baseColor: '#ff0000' });
    const seen: unknown[] = [];
    el.addEventListener('hub-click', (e) => seen.push((e as CustomEvent).detail));

    hub().click();

    expect(seen).toHaveLength(1);
  });

  it('lets both events escape the shadow tree', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'complementary' });
    const outside: string[] = [];
    container.addEventListener('node-click', () => outside.push('node'));
    container.addEventListener('hub-click', () => outside.push('hub'));

    nodes()[0].click();
    hub().click();

    expect(outside).toEqual(['node', 'hub']);
  });

  // --- hue extraction -------------------------------------------------------

  it.each([
    { hex: '#ff0000', hue: 0, name: 'red' },
    { hex: '#00ff00', hue: 120, name: 'green' },
    { hex: '#0000ff', hue: 240, name: 'blue' },
    { hex: '#ffff00', hue: 60, name: 'yellow' },
    { hex: '#ff00ff', hue: 300, name: 'magenta' },
    { hex: '#808080', hue: 0, name: 'grey (no chroma)' },
  ])('derives hue $hue from $name', async ({ hex, hue }) => {
    await mount({ baseColor: hex, harmonyType: 'complementary' });
    const seen: { hue: number }[] = [];
    el.addEventListener('node-click', (e) => seen.push((e as CustomEvent<{ hue: number }>).detail));

    nodes()[0].click();

    expect(seen[0].hue).toBe(hue);
  });

  it('treats a malformed hex as hue 0 rather than NaN', async () => {
    await mount({ baseColor: '#f00', harmonyType: 'complementary' });
    const seen: { hue: number }[] = [];
    el.addEventListener('node-click', (e) => seen.push((e as CustomEvent<{ hue: number }>).detail));

    nodes()[0].click();

    expect(seen[0].hue).toBe(0);
    expect(Number.isNaN(posOf(nodes()[0]).top)).toBe(false);
  });

  // --- harmony label --------------------------------------------------------

  it('camel-cases the kebab harmony id before looking up its name', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'split-complementary' });

    expect(mockGetHarmonyType).toHaveBeenCalledWith('splitComplementary');
    expect(label().textContent!.trim()).toBe('harmony:splitComplementary');
  });

  it('camel-cases inverted-tetradic too', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'inverted-tetradic' });

    expect(mockGetHarmonyType).toHaveBeenCalledWith('invertedTetradic');
  });

  it('passes a single-word harmony id through unchanged', async () => {
    await mount({ baseColor: '#ff0000', harmonyType: 'triadic' });

    expect(mockGetHarmonyType).toHaveBeenCalledWith('triadic');
  });
});

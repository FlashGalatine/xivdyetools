/**
 * BUG-027 (2026-10-04 deep-dive): the sidebar is mounted once and stays
 * mounted across tool switches, so every panel has to FOLLOW the
 * ConfigController, not only lead it. Before the fix it followed 'swatch' and
 * 'harmony' alone; the other nine keys were copied once at mount, so a write
 * from a tool, a reset, an import or another tab left the controls stale, and
 * the next display-option or dye-filter toggle wrote the stale set back over
 * a reset.
 *
 * Real ConfigController and real jsdom localStorage, as in the wheel test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@components/v4/config-sidebar';
import { ConfigController } from '@services/config-controller';
import { LanguageService } from '@services/index';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import type { ConfigKey, MarketConfig, ToolConfigMap } from '@shared/tool-config-types';

type Updatable = HTMLElement & { updateComplete: Promise<unknown> };
type SidebarEl = Updatable & { activeTool: string };
type ToggleEl = Updatable & { checked: boolean; label?: string };

/** Every key the sidebar mirrors: all ConfigKeys except 'advanced'. */
const MIRRORED_KEYS: ConfigKey[] = [
  'global',
  'market',
  'harmony',
  'extractor',
  'accessibility',
  'comparison',
  'gradient',
  'mixer',
  'presets',
  'budget',
  'swatch',
];

async function mount(tool: string): Promise<SidebarEl> {
  const el = document.createElement('v4-config-sidebar') as SidebarEl;
  el.activeTool = tool;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** Let the sidebar, then one visible child component, then its toggles settle. */
async function settled(el: SidebarEl, childTag: string): Promise<Updatable> {
  await el.updateComplete;
  const child = el.shadowRoot!.querySelector<Updatable>(
    `.config-section:not([hidden]) ${childTag}`
  )!;
  expect(child).toBeTruthy();
  await child.updateComplete;
  await Promise.all(
    [...child.shadowRoot!.querySelectorAll<ToggleEl>('v4-toggle-switch')].map(
      (t) => t.updateComplete
    )
  );
  return child;
}

/** The visible child's toggle with this label, clicked the way a user would. */
async function clickToggle(el: SidebarEl, childTag: string, labelKey: string): Promise<void> {
  const child = await settled(el, childTag);
  const label = LanguageService.t(labelKey);
  const toggle = [...child.shadowRoot!.querySelectorAll<ToggleEl>('v4-toggle-switch')].find(
    (t) => t.label === label
  );
  expect(toggle, `toggle labelled "${label}"`).toBeTruthy();
  toggle!.shadowRoot!.querySelector<HTMLElement>('.toggle-wrapper')!.click();
  await settled(el, childTag);
}

describe('config-sidebar follows the ConfigController (BUG-027)', () => {
  let el: SidebarEl | undefined;

  beforeEach(() => {
    localStorage.clear();
    ConfigController.resetInstance();
  });

  afterEach(() => {
    el?.remove();
    el = undefined;
    vi.restoreAllMocks();
    localStorage.clear();
    ConfigController.resetInstance();
  });

  it('shows the market toggle on after another component turns prices on', async () => {
    el = await mount('budget');
    const toggle = () =>
      el!.shadowRoot!.querySelector<ToggleEl>('.market-config v4-toggle-switch')!;
    expect(toggle().checked).toBe(false);

    // Driven straight through the controller, not through budget-tool's
    // setShowPrices(true) on mount: BUG-079 may remove that write.
    ConfigController.getInstance().setConfig('market', { showPrices: true });
    await el.updateComplete;

    expect(toggle().checked).toBe(true);
  });

  it('shows the mixing mode the Mixer tool wrote', async () => {
    el = await mount('mixer');
    const select = () =>
      el!
        .shadowRoot!.querySelector<HTMLOptionElement>('option[value="spectral"]')!
        .closest('select')!;
    expect(select().value).toBe('ryb');

    ConfigController.getInstance().setConfig('mixer', { mixingMode: 'spectral' });
    await el.updateComplete;

    expect(select().value).toBe('spectral');
  });

  it('a display-option toggle after Reset settings writes the reset values plus that one flip', async () => {
    el = await mount('budget');
    const controller = ConfigController.getInstance();

    await clickToggle(el, 'v4-display-options', 'config.hexCodes');
    expect(controller.getConfig('global').displayOptions.showHex).toBe(false);

    controller.resetAllConfigs();
    await clickToggle(el, 'v4-display-options', 'config.rgbValues');

    const expected = { ...DEFAULT_DISPLAY_OPTIONS, showRgb: false };
    expect(controller.getConfig('global').displayOptions).toEqual(expected);
    expect(controller.getConfig('budget').displayOptions).toEqual(expected);
  });

  it('a display-option toggle after an import keeps the imported values', async () => {
    el = await mount('budget');
    const controller = ConfigController.getInstance();

    controller.importConfigs({
      global: {
        theme: '',
        displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, showHex: false },
        dyeFilters: { ...DEFAULT_DYE_FILTERS },
      },
    });
    await clickToggle(el, 'v4-display-options', 'config.rgbValues');

    expect(controller.getConfig('global').displayOptions).toEqual({
      ...DEFAULT_DISPLAY_OPTIONS,
      showHex: false,
      showRgb: false,
    });
  });

  it('a dye-filter toggle after Reset settings writes the reset values plus that one flip', async () => {
    el = await mount('budget');
    const controller = ConfigController.getInstance();

    await clickToggle(el, 'v4-dye-filters', 'filters.excludeMetallic');
    expect(controller.getConfig('global').dyeFilters.excludeMetallic).toBe(true);

    controller.resetAllConfigs();
    await clickToggle(el, 'v4-dye-filters', 'filters.excludePastel');

    const expected = { ...DEFAULT_DYE_FILTERS, excludePastel: true };
    expect(controller.getConfig('global').dyeFilters).toEqual(expected);
    expect(controller.getConfig('budget').dyeFilters).toEqual(expected);
  });

  it('subscribes once per mirrored key and releases every subscription on removal', async () => {
    const controller = ConfigController.getInstance();
    const realSubscribe = controller.subscribe.bind(controller);
    const released: ConfigKey[] = [];
    const subscribe = vi.spyOn(controller, 'subscribe').mockImplementation(((
      key: ConfigKey,
      listener: (config: ToolConfigMap[ConfigKey]) => void
    ) => {
      const unsubscribe = realSubscribe(key, listener);
      return () => {
        released.push(key);
        unsubscribe();
      };
    }) as ConfigController['subscribe']);

    el = await mount('budget');
    expect(subscribe.mock.calls.map(([key]) => key).sort()).toEqual([...MIRRORED_KEYS].sort());

    el.remove();
    expect([...released].sort()).toEqual([...MIRRORED_KEYS].sort());

    // Detached, it no longer follows.
    controller.setConfig('market', { showPrices: true });
    expect((el as unknown as { marketConfig: MarketConfig }).marketConfig.showPrices).toBe(false);

    // Re-attaching subscribes afresh, once, and the next removal releases those.
    document.body.appendChild(el);
    await el.updateComplete;
    expect(subscribe).toHaveBeenCalledTimes(MIRRORED_KEYS.length * 2);
    el.remove();
    expect(released).toHaveLength(MIRRORED_KEYS.length * 2);
  });
});

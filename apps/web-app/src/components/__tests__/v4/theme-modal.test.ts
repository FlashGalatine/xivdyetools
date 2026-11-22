/**
 * Theme modal — a tap on a theme goes through the shared `switchTheme`
 * (services/theme-switch.ts), which is the one place a deliberate change is
 * recorded for telemetry. The modal itself never calls ThemeService.setTheme
 * or TelemetryService directly, so it cannot emit or miss the event on its own.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestContainer, cleanupTestContainer } from '../../../__tests__/component-utils';
import { ModalContainer } from '../../modal-container';

const { mockSwitchTheme, mockUnsubscribe } = vi.hoisted(() => ({
  mockSwitchTheme: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock('@services/theme-service', () => ({
  ThemeService: {
    getCurrentTheme: () => 'standard-dark',
    getAllThemes: () => [
      {
        name: 'standard-light',
        palette: { background: '#fff', cardBackground: '#eee', primary: '#00f' },
      },
      {
        name: 'standard-dark',
        palette: { background: '#000', cardBackground: '#111', primary: '#0ff' },
      },
    ],
    subscribe: vi.fn().mockReturnValue(mockUnsubscribe),
    setTheme: vi.fn(),
  },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: { t: (k: string) => k },
}));
vi.mock('@services/theme-switch', () => ({ switchTheme: mockSwitchTheme }));

import { showThemeModal } from '../../v4/theme-modal';
import { ModalService } from '@services/modal-service';
import { ThemeService } from '@services/theme-service';

describe('theme modal theme switching', () => {
  let container: HTMLElement;
  let modalContainer: ModalContainer;

  beforeEach(() => {
    vi.clearAllMocks();
    container = createTestContainer();
    modalContainer = new ModalContainer(container);
    modalContainer.init();
  });

  afterEach(() => {
    ModalService.dismissAll();
    modalContainer.destroy();
    cleanupTestContainer(container);
  });

  it('applies a tap on the other theme through the shared switch', () => {
    showThemeModal();
    const light = container.querySelector<HTMLButtonElement>('[data-theme="standard-light"]')!;
    light.click();
    expect(mockSwitchTheme).toHaveBeenCalledWith('standard-light');
    expect(ThemeService.setTheme).not.toHaveBeenCalled();
  });

  it('applies a re-tap of the current theme through the same switch (live preview)', () => {
    showThemeModal();
    const dark = container.querySelector<HTMLButtonElement>('[data-theme="standard-dark"]')!;
    dark.click();
    // switchTheme decides that nothing changed and records nothing — see theme-switch.test.ts
    expect(mockSwitchTheme).toHaveBeenCalledWith('standard-dark');
  });

  it('releases the theme subscription on Done and can reopen the picker', () => {
    showThemeModal();

    const done = container.querySelector<HTMLButtonElement>('[data-action="confirm"]')!;
    expect(done.textContent).toBe('common.done');
    done.click();

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

    showThemeModal();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(ThemeService.subscribe).toHaveBeenCalledTimes(2);
  });
});

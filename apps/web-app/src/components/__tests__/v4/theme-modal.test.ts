/**
 * Theme modal — a tap on a theme goes through the shared `switchTheme`
 * (services/theme-switch.ts), which is the one place a deliberate change is
 * recorded for telemetry. The modal itself never calls ThemeService.setTheme
 * or TelemetryService directly, so it cannot emit or miss the event on its own.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockShow, mockSwitchTheme } = vi.hoisted(() => ({
  mockShow: vi.fn().mockReturnValue('modal-1'),
  mockSwitchTheme: vi.fn(),
}));

vi.mock('@services/modal-service', () => ({
  ModalService: { show: mockShow, dismiss: vi.fn() },
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
    subscribe: vi.fn().mockReturnValue(() => {}),
    setTheme: vi.fn(),
  },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: { t: (k: string) => k },
}));
vi.mock('@services/theme-switch', () => ({ switchTheme: mockSwitchTheme }));

import { showThemeModal } from '../../v4/theme-modal';
import { ThemeService } from '@services/theme-service';

function contentOf(): HTMLElement {
  return mockShow.mock.calls[0][0].content as HTMLElement;
}

describe('theme modal theme switching', () => {
  beforeEach(() => {
    mockShow.mockClear();
    mockSwitchTheme.mockClear();
    vi.mocked(ThemeService.setTheme).mockClear();
  });

  afterEach(() => {
    // The module keeps a singleton; close it so the next test gets a fresh show()
    const onClose = mockShow.mock.calls[0]?.[0]?.onClose as (() => void) | undefined;
    onClose?.();
  });

  it('applies a tap on the other theme through the shared switch', () => {
    showThemeModal();
    const light = contentOf().querySelector<HTMLButtonElement>('[data-theme="standard-light"]')!;
    light.click();
    expect(mockSwitchTheme).toHaveBeenCalledWith('standard-light');
    expect(ThemeService.setTheme).not.toHaveBeenCalled();
  });

  it('applies a re-tap of the current theme through the same switch (live preview)', () => {
    showThemeModal();
    const dark = contentOf().querySelector<HTMLButtonElement>('[data-theme="standard-dark"]')!;
    dark.click();
    // switchTheme decides that nothing changed and records nothing — see theme-switch.test.ts
    expect(mockSwitchTheme).toHaveBeenCalledWith('standard-dark');
  });
});

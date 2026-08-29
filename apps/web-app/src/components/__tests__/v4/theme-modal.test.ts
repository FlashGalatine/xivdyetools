/**
 * Theme modal — the theme_change telemetry hook. Only a deliberate pick of a
 * DIFFERENT theme counts; re-tapping the current one, and ThemeService's own
 * boot/migration, never do.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockShow, mockSetTheme, mockTrack } = vi.hoisted(() => ({
  mockShow: vi.fn().mockReturnValue('modal-1'),
  mockSetTheme: vi.fn(),
  mockTrack: vi.fn(),
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
    setTheme: mockSetTheme,
  },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: { t: (k: string) => k },
}));
vi.mock('@services/telemetry-service', () => ({
  TelemetryService: { track: mockTrack },
}));

import { showThemeModal } from '../../v4/theme-modal';

function contentOf(): HTMLElement {
  return mockShow.mock.calls[0][0].content as HTMLElement;
}

describe('theme modal telemetry', () => {
  beforeEach(() => {
    mockShow.mockClear();
    mockSetTheme.mockClear();
    mockTrack.mockClear();
  });

  afterEach(() => {
    // The module keeps a singleton; close it so the next test gets a fresh show()
    const onClose = mockShow.mock.calls[0]?.[0]?.onClose as (() => void) | undefined;
    onClose?.();
  });

  it('tracks a switch to the other theme', () => {
    showThemeModal();
    const light = contentOf().querySelector<HTMLButtonElement>('[data-theme="standard-light"]')!;
    light.click();
    expect(mockSetTheme).toHaveBeenCalledWith('standard-light');
    expect(mockTrack).toHaveBeenCalledWith('theme_change', { to: 'standard-light' });
  });

  it('does not track re-picking the current theme', () => {
    showThemeModal();
    const dark = contentOf().querySelector<HTMLButtonElement>('[data-theme="standard-dark"]')!;
    dark.click();
    expect(mockSetTheme).toHaveBeenCalledWith('standard-dark');
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

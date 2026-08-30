/**
 * theme-switch — the one path that records a deliberate theme change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetCurrentTheme, mockSetTheme, mockToggledVariant, mockTrack } = vi.hoisted(() => ({
  mockGetCurrentTheme: vi.fn(),
  mockSetTheme: vi.fn(),
  mockToggledVariant: vi.fn(),
  mockTrack: vi.fn(),
}));

vi.mock('../theme-service', () => ({
  ThemeService: {
    getCurrentTheme: mockGetCurrentTheme,
    setTheme: mockSetTheme,
    toggledVariant: mockToggledVariant,
  },
}));
vi.mock('../telemetry-service', () => ({
  TelemetryService: { track: mockTrack },
}));

import { switchTheme, toggleThemeVariant } from '../theme-switch';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentTheme.mockReturnValue('standard-dark');
});

describe('switchTheme', () => {
  it('records the change BEFORE applying it, so the queued events keep the outgoing theme', () => {
    switchTheme('standard-light');

    expect(mockTrack).toHaveBeenCalledWith('theme_change', { to: 'standard-light' });
    expect(mockSetTheme).toHaveBeenCalledWith('standard-light');
    expect(mockTrack.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetTheme.mock.invocationCallOrder[0]
    );
  });

  it('applies a re-pick of the current theme without recording a change', () => {
    switchTheme('standard-dark');

    expect(mockSetTheme).toHaveBeenCalledWith('standard-dark');
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

describe('toggleThemeVariant', () => {
  it('switches to the counterpart variant and records it', () => {
    mockToggledVariant.mockReturnValue('standard-light');

    toggleThemeVariant();

    expect(mockTrack).toHaveBeenCalledWith('theme_change', { to: 'standard-light' });
    expect(mockSetTheme).toHaveBeenCalledWith('standard-light');
  });

  it('is a no-op when the current theme has no counterpart', () => {
    mockToggledVariant.mockReturnValue(null);

    toggleThemeVariant();

    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

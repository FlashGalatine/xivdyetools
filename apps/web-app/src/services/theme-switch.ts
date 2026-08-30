/**
 * Deliberate, user-initiated theme changes — the ONE path that records the
 * `theme_change` telemetry event. `ThemeService.setTheme` itself stays silent,
 * so the boot apply, the legacy-name migration and a settings import never
 * count (spec: docs/superpowers/specs/2026-08-29-web-analytics-design.md).
 *
 * Every UI that switches the theme on the user's behalf — the theme modal, the
 * Shift+T shortcut — goes through here rather than calling ThemeService
 * directly, so no switch can emit or miss the event on its own.
 *
 * @module services/theme-switch
 */

import { ThemeService } from './theme-service';
import { TelemetryService } from './telemetry-service';
import type { ThemeName } from '@shared/types';

/** Apply `to`; records `theme_change` only when it differs from the current theme. */
export function switchTheme(to: ThemeName): void {
  // Tracked BEFORE the switch is applied: TelemetryService flushes its queue on
  // theme_change, so the events queued so far go out under the outgoing theme.
  if (to !== ThemeService.getCurrentTheme()) {
    TelemetryService.track('theme_change', { to });
  }
  ThemeService.setTheme(to);
}

/** Light ↔ Dark (Shift+T). No-op when the current theme has no counterpart. */
export function toggleThemeVariant(): void {
  const to = ThemeService.toggledVariant();
  if (to === null) return;
  switchTheme(to);
}

/**
 * TelemetryService — opt-in, identifier-free usage telemetry.
 *
 * Spec: docs/superpowers/specs/2026-08-29-web-analytics-design.md
 *
 * Events queue in memory and are beaconed to api-worker's POST /v1/telemetry
 * as a `text/plain` JSON batch (CORS-safelisted, so no preflight). Nothing is
 * written to storage, no session or client id exists, and the envelope is
 * five coarse dimensions (version, env, locale, theme, viewport bucket).
 *
 * Gating: `advanced.analyticsEnabled` (default OFF) AND not
 * `navigator.globalPrivacyControl`. Turning the toggle off drops the queue —
 * in every tab: ConfigController re-reads a config another tab saved
 * (StorageEvent) and notifies its subscribers, so the switch reaches here.
 *
 * The batch envelope (theme, locale, viewport) is read when a batch is sent,
 * so a `theme_change` flushes whatever is queued first — the events before
 * the switch go out under the theme they happened in.
 *
 * @module services/telemetry-service
 */

import { ConfigController } from './config-controller';
import { LanguageService } from './language-service';
import { ThemeService } from './theme-service';
import { RouterService, type ToolId } from './router-service';
import { getApiWorkerBase } from './api-worker-origin';
import { APP_ENV, APP_VERSION } from '@shared/constants';
import { logger } from '@shared/logger';
import type { AdvancedConfig } from '@shared/tool-config-types';

export type TelemetryEventName =
  'tool_view' | 'tool_leave' | 'dye_pick' | 'chara_parse' | 'theme_change';
export type ToolEntry = 'initial' | 'share' | 'nav';
export type DyePickVia = 'drawer' | 'grid';
export type TelemetryProps = Record<string, string | number | boolean>;
export interface TelemetryEvent {
  n: TelemetryEventName;
  p: TelemetryProps;
  d?: number;
}

type Producer = 'anamnesis' | 'ktisis' | 'brio' | 'other' | 'none';
type ViewportBucket = 'm' | 't' | 'd';

export class TelemetryService {
  /** Flush threshold — api-worker accepts 25 per batch; leave headroom for a trailing tool_leave. */
  static readonly MAX_BATCH = 20;
  static readonly FLUSH_DELAY_MS = 15_000;
  static readonly DWELL_CAP_S = 1800;

  private static initialized = false;
  private static toggleOn = false;
  private static queue: TelemetryEvent[] = [];
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static unsubscribeConfig: (() => void) | null = null;

  private static currentTool: { tool: ToolId; entry: ToolEntry } | null = null;
  /** `Date.now()` when the current visible stretch began; null while hidden or idle. */
  private static visibleSince: number | null = null;
  private static accumulatedMs = 0;
  /** The last tool endTool() closed out — restored (no new tool_view) on a bfcache pageshow. */
  private static lastEnded: { tool: ToolId; entry: ToolEntry } | null = null;

  private static readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      TelemetryService.pauseClock();
      TelemetryService.flush();
    } else {
      TelemetryService.resumeClock();
    }
  };
  private static readonly onPageHide = (): void => {
    // The only close-out that arms the bfcache restore below.
    TelemetryService.closeTool(true);
    TelemetryService.flush();
  };
  /**
   * bfcache restore: the page was frozen (pagehide already emitted tool_leave)
   * rather than reloaded, so there is no fresh boot — resume the dwell clock
   * on the tool that was showing without emitting another tool_view. The
   * remembered tool is consumed here (startTool clears it), so a restore can
   * never re-arm a tool that was closed by a switch or a failed load.
   */
  private static readonly onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted && !TelemetryService.currentTool && TelemetryService.lastEnded) {
      const { tool, entry } = TelemetryService.lastEnded;
      TelemetryService.startTool(tool, entry);
    }
  };

  static initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const controller = ConfigController.getInstance();
    this.toggleOn = controller.getConfig('advanced').analyticsEnabled;
    this.unsubscribeConfig = controller.subscribe('advanced', (config: AdvancedConfig) => {
      const next = config.analyticsEnabled;
      if (next === this.toggleOn) return;
      this.toggleOn = next;
      if (next) {
        // Opt-in mid-visit: dwell starts now, not at page load.
        this.accumulatedMs = 0;
        this.visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
      } else {
        this.dropQueue();
      }
      logger.debug(`[Telemetry] ${next ? 'enabled' : 'disabled'}`);
    });

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);
  }

  static isEnabled(): boolean {
    return this.toggleOn && navigator.globalPrivacyControl !== true;
  }

  static track(name: TelemetryEventName, props: TelemetryProps, value?: number): void {
    try {
      if (!this.isEnabled()) return;
      // Callers track a theme switch BEFORE applying it (services/theme-switch.ts):
      // send the queue now so its envelope still carries the outgoing theme.
      if (name === 'theme_change') this.flush();
      const event: TelemetryEvent = { n: name, p: props };
      if (value !== undefined) event.d = value;
      this.queue.push(event);
      if (this.queue.length >= this.MAX_BATCH) {
        this.flush();
      } else if (this.flushTimer === null) {
        this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_DELAY_MS);
      }
    } catch (error) {
      logger.debug('[Telemetry] track failed', error);
    }
  }

  /** A deliberate dye pick — the tool is the current route. */
  static trackDyePick(stainID: number, via: DyePickVia): void {
    this.track('dye_pick', { tool: RouterService.getCurrentToolId(), stainID, via });
  }

  /** Begin timing a tool view. Any tool already being timed is ended first. */
  static startTool(tool: ToolId, entry: ToolEntry): void {
    this.endTool();
    this.lastEnded = null;
    this.currentTool = { tool, entry };
    this.accumulatedMs = 0;
    this.visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  }

  /**
   * Emit tool_leave for the tool being timed (no-op when none). This is the
   * tool-switch close-out: it never arms the bfcache restore — only pagehide
   * does — so a Back/Forward round trip while the next tool is still loading
   * cannot resurrect the tool that was just left.
   */
  static endTool(): void {
    this.closeTool(false);
  }

  private static closeTool(rememberForRestore: boolean): void {
    const current = this.currentTool;
    this.lastEnded = null;
    if (!current) return;
    this.pauseClock();
    const seconds = Math.max(0, Math.min(Math.round(this.accumulatedMs / 1000), this.DWELL_CAP_S));
    this.currentTool = null;
    this.accumulatedMs = 0;
    if (rememberForRestore) this.lastEnded = { tool: current.tool, entry: current.entry };
    this.track('tool_leave', { tool: current.tool, entry: current.entry }, seconds);
  }

  /** `.chara` `TypeName` → allowlisted producer bucket (never the raw string). */
  static normalizeProducer(typeName: string | null): Producer {
    if (typeName === null) return 'none';
    const lower = typeName.toLowerCase();
    if (lower.includes('anamnesis')) return 'anamnesis';
    if (lower.includes('ktisis')) return 'ktisis';
    if (lower.includes('brio')) return 'brio';
    return 'other';
  }

  static flush(): void {
    try {
      this.clearTimer();
      if (this.queue.length === 0 || !this.isEnabled()) {
        this.queue = [];
        return;
      }
      const body = JSON.stringify({
        v: 1,
        ver: APP_VERSION,
        env: APP_ENV,
        locale: LanguageService.getCurrentLocale(),
        theme: ThemeService.getCurrentTheme(),
        vp: this.viewportBucket(),
        events: this.queue,
      });
      this.queue = [];
      this.send(body);
    } catch (error) {
      this.queue = [];
      logger.debug('[Telemetry] flush failed', error);
    }
  }

  /** Tests only — detach listeners and forget everything. */
  static reset(): void {
    this.clearTimer();
    this.queue = [];
    this.toggleOn = false;
    this.unsubscribeConfig?.();
    this.unsubscribeConfig = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onPageShow);
    this.initialized = false;
    this.currentTool = null;
    this.accumulatedMs = 0;
    this.visibleSince = null;
    this.lastEnded = null;
  }

  // --------------------------------------------------------------------------

  private static send(body: string): void {
    const url = `${getApiWorkerBase()}/v1/telemetry`;
    // A string body goes out as text/plain — CORS-safelisted, no preflight.
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, body)) return;
    void fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
    }).catch((error: unknown) => logger.debug('[Telemetry] fetch fallback failed', error));
  }

  private static viewportBucket(): ViewportBucket {
    const width = window.innerWidth;
    if (width < 768) return 'm';
    if (width < 1024) return 't';
    return 'd';
  }

  private static dropQueue(): void {
    this.clearTimer();
    this.queue = [];
  }

  private static pauseClock(): void {
    if (this.visibleSince !== null) {
      // Wall clock: a backwards step (NTP, manual change) must not go negative
      this.accumulatedMs += Math.max(0, Date.now() - this.visibleSince);
      this.visibleSince = null;
    }
  }

  private static resumeClock(): void {
    if (this.currentTool && this.visibleSince === null) {
      this.visibleSince = Date.now();
    }
  }

  private static clearTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

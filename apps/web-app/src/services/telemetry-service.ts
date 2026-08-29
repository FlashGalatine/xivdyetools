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
 * `navigator.globalPrivacyControl`. Turning the toggle off drops the queue.
 *
 * @module services/telemetry-service
 */

import { ConfigController } from './config-controller';
import { LanguageService } from './language-service';
import { ThemeService } from './theme-service';
import { RouterService } from './router-service';
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

  private static initialized = false;
  private static toggleOn = false;
  private static queue: TelemetryEvent[] = [];
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static unsubscribeConfig: (() => void) | null = null;

  private static readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') TelemetryService.flush();
  };
  private static readonly onPageHide = (): void => {
    TelemetryService.flush();
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
      if (!next) this.dropQueue();
      logger.debug(`[Telemetry] ${next ? 'enabled' : 'disabled'}`);
    });

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
  }

  static isEnabled(): boolean {
    return this.toggleOn && navigator.globalPrivacyControl !== true;
  }

  static track(name: TelemetryEventName, props: TelemetryProps, value?: number): void {
    try {
      if (!this.isEnabled()) return;
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
    this.initialized = false;
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

  private static clearTimer(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

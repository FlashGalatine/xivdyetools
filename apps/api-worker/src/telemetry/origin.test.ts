/**
 * Origin gate for `POST /v1/telemetry` (FINDING-014, 2026-08-29 audit).
 *
 * The gate decides two things at once: whether the batch is written at all,
 * and which `env` dimension it lands under. Both matter — before it, any
 * third-party page could beacon allowlisted events from its visitors, and the
 * `env` blob was whatever the body claimed.
 */
import { describe, it, expect } from 'vitest';
import { resolveTelemetryOrigin } from './origin';

describe('resolveTelemetryOrigin', () => {
  it('maps the two web-app origins onto their environment', () => {
    expect(resolveTelemetryOrigin('https://xivdyetools.app', 'production')).toEqual({
      accepted: true,
      env: 'production',
    });
    expect(resolveTelemetryOrigin('https://beta.xivdyetools.app', 'production')).toEqual({
      accepted: true,
      env: 'beta',
    });
  });

  it('accepts the listed origins on a non-production worker too', () => {
    expect(resolveTelemetryOrigin('https://beta.xivdyetools.app', 'development')).toEqual({
      accepted: true,
      env: 'beta',
    });
  });

  it('rejects a missing or opaque Origin', () => {
    expect(resolveTelemetryOrigin(null, 'production')).toEqual({ accepted: false });
    expect(resolveTelemetryOrigin('', 'production')).toEqual({ accepted: false });
    // Browsers serialize an opaque origin (sandboxed iframe, file://) as "null".
    expect(resolveTelemetryOrigin('null', 'production')).toEqual({ accepted: false });
  });

  it('rejects a listed host on the wrong scheme', () => {
    expect(resolveTelemetryOrigin('http://xivdyetools.app', 'production')).toEqual({
      accepted: false,
    });
    expect(resolveTelemetryOrigin('http://beta.xivdyetools.app', 'production')).toEqual({
      accepted: false,
    });
  });

  it('rejects look-alike origins that merely contain a listed one', () => {
    for (const origin of [
      'https://xivdyetools.app.evil.example',
      'https://evil.example',
      'https://notxivdyetools.app',
      'https://beta.xivdyetools.app.evil.example',
      'https://xivdyetools.app:8443',
      'https://evil.example?https://xivdyetools.app',
    ]) {
      expect(resolveTelemetryOrigin(origin, 'production'), origin).toEqual({ accepted: false });
      expect(resolveTelemetryOrigin(origin, 'development'), origin).toEqual({ accepted: false });
    }
  });

  it('accepts loopback origins on a non-production worker and leaves env to the body', () => {
    for (const origin of [
      'http://localhost:5173',
      'http://localhost',
      'http://127.0.0.1:8787',
      'http://127.0.0.1',
    ]) {
      expect(resolveTelemetryOrigin(origin, 'development'), origin).toEqual({
        accepted: true,
        env: undefined,
      });
    }
    // ENVIRONMENT unset is not "production" either.
    expect(resolveTelemetryOrigin('http://localhost:5173', undefined)).toEqual({
      accepted: true,
      env: undefined,
    });
  });

  it('rejects loopback origins on the production worker', () => {
    for (const origin of ['http://localhost:5173', 'http://localhost', 'http://127.0.0.1:8787']) {
      expect(resolveTelemetryOrigin(origin, 'production'), origin).toEqual({ accepted: false });
    }
  });

  it('rejects loopback look-alikes and the wrong scheme even in development', () => {
    for (const origin of [
      'https://localhost',
      'https://localhost:5173',
      'http://localhost.evil.example',
      'http://localhost:5173.evil.example',
      'http://127.0.0.1.evil.example',
      'http://127.0.0.2:5173',
    ]) {
      expect(resolveTelemetryOrigin(origin, 'development'), origin).toEqual({ accepted: false });
    }
  });
});

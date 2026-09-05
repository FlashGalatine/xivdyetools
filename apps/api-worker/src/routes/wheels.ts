/**
 * Colour-wheel routes — 2 endpoints exposing core's selectable wheels.
 *
 * The wheels are the geometry the Harmony Explorer, `/harmony` and the OG
 * cards measure harmony angles on (core 5.2.0). This is read-only data: the
 * registry in display order, and, per wheel, its ring paint and where every
 * dye sits on it.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { COLOR_WHEEL_IDS, getColorWheel } from '@xivdyetools/core';
import { dyeService } from '../lib/services.js';
import { parseColorWheel, parseIntParam } from '../lib/validation.js';
import { serializeWheelPosition, serializeWheelSummary } from '../lib/harmony.js';
import { successResponse } from '../lib/response.js';

const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

const wheelsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================================================
// GET / — every wheel, in core's display order
// ============================================================================

wheelsRouter.get('/', (c) => {
  const locale = c.get('locale');
  c.header('Cache-Control', CACHE_CONTROL);
  return successResponse(
    c,
    COLOR_WHEEL_IDS.map((id) => serializeWheelSummary(id, locale)),
    locale,
  );
});

// ============================================================================
// GET /:id — ring stops + the position of every dye on that wheel
// ============================================================================

wheelsRouter.get('/:id', (c) => {
  const id = parseColorWheel(c.req.param('id'), 'id');
  const stops = parseIntParam(c.req.query('stops'), 'stops', { min: 3, max: 360, defaultValue: 72 });
  const locale = c.get('locale');
  const wheel = getColorWheel(id);

  c.header('Cache-Control', CACHE_CONTROL);
  return successResponse(
    c,
    {
      ...serializeWheelSummary(id, locale),
      ringStops: [...wheel.ringStops(stops)],
      dyes: dyeService.getAllDyes().map((dye) => serializeWheelPosition(dye, wheel.hueOf(dye.hex), locale)),
    },
    locale,
  );
});

export { wheelsRouter };

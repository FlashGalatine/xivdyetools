/**
 * XIV Dye Tools - Icon Module Tests
 *
 * Comprehensive function coverage tests for icon getter functions
 * in social-icons.ts, tool-icons.ts, and ui-icons.ts
 *
 * @module shared/__tests__/icons.test
 */

import { describe, it, expect } from 'vitest';

// Import from social-icons.ts
import {
  ICON_GITHUB,
  ICON_TWITTER,
  ICON_TWITCH,
  ICON_BLUESKY,
  ICON_DISCORD,
  ICON_PATREON,
} from '../social-icons';

// Import from tool-icons.ts
import {
  TOOL_ICONS,
  ICON_TOOL_HARMONY,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_MIXER,
  ICON_TOOL_MENU,
} from '../tool-icons';

// Import from ui-icons.ts
import {
  ICON_CAMERA,
  ICON_EYEDROPPER,
  ICON_HINT,
  ICON_CRYSTAL,
  ICON_WARNING,
  ICON_UPLOAD,
  ICON_DICE,
} from '../ui-icons';

// ==========================================================================
// Social Icons Tests
// ==========================================================================

describe('Social Icons', () => {
  describe('Individual icon constants', () => {
    it('ICON_GITHUB should be a valid SVG', () => {
      expect(ICON_GITHUB).toContain('<svg');
      expect(ICON_GITHUB).toContain('currentColor');
    });

    it('ICON_TWITTER should be a valid SVG', () => {
      expect(ICON_TWITTER).toContain('<svg');
      expect(ICON_TWITTER).toContain('currentColor');
    });

    it('ICON_TWITCH should be a valid SVG', () => {
      expect(ICON_TWITCH).toContain('<svg');
      expect(ICON_TWITCH).toContain('currentColor');
    });

    it('ICON_BLUESKY should be a valid SVG', () => {
      expect(ICON_BLUESKY).toContain('<svg');
      expect(ICON_BLUESKY).toContain('currentColor');
    });

    it('ICON_DISCORD should be a valid SVG', () => {
      expect(ICON_DISCORD).toContain('<svg');
      expect(ICON_DISCORD).toContain('currentColor');
    });

    it('ICON_PATREON should be a valid SVG', () => {
      expect(ICON_PATREON).toContain('<svg');
      expect(ICON_PATREON).toContain('currentColor');
    });
  });
});

// ==========================================================================
// Tool Icons Tests
// ==========================================================================

describe('Tool Icons', () => {
  describe('TOOL_ICONS object', () => {
    it('should contain all expected tool icon keys', () => {
      // V4: Updated tool IDs - now includes extractor, gradient, swatch, plus legacy aliases
      expect(Object.keys(TOOL_ICONS)).toEqual([
        'harmony',
        'extractor',
        'accessibility',
        'comparison',
        'gradient',
        'mixer',
        'presets',
        'budget',
        'swatch',
        'matcher',
        'character',
        'tools',
      ]);
    });

    it('should have all icons as SVG strings', () => {
      for (const value of Object.values(TOOL_ICONS)) {
        expect(typeof value).toBe('string');
        expect(value).toContain('<svg');
        expect(value).toContain('</svg>');
      }
    });
  });

  describe('Individual icon constants', () => {
    it('ICON_TOOL_HARMONY is the 1B chip cluster (four chips, one accent)', () => {
      expect(ICON_TOOL_HARMONY).toContain('<svg');
      expect(ICON_TOOL_HARMONY).toContain('rect');
      expect(ICON_TOOL_HARMONY).toContain('#EA4133');
    });

    it('ICON_TOOL_ACCESSIBILITY should be a valid SVG with eye path', () => {
      expect(ICON_TOOL_ACCESSIBILITY).toContain('<svg');
      expect(ICON_TOOL_ACCESSIBILITY).toContain('path');
    });

    it('ICON_TOOL_COMPARISON should be a valid SVG with rect', () => {
      expect(ICON_TOOL_COMPARISON).toContain('<svg');
      expect(ICON_TOOL_COMPARISON).toContain('rect');
    });

    it('ICON_TOOL_MIXER should be a valid SVG with gradient elements', () => {
      // V4: Icon is now Gradient Builder with rect and lines (no circles)
      expect(ICON_TOOL_MIXER).toContain('<svg');
      expect(ICON_TOOL_MIXER).toContain('rect');
    });

    it('ICON_TOOL_MENU is the dot grid with an ink centre (no accent chip)', () => {
      expect(ICON_TOOL_MENU).toContain('<svg');
      expect(ICON_TOOL_MENU).toContain('circle');
      expect(ICON_TOOL_MENU).not.toContain('#EA4133');
    });
  });
});

// ==========================================================================
// UI Icons Tests
// ==========================================================================

describe('UI Icons', () => {
  describe('Individual icon constants', () => {
    it('ICON_CAMERA should be a valid SVG with rect and circle', () => {
      expect(ICON_CAMERA).toContain('<svg');
      expect(ICON_CAMERA).toContain('rect');
      expect(ICON_CAMERA).toContain('circle');
    });

    it('ICON_EYEDROPPER should be a valid SVG with circle and path', () => {
      expect(ICON_EYEDROPPER).toContain('<svg');
      expect(ICON_EYEDROPPER).toContain('circle');
      expect(ICON_EYEDROPPER).toContain('path');
    });

    it('ICON_HINT should be a valid SVG with path and lines', () => {
      expect(ICON_HINT).toContain('<svg');
      expect(ICON_HINT).toContain('path');
      expect(ICON_HINT).toContain('line');
    });

    it('ICON_CRYSTAL should be a valid SVG with path', () => {
      expect(ICON_CRYSTAL).toContain('<svg');
      expect(ICON_CRYSTAL).toContain('path');
    });

    it('ICON_WARNING should be a valid SVG with path and line', () => {
      expect(ICON_WARNING).toContain('<svg');
      expect(ICON_WARNING).toContain('path');
      expect(ICON_WARNING).toContain('line');
    });

    it('ICON_UPLOAD should be a valid SVG with path and line', () => {
      expect(ICON_UPLOAD).toContain('<svg');
      expect(ICON_UPLOAD).toContain('path');
      expect(ICON_UPLOAD).toContain('line');
    });

    it('ICON_DICE should be a valid SVG with rect and circles', () => {
      expect(ICON_DICE).toContain('<svg');
      expect(ICON_DICE).toContain('rect');
      expect(ICON_DICE).toContain('circle');
    });
  });
});

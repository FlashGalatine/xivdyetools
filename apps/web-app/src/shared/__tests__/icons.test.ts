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
  getSocialIcon,
  SOCIAL_ICONS,
  ICON_GITHUB,
  ICON_TWITTER,
  ICON_TWITCH,
  ICON_BLUESKY,
  ICON_DISCORD,
  ICON_PATREON,
} from '../social-icons';

// Import from tool-icons.ts
import {
  getToolIcon,
  TOOL_ICONS,
  ICON_TOOL_HARMONY,
  ICON_TOOL_MATCHER,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_MIXER,
  ICON_TOOL_MENU,
} from '../tool-icons';

// Import from ui-icons.ts
import {
  getUIIcon,
  UI_ICONS,
  ICON_THEME,
  ICON_CAMERA,
  ICON_EYEDROPPER,
  ICON_SAVE,
  ICON_SHARE,
  ICON_HINT,
  ICON_ZOOM_FIT,
  ICON_ZOOM_WIDTH,
  ICON_CRYSTAL,
  ICON_WARNING,
  ICON_UPLOAD,
  ICON_DICE,
} from '../ui-icons';

// ==========================================================================
// Social Icons Tests
// ==========================================================================

describe('Social Icons', () => {
  describe('getSocialIcon function', () => {
    it('should return github icon when name is "github"', () => {
      const icon = getSocialIcon('github');
      expect(icon).toBe(ICON_GITHUB);
      expect(icon).toContain('<svg');
      expect(icon).toContain('viewBox');
    });

    it('should return twitter icon when name is "twitter"', () => {
      const icon = getSocialIcon('twitter');
      expect(icon).toBe(ICON_TWITTER);
      expect(icon).toContain('<svg');
    });

    it('should return twitch icon when name is "twitch"', () => {
      const icon = getSocialIcon('twitch');
      expect(icon).toBe(ICON_TWITCH);
      expect(icon).toContain('<svg');
    });

    it('should return bluesky icon when name is "bluesky"', () => {
      const icon = getSocialIcon('bluesky');
      expect(icon).toBe(ICON_BLUESKY);
      expect(icon).toContain('<svg');
    });

    it('should return discord icon when name is "discord"', () => {
      const icon = getSocialIcon('discord');
      expect(icon).toBe(ICON_DISCORD);
      expect(icon).toContain('<svg');
    });

    it('should return patreon icon when name is "patreon"', () => {
      const icon = getSocialIcon('patreon');
      expect(icon).toBe(ICON_PATREON);
      expect(icon).toContain('<svg');
    });

    it('should return undefined for unknown icon name', () => {
      const icon = getSocialIcon('unknown');
      expect(icon).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const icon = getSocialIcon('');
      expect(icon).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const icon = getSocialIcon('GitHub');
      expect(icon).toBeUndefined();
    });
  });

  describe('SOCIAL_ICONS object', () => {
    it('should contain all expected social icon keys', () => {
      expect(Object.keys(SOCIAL_ICONS)).toEqual([
        'github',
        'twitter',
        'twitch',
        'bluesky',
        'discord',
        'patreon',
        'kofi',
      ]);
    });

    it('should have all icons as SVG strings', () => {
      for (const value of Object.values(SOCIAL_ICONS)) {
        expect(typeof value).toBe('string');
        expect(value).toContain('<svg');
        expect(value).toContain('</svg>');
      }
    });
  });

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
  describe('getToolIcon function', () => {
    it('should return harmony icon when name is "harmony"', () => {
      const icon = getToolIcon('harmony');
      expect(icon).toBe(ICON_TOOL_HARMONY);
      expect(icon).toContain('<svg');
    });

    it('should return matcher icon when name is "matcher"', () => {
      const icon = getToolIcon('matcher');
      expect(icon).toBe(ICON_TOOL_MATCHER);
      expect(icon).toContain('<svg');
    });

    it('should return accessibility icon when name is "accessibility"', () => {
      const icon = getToolIcon('accessibility');
      expect(icon).toBe(ICON_TOOL_ACCESSIBILITY);
      expect(icon).toContain('<svg');
    });

    it('should return comparison icon when name is "comparison"', () => {
      const icon = getToolIcon('comparison');
      expect(icon).toBe(ICON_TOOL_COMPARISON);
      expect(icon).toContain('<svg');
    });

    it('should return mixer icon when name is "mixer"', () => {
      const icon = getToolIcon('mixer');
      // V4: 'mixer' now points to the NEW Dye Mixer tool (ICON_TOOL_DYE_MIXER), not the old gradient builder
      expect(icon).toBeDefined();
      expect(icon).toContain('<svg');
    });

    it('should return tools menu icon when name is "tools"', () => {
      const icon = getToolIcon('tools');
      expect(icon).toBe(ICON_TOOL_MENU);
      expect(icon).toContain('<svg');
    });

    it('should return undefined for unknown icon name', () => {
      const icon = getToolIcon('unknown');
      expect(icon).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const icon = getToolIcon('');
      expect(icon).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const icon = getToolIcon('Harmony');
      expect(icon).toBeUndefined();
    });
  });

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
    it('ICON_TOOL_HARMONY should be a valid SVG with circles', () => {
      expect(ICON_TOOL_HARMONY).toContain('<svg');
      expect(ICON_TOOL_HARMONY).toContain('circle');
    });

    it('ICON_TOOL_MATCHER should be a valid SVG with selection elements', () => {
      // V4: Icon updated to selection crop design with paths and rect (no circles)
      expect(ICON_TOOL_MATCHER).toContain('<svg');
      expect(ICON_TOOL_MATCHER).toContain('path');
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

    it('ICON_TOOL_MENU should be a valid SVG with rect', () => {
      expect(ICON_TOOL_MENU).toContain('<svg');
      expect(ICON_TOOL_MENU).toContain('rect');
    });
  });
});

// ==========================================================================
// UI Icons Tests
// ==========================================================================

describe('UI Icons', () => {
  describe('getUIIcon function', () => {
    it('should return theme icon when name is "theme"', () => {
      const icon = getUIIcon('theme');
      expect(icon).toBe(ICON_THEME);
      expect(icon).toContain('<svg');
    });

    it('should return camera icon when name is "camera"', () => {
      const icon = getUIIcon('camera');
      expect(icon).toBe(ICON_CAMERA);
      expect(icon).toContain('<svg');
    });

    it('should return eyedropper icon when name is "eyedropper"', () => {
      const icon = getUIIcon('eyedropper');
      expect(icon).toBe(ICON_EYEDROPPER);
      expect(icon).toContain('<svg');
    });

    it('should return save icon when name is "save"', () => {
      const icon = getUIIcon('save');
      expect(icon).toBe(ICON_SAVE);
      expect(icon).toContain('<svg');
    });

    it('should return share icon when name is "share"', () => {
      const icon = getUIIcon('share');
      expect(icon).toBe(ICON_SHARE);
      expect(icon).toContain('<svg');
    });

    it('should return hint icon when name is "hint"', () => {
      const icon = getUIIcon('hint');
      expect(icon).toBe(ICON_HINT);
      expect(icon).toContain('<svg');
    });

    it('should return zoom-fit icon when name is "zoom-fit"', () => {
      const icon = getUIIcon('zoom-fit');
      expect(icon).toBe(ICON_ZOOM_FIT);
      expect(icon).toContain('<svg');
    });

    it('should return zoom-width icon when name is "zoom-width"', () => {
      const icon = getUIIcon('zoom-width');
      expect(icon).toBe(ICON_ZOOM_WIDTH);
      expect(icon).toContain('<svg');
    });

    it('should return crystal icon when name is "crystal"', () => {
      const icon = getUIIcon('crystal');
      expect(icon).toBe(ICON_CRYSTAL);
      expect(icon).toContain('<svg');
    });

    it('should return upload icon when name is "upload"', () => {
      const icon = getUIIcon('upload');
      expect(icon).toBe(ICON_UPLOAD);
      expect(icon).toContain('<svg');
    });

    it('should return warning icon when name is "warning"', () => {
      const icon = getUIIcon('warning');
      expect(icon).toBe(ICON_WARNING);
      expect(icon).toContain('<svg');
    });

    it('should return dice icon when name is "dice"', () => {
      const icon = getUIIcon('dice');
      expect(icon).toBe(ICON_DICE);
      expect(icon).toContain('<svg');
    });

    it('should return undefined for unknown icon name', () => {
      const icon = getUIIcon('unknown');
      expect(icon).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const icon = getUIIcon('');
      expect(icon).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const icon = getUIIcon('Theme');
      expect(icon).toBeUndefined();
    });

    it('should handle hyphenated icon names correctly', () => {
      expect(getUIIcon('zoom-fit')).toBeDefined();
      expect(getUIIcon('zoom-width')).toBeDefined();
      expect(getUIIcon('zoomfit')).toBeUndefined();
      expect(getUIIcon('zoomwidth')).toBeUndefined();
    });
  });

  describe('UI_ICONS object', () => {
    it('should contain all expected UI icon keys', () => {
      // V4: Updated with additional icons (about, globe, logo, context-menu, close, etc.)
      expect(Object.keys(UI_ICONS)).toEqual([
        'theme',
        'camera',
        'eyedropper',
        'save',
        'share',
        'hint',
        'zoom-fit',
        'zoom-width',
        'crystal',
        'upload',
        'warning',
        'dice',
        'coins',
        'broom',
        'filter',
        'market',
        'export',
        'beaker',
        'settings',
        'palette',
        'sort',
        'eye',
        'sliders',
        'target',
        'sparkles',
        'distance',
        'music',
        'test-tube',
        'beaker-pipe',
        'stairs',
        'star',
        'search',
        'grid',
        'user',
        'edit',
        'trash',
        'image',
        'info',
        'about',
        'globe',
        'logo',
        'context-menu',
        'close',
        'link',
        'document',
        'locked',
        'lock',
        'network',
        'book',
        'success',
        'error',
        'refresh',
        'import',
        'folder',
        'zap',
        'chart',
        'keyboard',
        'clipboard',
      ]);
    });

    it('should have all icons as SVG strings', () => {
      for (const value of Object.values(UI_ICONS)) {
        expect(typeof value).toBe('string');
        expect(value).toContain('<svg');
        expect(value).toContain('</svg>');
      }
    });
  });

  describe('Individual icon constants', () => {
    it('ICON_THEME should be a valid SVG with path and circles', () => {
      expect(ICON_THEME).toContain('<svg');
      expect(ICON_THEME).toContain('path');
      expect(ICON_THEME).toContain('circle');
    });

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

    it('ICON_SAVE should be a valid SVG with path and rect', () => {
      expect(ICON_SAVE).toContain('<svg');
      expect(ICON_SAVE).toContain('path');
      expect(ICON_SAVE).toContain('rect');
    });

    it('ICON_SHARE should be a valid SVG with path', () => {
      expect(ICON_SHARE).toContain('<svg');
      expect(ICON_SHARE).toContain('path');
    });

    it('ICON_HINT should be a valid SVG with path and lines', () => {
      expect(ICON_HINT).toContain('<svg');
      expect(ICON_HINT).toContain('path');
      expect(ICON_HINT).toContain('line');
    });

    it('ICON_ZOOM_FIT should be a valid SVG with rect and polyline', () => {
      expect(ICON_ZOOM_FIT).toContain('<svg');
      expect(ICON_ZOOM_FIT).toContain('rect');
      expect(ICON_ZOOM_FIT).toContain('polyline');
    });

    it('ICON_ZOOM_WIDTH should be a valid SVG with rect and lines', () => {
      expect(ICON_ZOOM_WIDTH).toContain('<svg');
      expect(ICON_ZOOM_WIDTH).toContain('rect');
      expect(ICON_ZOOM_WIDTH).toContain('line');
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

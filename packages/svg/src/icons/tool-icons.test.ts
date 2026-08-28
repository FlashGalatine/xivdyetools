import { describe, it, expect } from 'vitest';
import {
  toolGlyph,
  harmonyGlyph,
  chromeGlyph,
  panelGlyph,
  categoryGlyph,
  GLYPH_SETS,
  GLYPH_ACCENT_DARK,
} from './tool-icons.js';

/** Render every glyph in every set once. */
function renderAll(options = {}): string[] {
  return [
    ...GLYPH_SETS.tool.map((n) => toolGlyph(n, 'compact', options)),
    ...GLYPH_SETS.toolDetail.map((n) => toolGlyph(n, 'detail', options)),
    ...GLYPH_SETS.harmony.map((n) => harmonyGlyph(n, options)),
    ...GLYPH_SETS.chrome.map((n) => chromeGlyph(n, options)),
    ...GLYPH_SETS.panel.map((n) => panelGlyph(n, options)),
    ...GLYPH_SETS.category.map((n) => categoryGlyph(n, options)),
  ];
}

describe('5.0 icon system', () => {
  it('covers the confirmed rosters', () => {
    expect(GLYPH_SETS.tool).toHaveLength(10); // 9 tools + tools menu
    expect(GLYPH_SETS.toolDetail).toHaveLength(9); // detail set complete ×9
    expect(GLYPH_SETS.harmony).toHaveLength(10); // ten ring positions
    expect(GLYPH_SETS.chrome).toEqual(['about', 'sun', 'moon', 'globe']);
    expect(GLYPH_SETS.category).toHaveLength(9); // eight categories + default
  });

  it('the three 2026-08-11 categories render on the category set conventions', () => {
    // Fills in this set are INK, not accent — a flag is not a colour.
    for (const name of ['appearance', 'zones'] as const) {
      const svg = categoryGlyph(name, { ink: '#101010' });
      expect(svg, name).toContain('fill="#101010"');
      expect(svg, name).not.toContain(GLYPH_ACCENT_DARK);
      expect(svg, name).toContain('stroke-width="2.4"');
    }
    // raids-trials carries no fill at all, on the aesthetics precedent.
    const raids = categoryGlyph('raids-trials', { ink: '#101010' });
    expect(raids).not.toContain('fill="#101010"');
    expect(raids).toContain('<g fill="none"');
  });

  it('every glyph keeps fill="none" explicit on the group (tool-banner floods otherwise)', () => {
    for (const svg of renderAll()) {
      expect(svg).toContain('<g fill="none"');
    }
  });

  it('never emits <symbol>/<use> and leaves no substitution markers', () => {
    for (const svg of renderAll()) {
      expect(svg).not.toMatch(/<symbol|<use/);
      expect(svg).not.toContain(' F ');
      expect(svg).not.toContain('INK');
    }
  });

  it('has no load-bearing opacity anywhere in the set', () => {
    for (const svg of renderAll()) {
      expect(svg).not.toContain('opacity');
    }
  });

  it('tool glyphs carry exactly one accent-filled element; the tools menu takes no chip', () => {
    for (const name of GLYPH_SETS.tool) {
      const svg = toolGlyph(name, 'compact', { ink: '#ECECEE' });
      const accentFills = svg.split(`fill="${GLYPH_ACCENT_DARK}"`).length - 1;
      expect(accentFills, name).toBe(name === 'tools' ? 0 : 1);
    }
  });

  it('pins ink when told to (resvg has no currentColor)', () => {
    const svg = toolGlyph('budget', 'detail', { ink: '#1E1E22', accent: '#CE2222' });
    expect(svg).toContain('stroke="#1E1E22"');
    expect(svg).toContain('fill="#CE2222"');
    expect(svg).not.toContain('currentColor');
  });

  it('defaults to currentColor stroke for browser DOM consumers', () => {
    expect(panelGlyph('search')).toContain('stroke="currentColor"');
  });

  it('mono variant on dye grounds: accent = ink removes the second colour', () => {
    const svg = toolGlyph('harmony', 'compact', { ink: '#101010', accent: '#101010' });
    expect(svg).not.toContain(GLYPH_ACCENT_DARK);
  });

  it('detail variants add the 1.2-weight context layer', () => {
    for (const name of GLYPH_SETS.toolDetail) {
      expect(toolGlyph(name, 'detail'), name).toContain('stroke-width="1.2"');
    }
  });

  it('harmony rings render at the 1.4 ring weight with a 2.2 set weight', () => {
    const svg = harmonyGlyph('square');
    expect(svg).toContain('stroke-width="1.4"'); // the ring
    expect(svg).toContain('stroke-width="2.2"'); // the set
  });

  it('the star pair carries state in the fill, never a fading opacity', () => {
    expect(panelGlyph('star')).not.toContain(`fill="${GLYPH_ACCENT_DARK}"`);
    expect(panelGlyph('star-fill')).toContain(`fill="${GLYPH_ACCENT_DARK}"`);
  });

  it('respects size and weight overrides', () => {
    const svg = toolGlyph('mixer', 'compact', { size: 16, weight: 2 });
    expect(svg).toContain('width="16" height="16"');
    expect(svg).toContain('stroke-width="2"');
  });
});

describe('fluid sizing', () => {
  it('omits width/height for CSS-sized DOM shims', () => {
    const svg = toolGlyph('harmony', 'compact', { fluid: true });
    expect(svg).not.toMatch(/<svg [^>]*\bwidth=/);
    expect(svg).toContain('viewBox="0 0 32 32"');
  });
});

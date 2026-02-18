# XIV Dye Tools v4.0 Migration Challenges

This document outlines the technical challenges anticipated during the v3 → v4 UI migration, along with proposed mitigations and considerations.

---

## 1. Layout Architecture Shift

### Challenge
The v3 layout uses a `TwoPanelShell` component that splits the screen into:
- **Left Panel**: Tool configuration controls
- **Right Panel**: Visualization/results
- **Mobile Drawer**: Collapsible navigation

The v4 layout introduces a fundamentally different structure:
- **App Header** (48px fixed): Logo + nav controls
- **Tool Banner** (64px sticky): Horizontal tool navigation with icons
- **Config Sidebar** (320px): Tool settings in a glassmorphism panel
- **Main Content** (flexible): Results area

### Impact
- Complete rewrite of the layout shell component
- All 9 tools need container reference updates
- Mobile responsiveness logic needs redesign
- Panel state management (collapsed/expanded) changes

### Mitigation
1. Create `V4LayoutShell` as a parallel component first
2. Build and test layout shell in isolation before integrating tools
3. Use feature flag to toggle between v3/v4 layouts during development
4. Migrate tools one at a time, starting with simplest (Budget Suggestions)

### Risk Level: **HIGH**

---

## 2. Route Renaming (Hard Cutover)

### Challenge
Four tools are being renamed with new URL paths:

| Old Route | New Route | Reason |
|-----------|-----------|--------|
| `/matcher` | `/extractor` | Emphasizes palette extraction over pixel matching |
| `/mixer` | `/gradient` | Reflects gradient/interpolation functionality |
| `/character` | `/swatch` | Clearer purpose (swatch matching) |
| (new) | `/mixer` | New crafting-style tool takes the old route |

Since we chose hard cutover (no redirects), existing bookmarks and shared links will break.

### Impact
- External links to tools will 404
- User muscle memory disrupted
- SEO impact (if applicable)

### Mitigation
1. Document breaking changes prominently in release notes
2. Update any documentation/tutorials before release
3. Consider adding a one-time "routes have changed" notification on first v4 load
4. Update any internal analytics tracking for new route names

### Risk Level: **MEDIUM**

---

## 3. CSS Variable Namespace Expansion

### Challenge
The v4 design introduces new CSS variables for glassmorphism effects:
- `--bg-glass`, `--backdrop-blur`
- `--shadow-soft`, `--shadow-glow`
- `--accent-rgb` (RGB triplet for `rgba()` usage)

These must be defined for all 11 existing themes while maintaining backward compatibility with existing `--theme-*` variables.

### Impact
- 11 themes × 5+ new variables = 55+ variable definitions
- Risk of inconsistent values across themes
- Potential conflicts with existing Tailwind classes
- Safari requires `-webkit-backdrop-filter` prefix

### Mitigation
1. Create a theme variable matrix spreadsheet to track all values
2. Use CSS `color-mix()` or computed values where possible
3. Test glassmorphism on Safari, Firefox, Chrome
4. Add fallback backgrounds for browsers without `backdrop-filter` support

### Risk Level: **MEDIUM**

---

## 4. Unified Result Card Standardization

### Challenge
v3 uses different card implementations across tools:
- `HarmonyResultPanel` for Harmony Explorer
- Custom card layouts in Matcher, Mixer, Budget
- Varying data displays and action buttons

v4 requires a single `ResultCard` component (320px fixed width) with:
- Split 50/50 preview (Original | Match)
- 2-column data grid (Technical | Acquisition)
- Consistent action dropdown menu

### Impact
- All tools need result rendering refactored
- Data prop interfaces must be standardized
- Some tools may lose unique visualizations

### Mitigation
1. Design `ResultCard` with flexible slots for tool-specific content
2. Create adapter functions to transform existing data to unified format
3. Preserve any critical unique visualizations as optional "expansion" areas
4. Review v4 prototype cards to ensure no information is lost

### Risk Level: **MEDIUM**

---

## 5. New Dye Mixer Tool Development

### Challenge
The new crafting-style Dye Mixer is an entirely new tool, not a rename. It requires:
- "Inventory slot" UI pattern (100x100px input, 120x120px result)
- Color blending algorithm (or lookup-based matching)
- Integration with existing `DyeService` and `ColorService`
- New icon for Tool Banner

### Impact
- Increases v4.0 scope significantly
- Requires new algorithm development or adaptation
- May need new API endpoints if blending is server-side

### Mitigation
1. Prototype the algorithm early using existing color math utilities
2. Start with client-side blending (no new API required)
3. Use placeholder icon initially, refine later
4. Consider shipping as "Beta" feature in v4.0

### Risk Level: **MEDIUM-HIGH**

---

## 6. Mobile Responsive Adaptation

### Challenge
The v4 layout changes significantly affect mobile behavior:
- Tool Banner needs horizontal scrolling on narrow screens
- Config Sidebar becomes a slide-out drawer
- Header may need condensed mode
- Touch targets must remain accessible

### Impact
- New breakpoint definitions needed
- Mobile drawer logic must be rewritten
- Horizontal scroll UX on Tool Banner may feel unfamiliar
- Testing required across device sizes

### Mitigation
1. Define clear breakpoints: Desktop (>1100px), Tablet (768-1100px), Mobile (<768px)
2. Reuse existing `MobileDrawer` component logic where possible
3. Add swipe gestures for Tool Banner navigation
4. Test on real devices, not just browser DevTools

### Risk Level: **MEDIUM**

---

## 7. Theme Service Interface Changes

### Challenge
The `ThemePalette` interface in `theme-service.ts` needs new properties:
```typescript
interface ThemePalette {
  // Existing...
  primary: string;
  background: string;

  // NEW v4 properties
  bgGlass: string;
  accentRgb: string;
  shadowSoft: string;
  shadowGlow: string;
}
```

### Impact
- Interface changes affect all theme definitions
- TypeScript compilation will fail until all themes updated
- `applyTheme()` method needs updates

### Mitigation
1. Make new properties optional initially: `bgGlass?: string`
2. Provide computed defaults from existing values
3. Update themes incrementally
4. Remove optional markers once all themes migrated

### Risk Level: **LOW**

---

## 8. Lazy Loading Chunk Updates

### Challenge
Tool components are lazy-loaded for performance:
```typescript
const HarmonyTool = await import('./harmony-tool.ts');
```

With file renames (`matcher-tool.ts` → `extractor-tool.ts`), Vite will generate new chunk names, potentially causing caching issues for returning users.

### Impact
- Users may see stale chunks after update
- Service worker cache invalidation needed
- Potential flash of wrong content

### Mitigation
1. Vite uses content hashes by default - leverage this
2. Update service worker to clear old caches on version change
3. Add version check that forces reload if mismatched
4. Document cache-clearing instructions for users if issues arise

### Risk Level: **LOW**

---

## 9. Accessibility Regression Risk

### Challenge
Major layout changes risk breaking:
- Keyboard navigation flow
- Screen reader announcements
- Focus management
- WCAG color contrast (especially with glassmorphism)

### Impact
- Users relying on assistive technology may be blocked
- High contrast themes may not work with blur effects
- Tab order may become illogical

### Mitigation
1. Audit with axe-core before and after migration
2. Manually test with NVDA/VoiceOver
3. Ensure high contrast themes disable glassmorphism blur
4. Maintain `AnnouncerService` integration throughout migration
5. Test keyboard navigation for all 9 tools

### Risk Level: **MEDIUM**

---

## 10. Component Destruction and Memory Leaks

### Challenge
Switching from v3 to v4 layout shell during development may cause:
- Orphaned event listeners
- Uncleaned subscriptions
- Memory leaks from partial migrations

### Impact
- Performance degradation over time
- Potential crashes on low-memory devices
- Hard-to-debug issues

### Mitigation
1. Use Chrome DevTools Memory profiler during development
2. Ensure all `BaseComponent.destroy()` methods clean up resources
3. Verify subscription cleanup in `RouterService` transitions
4. Add integration tests that check for listener counts

### Risk Level: **LOW-MEDIUM**

---

## Summary Risk Matrix

| Challenge | Risk | Effort | Priority |
|-----------|------|--------|----------|
| Layout Architecture Shift | HIGH | High | P0 |
| Route Renaming | MEDIUM | Low | P1 |
| CSS Variable Expansion | MEDIUM | Medium | P1 |
| Unified Result Card | MEDIUM | Medium | P1 |
| New Dye Mixer Tool | MEDIUM-HIGH | High | P2 |
| Mobile Responsive | MEDIUM | Medium | P1 |
| Theme Service Changes | LOW | Low | P2 |
| Lazy Loading Chunks | LOW | Low | P3 |
| Accessibility Regression | MEDIUM | Medium | P1 |
| Memory Leaks | LOW-MEDIUM | Low | P2 |

---

## Recommended Migration Order

Based on risk and dependencies:

1. **Foundation First**: CSS variables, GlassPanel, ResultCard
2. **Layout Shell**: V4LayoutShell with placeholder tools
3. **Simplest Tool**: Budget Suggestions (minimal config, simple output)
4. **Core Tools**: Harmony, Comparison, Accessibility
5. **Renamed Tools**: Extractor, Gradient, Swatch
6. **New Tool**: Dye Mixer (can be parallelized)
7. **Complex Tool**: Community Presets (has auth, modals)
8. **Polish**: Mobile, accessibility audit, theme refinement

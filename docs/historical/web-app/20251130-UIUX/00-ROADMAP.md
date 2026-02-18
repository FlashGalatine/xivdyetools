# XIV Dye Tools - UI/UX Improvement Roadmap

> **Created**: November 30, 2025
> **Target Audience**: FFXIV glamour enthusiasts (frequent users)
> **Scope**: Comprehensive improvements across onboarding, feedback, accessibility, and tool-specific UX

---

## Priority Legend

| Priority | Meaning | Timeline |
|----------|---------|----------|
| **P0** | Critical - Significantly impacts user experience | Next patch |
| **P1** | High - Important improvement, clear user benefit | 1-2 releases |
| **P2** | Medium - Nice enhancement, improves polish | 2-3 releases |
| **P3** | Low - Nice-to-have, future consideration | Backlog |

## Effort Legend

| Effort | Meaning | Typical Scope |
|--------|---------|---------------|
| **S** | Small | < 2 hours, single file changes |
| **M** | Medium | 2-8 hours, multiple files |
| **L** | Large | 1-3 days, architectural changes |
| **XL** | Extra Large | 3+ days, significant refactoring |

---

## Phase 1: Foundation (Next Patch)

Focus on feedback states and critical usability fixes that affect daily usage.

| ID | Improvement | Priority | Effort | Document |
|----|-------------|----------|--------|----------|
| F1 | Loading spinners for Universalis API calls | P0 | M | [02-FEEDBACK-STATES](02-FEEDBACK-STATES.md) |
| F2 | Toast notification system for success/error | P0 | M | [02-FEEDBACK-STATES](02-FEEDBACK-STATES.md) |
| F3 | Empty state designs for no-results scenarios | P1 | S | [02-FEEDBACK-STATES](02-FEEDBACK-STATES.md) |
| T1 | SVG harmony type icons (replace emojis) | P1 | M | [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) |
| A1 | Keyboard navigation for dye selector | P1 | M | [03-ACCESSIBILITY](03-ACCESSIBILITY.md) |

---

## Phase 2: Discoverability (1-2 Releases)

Focus on helping users discover features and understand tool capabilities.

| ID | Improvement | Priority | Effort | Document |
|----|-------------|----------|--------|----------|
| O1 | First-time user welcome modal | P1 | M | [01-ONBOARDING](01-ONBOARDING.md) |
| O2 | Contextual tooltips for advanced features | P1 | M | [01-ONBOARDING](01-ONBOARDING.md) |
| O3 | "What's New" changelog modal | P2 | S | [01-ONBOARDING](01-ONBOARDING.md) |
| T2 | Color Matcher: Live preview of selected dye | P1 | M | [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) |
| T3 | Harmony Generator: Companion dye quick-add | P2 | S | [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) |
| Q1 | Hover micro-interactions on dye swatches | P2 | S | [05-QUICK-WINS](05-QUICK-WINS.md) |

---

## Phase 3: Polish (2-3 Releases)

Focus on refinement and accessibility enhancements.

| ID | Improvement | Priority | Effort | Document |
|----|-------------|----------|--------|----------|
| A2 | Focus ring visibility improvements | P2 | S | [03-ACCESSIBILITY](03-ACCESSIBILITY.md) |
| A3 | Screen reader announcements for results | P2 | M | [03-ACCESSIBILITY](03-ACCESSIBILITY.md) |
| A4 | Reduced motion preference support | P2 | S | [03-ACCESSIBILITY](03-ACCESSIBILITY.md) |
| T4 | Dye Mixer: Gradient preview with stops | P2 | M | [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) |
| T5 | Color Matcher: Recent colors history | P2 | M | [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) |
| O4 | Keyboard shortcuts reference panel | P2 | S | [01-ONBOARDING](01-ONBOARDING.md) |
| Q2 | Smooth color transitions on theme change | P3 | S | [05-QUICK-WINS](05-QUICK-WINS.md) |

---

## Phase 4: Advanced Features (In Progress)

Larger features for future consideration. **v2.4.0 implemented core features; v2.4.1 addressed testing feedback.**

| ID | Improvement | Priority | Effort | Status | Document |
|----|-------------|----------|--------|--------|----------|
| O5 | Interactive tutorial walkthrough | P3 | L | ✅ Implemented | [01-ONBOARDING](01-ONBOARDING.md) |
| T6 | Harmony Generator: Save favorite palettes | P3 | M | ✅ Implemented | [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) |
| T7 | Color Matcher: Camera capture (mobile) | P3 | L | ✅ Implemented | [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) |
| F4 | Offline mode with service worker | P3 | XL | ✅ Implemented | [02-FEEDBACK-STATES](02-FEEDBACK-STATES.md) |
| A5 | High contrast mode theme option | P3 | M | ✅ Implemented | [03-ACCESSIBILITY](03-ACCESSIBILITY.md) |

### v2.4.1 Bug Fixes (Testing Feedback)
- **T6**: Fixed import count calculation, companion dye colors, theme-aware hover states, emoji→SVG
- **A5**: Added missing high contrast locale keys, fixed tool button alignment
- **T7**: Added camera privacy notice with translations
- **F4**: Fixed offline banner initialization
- **O5**: Exposed TutorialService in dev mode for testing

---

## Quick Reference: Document Index

| Document | Focus Area | Suggestion Count |
|----------|------------|------------------|
| [01-ONBOARDING](01-ONBOARDING.md) | First-time experience, feature discovery | 6-8 |
| [02-FEEDBACK-STATES](02-FEEDBACK-STATES.md) | Loading, errors, empty states | 6-8 |
| [03-ACCESSIBILITY](03-ACCESSIBILITY.md) | Keyboard, screen readers, ARIA | 5-7 |
| [04-TOOL-SPECIFIC-UX](04-TOOL-SPECIFIC-UX.md) | Per-tool improvements | 20-25 |
| [05-QUICK-WINS](05-QUICK-WINS.md) | Low-effort polish items | 8-10 |

---

## Implementation Notes

### Dependencies
- **Toast system (F2)** should be built first as other features will use it
- **SVG icons (T1)** can be done independently
- **Keyboard navigation (A1)** benefits from focus ring improvements (A2)

### Testing Considerations
- All loading states should be tested with network throttling
- Accessibility features require screen reader testing (NVDA, VoiceOver)
- Mobile improvements need testing on actual devices

### Version Targeting
- **v2.1.0**: Phase 1 (Foundation) ✅
- **v2.2.0**: Phase 2 (Discoverability) ✅
- **v2.3.0**: Phase 3 (Polish) ✅
- **v2.4.0**: Phase 4 (Advanced Features) ✅
- **v2.4.1**: Phase 4 Testing Bug Fixes ✅

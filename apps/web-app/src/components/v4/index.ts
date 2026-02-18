/**
 * XIV Dye Tools v4 Components
 *
 * Barrel export for all v4 Lit-based components.
 * Import from '@v4' for cleaner imports.
 *
 * @module components/v4
 */

// Base class
export { BaseLitComponent } from './base-lit-component';

// Layout components (Phase 4)
export { V4LayoutShell } from './v4-layout-shell';
export { V4AppHeader } from './v4-app-header';
export { ToolBanner } from './tool-banner';
export { ConfigSidebar } from './config-sidebar';

// Shared components (Phase 5)
export { GlassPanel } from './glass-panel';
export type { GlassPanelVariant, GlassPanelPadding } from './glass-panel';
export { ToggleSwitchV4 } from './toggle-switch-v4';
export { RangeSliderV4 } from './range-slider-v4';
export { ResultCard } from './result-card';
export type { ResultCardData, ContextAction } from './result-card';
export { V4ColorWheel } from './v4-color-wheel';
export type { HarmonyType } from './v4-color-wheel';
export { DisplayOptionsV4 } from './display-options-v4';
export type { OptionGroup, DisplayOptionsChangeDetail } from './display-options-v4';

// Community Presets components (Phase 6)
export { PresetCard } from './preset-card';
export type { PresetCardData } from './preset-card';
export { PresetDetail } from './preset-detail';
export { PresetTool } from './preset-tool';

// Sharing components
export { ShareButton } from './share-button';

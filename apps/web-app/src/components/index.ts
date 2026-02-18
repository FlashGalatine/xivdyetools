/**
 * XIV Dye Tools v3.0.0 - Components Module
 *
 * Centralized exports for all UI components
 *
 * @module components
 */

export {
  BaseComponent,
  type ElementOptions,
  type EventHandler,
  type ComponentLifecycle,
  type ComponentErrorState,
} from './base-component';
export { AppLayout } from './app-layout';
export { ThemeSwitcher } from './theme-switcher';
export { LanguageSelector } from './language-selector';
export { DyeSelector, type DyeSelectorOptions } from './dye-selector';
export { ColorDisplay, type ColorDisplayOptions } from './color-display';
export { HarmonyType, type HarmonyTypeInfo } from './harmony-type';
export { ColorDistanceMatrix } from './color-distance-matrix';
export { DyeComparisonChart, type ChartType } from './dye-comparison-chart';
export { ColorInterpolationDisplay, type InterpolationStep } from './color-interpolation-display';
export { ColorblindnessDisplay, type VisionTypeInfo } from './colorblindness-display';
export { ImageUploadDisplay } from './image-upload-display';
export { ColorPickerDisplay } from './color-picker-display';
export { ColorWheelDisplay } from './color-wheel-display';
export { MobileBottomNav, type MobileToolDef } from './mobile-bottom-nav';
export { ToolsDropdown, type ToolDef } from './tools-dropdown';
export { MarketBoard } from './market-board';
export { PaletteExporter, type PaletteData, type PaletteExporterOptions } from './palette-exporter';
export { ModalContainer } from './modal-container';
export { WelcomeModal, showWelcomeIfFirstVisit } from './welcome-modal';
export { ChangelogModal, showChangelogIfUpdated } from './changelog-modal';
export { AboutModal, showAboutModal } from './about-modal';
export {
  createInfoIcon,
  createLabelWithInfo,
  addInfoIconTo,
  TOOLTIP_CONTENT,
  type InfoTooltipOptions,
} from './info-tooltip';
export { DyePreviewOverlay } from './dye-preview-overlay';
export {
  createDyeActionDropdown,
  type DyeAction,
  type DyeActionCallback,
} from './dye-action-dropdown';
export { TutorialSpotlight, initializeTutorialSpotlight } from './tutorial-spotlight';
export { offlineBanner } from './offline-banner';
export { showCollectionManagerModal, showCreateCollectionDialog } from './collection-manager-modal';
export {
  showAddToCollectionMenu,
  closeAddToCollectionMenu,
  isAddToCollectionMenuOpen,
  type AddToCollectionMenuOptions,
} from './add-to-collection-menu';
export { AuthButton } from './auth-button';
export { showPresetSubmissionForm } from './preset-submission-form';
export { showPresetEditForm } from './preset-edit-form';
export { MySubmissionsPanel } from './my-submissions-panel';
export { PresetCard, type PresetCardCallback } from './preset-card';
export { PresetDetailView, type PresetDetailViewCallbacks } from './preset-detail-view';
export { FeaturedPresetsSection, type FeaturedPresetCallback } from './featured-presets-section';

// Shared utility components (used by tools in both v3 and v4 layouts)
export { CollapsiblePanel, type CollapsiblePanelOptions } from './collapsible-panel';

// V4 Tool Components
export { HarmonyTool, type HarmonyToolOptions } from './harmony-tool';
export { ExtractorTool, type ExtractorToolOptions } from './extractor-tool'; // Was MatcherTool
export { AccessibilityTool, type AccessibilityToolOptions } from './accessibility-tool';
export { ComparisonTool, type ComparisonToolOptions } from './comparison-tool';
export { GradientTool, type GradientToolOptions } from './gradient-tool'; // Was MixerTool
export { PresetTool, type PresetToolOptions } from './preset-tool';
export { BudgetTool, type BudgetToolOptions } from './budget-tool';
export { SwatchTool, type SwatchToolOptions } from './swatch-tool'; // Was CharacterTool
export { MixerTool, type MixerToolOptions } from './mixer-tool'; // V4 NEW - Dye Mixer

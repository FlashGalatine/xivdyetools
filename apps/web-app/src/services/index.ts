/**
 * XIV Dye Tools v2.0.0 - Services Export
 *
 * Phase 12: Architecture Refactor
 * Centralized export of all service modules
 *
 * @module services
 */

// Import service classes for internal use
// ColorService now from xivdyetools-core;
import { StorageService } from './storage-service';
import { ThemeService } from './theme-service';
import { LanguageService } from './language-service';
import { APIService } from './api-service-wrapper';
import { cameraService } from './camera-service';
// APIService now from wrapper;

// Export service classes
export { ColorService } from '@xivdyetools/core';
export { DyeService, dyeService } from './dye-service-wrapper';
export { StorageService, appStorage, NamespacedStorage, SecureStorage } from './storage-service';
export { ThemeService };
export { LanguageService };
export { RouterService, ROUTES } from './router-service';
export type { ToolId, RouteDefinition, RouteState } from './router-service';
export { APIService, apiService } from './api-service-wrapper';
export { ToastService } from './toast-service';
export type { Toast, ToastType, ToastOptions } from './toast-service';
export { ModalService } from './modal-service';
export type { Modal, ModalType, ModalConfig } from './modal-service';
export { TooltipService } from './tooltip-service';
export type { TooltipConfig, TooltipPosition } from './tooltip-service';
export { AnnouncerService } from './announcer-service';
export type { AnnouncementPriority } from './announcer-service';
export { PaletteService } from './palette-service';
export type { SavedPalette, PaletteExportData } from './palette-service';
export { CameraService, cameraService } from './camera-service';
export type { CameraDevice, CaptureResult } from './camera-service';
export { IndexedDBService, indexedDBService, STORES } from './indexeddb-service';
export type { StoreName } from './indexeddb-service';
export { TutorialService } from './tutorial-service';
export type { TutorialTool, TutorialStep, Tutorial } from './tutorial-service';
export { KeyboardService } from './keyboard-service';
export { DyeSelectionContext } from './dye-selection-context';
export { CollectionService } from './collection-service';
export type {
  DyeId,
  Collection,
  FavoritesData,
  CollectionsData,
  CollectionExport,
  ImportResult,
} from './collection-service';
export { CommunityPresetService, communityPresetService } from './community-preset-service';
export type {
  CommunityPreset,
  PresetStatus,
  PresetListResponse,
  CategoryWithCount,
  PresetFilters,
  VoteResponse,
  VoteCheckResponse,
} from './community-preset-service';
export { HybridPresetService, hybridPresetService } from './hybrid-preset-service';
export type {
  UnifiedPreset,
  UnifiedCategory,
  PresetSortOption,
  GetPresetsOptions,
} from './hybrid-preset-service';
export { AuthService, authService, consumeReturnTool } from './auth-service';
export type { AuthUser, AuthState, AuthStateListener } from './auth-service';
export {
  PresetSubmissionService,
  presetSubmissionService,
  validateSubmission,
} from './preset-submission-service';
export type {
  PresetSubmission,
  SubmissionResult,
  ValidationError,
  MySubmissionsResponse,
  PresetEditRequest,
  EditResult,
} from './preset-submission-service';

// V4 Config Controller
export { ConfigController, getConfigController } from './config-controller';
export type { ConfigChangeEvent } from './config-controller';

// V4 Share Service
export { ShareService, SHARE_URL_VERSION, BASE_URL } from './share-service';
export type {
  ShareParams,
  ShareResult,
  ParsedShareUrl,
  ShareAnalyticsEvent,
  HarmonyShareParams,
  GradientShareParams,
  MixerShareParams,
  SwatchShareParams,
  ComparisonShareParams,
  AccessibilityShareParams,
} from './share-service';

// V4 Market Board Service
export { MarketBoardService, getMarketBoardService, formatPrice } from './market-board-service';
export type {
  PriceCategorySettings,
  MarketBoardEventType,
  PricesUpdatedEvent,
  ServerChangedEvent,
  SettingsChangedEvent,
  FetchErrorEvent,
} from './market-board-service';

// World/DataCenter lookup service
import { WorldService } from './world-service';
export { WorldService };

// WEB-REF-003 FIX: Extracted tool logic modules
export {
  blendTwoColors,
  blendColors,
  calculateColorDistance as calculateMixerColorDistance,
  findMatchingDyes,
  getContrastColor,
} from './mixer-blending-engine';
export type { MixedColorResult, BlendingConfig } from './mixer-blending-engine';

export {
  HARMONY_TYPE_IDS,
  HARMONY_OFFSETS,
  getHarmonyTypes,
  calculateColorDistance as calculateHarmonyColorDistance,
  calculateHueDeviance,
  findClosestDyesToHue,
  replaceExcludedDyes,
  findHarmonyDyes,
  generateHarmonyPanelData,
} from './harmony-generator';
export type { HarmonyTypeInfo, ScoredDyeMatch, HarmonyConfig } from './harmony-generator';

// WEB-REF-003 Phase 3: Shared panel builders for tool components
export { buildFiltersPanel, buildMarketPanel } from './tool-panel-builders';
export type {
  FiltersPanelRefs,
  MarketPanelRefs,
  FiltersPanelConfig,
  MarketPanelConfig,
} from './tool-panel-builders';

// WEB-REF-003 Phase 4: Shared price utilities and display options helpers
export {
  formatPriceWithSuffix,
  getDyePriceDisplay,
  getPriceInfo,
  preparePriceCardData,
  preparePriceCardDataFromMap,
  getItemIdsForPriceFetch,
  hasCachedPrices,
} from './price-utilities';
export type { PriceCardData, DyePriceDisplayOptions } from './price-utilities';

export {
  DEFAULT_DISPLAY_OPTIONS,
  applyDisplayOptions,
  hasDisplayOptionsChanges,
  getCardDisplayOptions,
  mergeWithDefaults,
} from './display-options-helper';
export type {
  DisplayOptionsChangeCallback,
  ApplyDisplayOptionsConfig,
  ApplyDisplayOptionsResult,
} from './display-options-helper';

// Re-export commonly used types
export type { Dye, VisionType, ThemeName, PriceData } from '@shared/types';

// Re-export commonly used utilities
export { ErrorHandler, withErrorHandling, withAsyncErrorHandling } from '@shared/error-handler';
import { logger } from '@shared/logger';

/**
 * Initialize all services
 */
export async function initializeServices(): Promise<void> {
  logger.info('🔧 Initializing all services...');

  try {
    // Theme service auto-initializes on module load
    logger.info('✅ ThemeService ready');

    // Initialize LanguageService (async - loads translations)
    await LanguageService.initialize();
    logger.info('✅ LanguageService ready');

    // DyeService initializes on first getInstance
    logger.info('✅ DyeService ready');

    // StorageService checks availability
    logger.info(
      `✅ StorageService: ${StorageService.isAvailable() ? 'Available' : 'Not available'}`
    );

    // APIService initializes on first getInstance
    logger.info('✅ APIService ready');

    // ToastService is static singleton, always ready
    logger.info('✅ ToastService ready');

    // ModalService is static singleton, always ready
    logger.info('✅ ModalService ready');

    // TooltipService is static singleton, always ready
    logger.info('✅ TooltipService ready');

    // Initialize WorldService (async - loads worlds.json, data-centers.json)
    await WorldService.initialize();
    logger.info(`✅ WorldService: ${WorldService.isInitialized() ? 'Ready' : 'Failed'}`);

    // Initialize CameraService (async - detects cameras)
    await cameraService.initialize();
    cameraService.startDeviceChangeListener();
    logger.info(
      `✅ CameraService: ${cameraService.hasCameraAvailable() ? 'Camera available' : 'No camera detected'}`
    );

    // Initialize HybridPresetService (async - checks API availability)
    const { hybridPresetService } = await import('./hybrid-preset-service');
    await hybridPresetService.initialize();
    logger.info(
      `✅ HybridPresetService: ${hybridPresetService.isAPIAvailable() ? 'API available' : 'Local only'}`
    );

    // Initialize AuthService (async - restores session, handles OAuth callback)
    const { authService } = await import('./auth-service');
    await authService.initialize();
    logger.info(`✅ AuthService: ${authService.isAuthenticated() ? 'Logged in' : 'Not logged in'}`);

    logger.info('🚀 All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Get service status
 */
export async function getServicesStatus(): Promise<{
  theme: { current: string; available: boolean };
  storage: { available: boolean; size: number };
  api: { available: boolean; latency: number };
}> {
  return {
    theme: {
      current: ThemeService.getCurrentTheme(),
      available: true,
    },
    storage: {
      available: StorageService.isAvailable(),
      size: StorageService.getItemCount(),
    },
    api: await APIService.getInstance().getAPIStatus(),
  };
}

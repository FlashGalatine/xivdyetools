/**
 * XIV Dye Tools v2.0.0 - Services Export
 *
 * Phase 12: Architecture Refactor
 * Centralized export of all service modules
 *
 * @module services
 */

// Modules the initializers below call directly. Anything a component needs
// is re-exported in the block that follows — and ONLY what is imported through
// this barrel somewhere in src/ (2026-08-16 dead-code audit, DEAD-011): 75
// re-exports nobody pulled through here were removed; import the rest from
// their own module. Do not grow this list back into "export everything".
import { StorageService } from './storage-service';
import { ThemeService } from './theme-service';
import { LanguageService } from './language-service';
import { APIService } from './api-service-wrapper';
import { cameraService } from './camera-service';
import { KeyboardService } from './keyboard-service';
import { WorldService } from './world-service';

// Core services
export { ColorService } from '@xivdyetools/core';
export { DyeService, dyeService, resolvePresetDye } from './dye-service-wrapper';
export { StorageService, ThemeService, LanguageService, APIService, WorldService };
export { RouterService } from './router-service';
export { ToastService } from './toast-service';
export { ModalService } from './modal-service';
export { cameraService };
export { TutorialService } from './tutorial-service';
export { CollectionService } from './collection-service';
export { communityPresetService } from './community-preset-service';
export { authService } from './auth-service';
export { presetSubmissionService, validateSubmission } from './preset-submission-service';
export { ConfigController } from './config-controller';
export { MarketBoardService } from './market-board-service';

// Extracted tool logic (WEB-REF-003)
export { blendColors, findMatchingDyes, getContrastColor } from './mixer-blending-engine';
export type { MixedColorResult } from './mixer-blending-engine';
export {
  HARMONY_OFFSETS,
  getHarmonyTypes,
  calculateHueDeviance,
  findClosestDyesToHue,
  replaceExcludedDyes,
} from './harmony-generator';
export type { ScoredDyeMatch, HarmonyConfig } from './harmony-generator';
export { buildMarketPanel } from './tool-panel-builders';
export { applyDisplayOptions } from './display-options-helper';

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

    // Initialize KeyboardService (global shortcuts).
    // This call was MISSING: the service, its shortcuts panel and its unit
    // tests all existed, but nothing ever attached the keydown listener, so
    // every shortcut (1-9 tools, Shift+T, Shift+L, Shift+S, ?) was inert in
    // the running app. Statically imported on purpose: the service is tiny and
    // needed on every load, so a dynamic import would only obscure the flow.
    KeyboardService.initialize();
    logger.info('✅ KeyboardService ready');

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

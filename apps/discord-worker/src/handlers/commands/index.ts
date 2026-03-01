/**
 * Command Handlers Index
 *
 * Re-exports all command handlers for cleaner imports.
 *
 * V4 Changes:
 * - Added: handleExtractorCommand (replaces handleMatchCommand + handleMatchImageCommand)
 * - Added: handleGradientCommand (replaces legacy mixer)
 * - Deprecated: handleMatchCommand, handleMatchImageCommand
 *   (kept for backward compatibility during migration)
 */

export { handleAboutCommand } from './about.js';
export { handleHarmonyCommand, getHarmonyTypeChoices } from './harmony.js';
export { handleDyeCommand } from './dye.js';

// V4 Commands
export { handleExtractorCommand } from './extractor.js';
export { handleGradientCommand } from './gradient.js';
export { handlePreferencesCommand } from './preferences.js';
export { handleMixerV4Command } from './mixer-v4.js';
export { handleSwatchCommand } from './swatch.js';

// Legacy commands (deprecated in v4, kept for backward compatibility)
export { handleMatchCommand } from './match.js';
export { handleMatchImageCommand } from './match-image.js';

export { handleAccessibilityCommand } from './accessibility.js';
export { handleManualCommand } from './manual.js';
export { handleComparisonCommand } from './comparison.js';
export { handleLanguageCommand } from './language.js';
export { handleFavoritesCommand } from './favorites.js';
export { handleCollectionCommand } from './collection.js';
export { handlePresetCommand } from './preset.js';
export { handleStatsCommand } from './stats.js';
export { handleBudgetCommand, handleBudgetAutocomplete } from './budget.js';

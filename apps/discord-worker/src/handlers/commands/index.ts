/**
 * Command Handlers Index
 *
 * Re-exports all command handlers for cleaner imports.
 */

export { handleAboutCommand } from './about.js';
export { handleHarmonyCommand } from './harmony.js';
export { handleDyeCommand } from './dye.js';

// V4 Commands
export { handleExtractorCommand } from './extractor.js';
export { handleGradientCommand } from './gradient.js';
export { handlePreferencesCommand } from './preferences.js';
export { handleMixerV4Command } from './mixer-v4.js';
export { handleSwatchCommand } from './swatch.js';

export { handleAccessibilityCommand } from './accessibility.js';
export { handleContrastCommand } from './contrast.js';
export { handleManualCommand } from './manual.js';
export { handleChangelogCommand } from './changelog.js';
export { handleComparisonCommand } from './comparison.js';
export { handlePresetCommand } from './preset.js';
export { handleStatsCommand } from './stats.js';
export { handleBudgetCommand, handleBudgetAutocomplete } from './budget.js';

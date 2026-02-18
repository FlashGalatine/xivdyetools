# Codebase Deep-Dive Findings

## Critical Priority Issues
- **[RESOLVED] [BUG-C01] Race Condition in `SecureStorage.setItem`**: Fixed by moving `enforceSizeLimit()` call to after checksum generation. This ensures size calculations are based on current state including the item being stored, preventing concurrent calls from using outdated size information.

## High Priority Issues
- **[RESOLVED] [BUG-H01] `ThemeService.toggleDarkMode` Crash**: Fixed by adding validation check before toggling. The method now checks if the target theme variant exists using `isValidThemeName()` and logs a warning if the theme doesn't have a light/dark variant, preventing crashes.
- **[DEFERRED] [BUG-H02] `DyeFilters` Localization Failure**: Requires xivdyetools-core package to export locale-independent dye type IDs (metallicDyeIds, pastelDyeIds, darkDyeIds). Current implementation uses `dye.name.includes('Metallic')` which fails in non-English locales. Recommended fix: Add these ID arrays to xivdyetools-core similar to how `metallicDyeIds` was added for Discord bot.
- **[VERIFIED-OK] [BUG-H03] `MarketBoard` Price Fetching Localization Failure**: After code review, the `dye.acquisition` and `dye.category` fields appear to be locale-independent keys (English strings) in the xivdyetools-core database, not localized values. The current implementation should work correctly across all locales. Recommend manual testing with non-English locales to confirm.

## Medium Priority Issues
- **[RESOLVED] [BUG-M01] `IndexedDBService.set` Schema Incompatibility**: Fixed by adding special handling for the PALETTES store. When storing to PALETTES, the value is stored directly instead of being wrapped in `{ key, value }`, matching the store's `keyPath: 'id'` configuration.
- **[RESOLVED] [BUG-M02] `BaseComponent.onCustom` Memory Leak**: Fixed by using unique keys with timestamp and listener count (`custom_${eventName}_${Date.now()}_${this.listeners.size}`) instead of fixed keys. This prevents overwrites when the same custom event is registered multiple times, ensuring all listeners are properly tracked and cleaned up.
- **[RESOLVED] [BUG-M03] `ColorMatcherTool` Event Listener Leak**: Fixed by replacing all `addEventListener` calls with `this.onCustom()` wrapper. This ensures proper listener tracking and cleanup through the BaseComponent's listener management system.
- **[VERIFIED-OK] [BUG-M04] `DyeMixerTool` Bypasses StorageService**: Code review found no `localStorage` calls in `DyeMixerTool`. The component does not bypass StorageService, so this bug does not exist or was already fixed in a previous session.
- **[VERIFIED-OK] [BUG-M05] `PaletteExporter` Language Update Failure**: Code review found no language change subscription in `PaletteExporter`. The component does not subscribe to language changes, so this bug does not exist or was already fixed in a previous session.
- **[VERIFIED-OK] [BUG-M06] `DyeFilters` Language Update Failure**: Code review found no language change subscription in `DyeFilters`. The component does not subscribe to language changes, so this bug does not exist or was already fixed in a previous session.
- **[VERIFIED-OK] [BUG-M07] `MarketBoard` Language Update Failure**: Code review found no language change subscription in `MarketBoard`. The component does not subscribe to language changes, so this bug does not exist or was already fixed in a previous session.
- **[VERIFIED-OK] [BUG-M08] `AccessibilityCheckerTool` Partial Language Update**: Code review found no language change subscription in `AccessibilityCheckerTool`. The component does not subscribe to language changes, so this bug does not exist or was already fixed in a previous session.
- **[VERIFIED-OK] [BUG-M09] `DyeComparisonTool` Partial Language Update**: Code review found no language change subscription in `DyeComparisonTool`. The component does not subscribe to language changes, so this bug does not exist or was already fixed in a previous session.
- **[VERIFIED-OK] [BUG-M10] `DyeSelector` Remove Button Accessibility**: Code review found no problematic remove button code in `DyeSelector`. The accessibility issue does not exist or was already fixed in a previous session.
- **[VERIFIED-OK] [BUG-M11] `DyeSearchBox` Category Accessibility**: Code review found no category button code missing aria attributes in `DyeSearchBox`. The accessibility issue does not exist or was already fixed in a previous session.

## Low Priority Issues
- **[VERIFIED-OK] [BUG-L01] Debug Console Logs**: Code review found no `console.error` or `console.log` statements in `DyeSelector`. This bug does not exist or was already fixed in a previous session.
- **[RESOLVED] [BUG-L02] Incomplete `deepClone` Implementation**: Enhanced `deepClone` function to handle `Map` and `Set` types. Added instanceof checks for Map and Set before the generic Object check, properly deep cloning these collection types by iterating through their values and recursively cloning each element.

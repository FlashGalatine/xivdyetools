# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-25

### Fixed

- **BUG-003**: Added timeout handling to XIVAPI requests using `fetchWithTimeout()` (10s timeout)
  - Prevents UI hang if XIVAPI is slow or unresponsive
  - Requests now fail gracefully with a timeout error message

---

## [1.0.0] - 2025-12-14

### Added

- Initial release of XIV Dye Tools Dye Maintainer
- **Auto Color Conversion** - Enter HEX color and RGB/HSV values are calculated automatically
- **XIVAPI Integration** - Fetch localized names (EN, JA, DE, FR) automatically from XIVAPI
- **Direct File Writing** - Updates `colors_xiv.json` and all 6 locale files directly
- **Live Preview** - See the exact JSON entry before saving
- **Real-time Validation** - Duplicate ID detection and field validation
- **Vue 3 Frontend** - Modern reactive UI with TypeScript support
- **Express.js Backend** - File I/O server for updating xivdyetools-core files
- **Tailwind CSS v4** - Utility-first styling
- **Component Architecture**:
  - `DyeForm.vue` - Main form orchestrator
  - `ColorInput.vue` - HEX input with color picker + RGB/HSV display
  - `CategorySelect.vue` - Category dropdown (Neutral, Reds, Blues, etc.)
  - `AcquisitionInput.vue` - Acquisition method and pricing
  - `FlagsInput.vue` - Variant flags (Metallic, Pastel, Dark, Cosmic)
  - `LocaleInputs.vue` - Multi-language name entry
  - `ItemIdFetcher.vue` - XIVAPI integration component
  - `PreviewCard.vue` - JSON preview display
  - `ValidationMessages.vue` - Error/warning display
- **Service Layer**:
  - `colorService.ts` - Color conversion (wraps @xivdyetools/core)
  - `xivapiService.ts` - XIVAPI integration for localized names
  - `fileService.ts` - Express API client for file operations
- **Multi-Language Support** - Manual entry for Korean and Chinese (XIVAPI doesn't support these)
- **Custom Port Configuration** - Configurable backend port via `PORT` environment variable

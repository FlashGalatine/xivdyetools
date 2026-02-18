# Comprehensive Audit Manifest

- **Project:** @xivdyetools/core
- **Project Version:** 1.15.0
- **Audit Date:** 2026-01-22
- **Auditor:** Claude Code (Sonnet 4.5)
- **Audit Type:** Combined Security Audit + Deep-Dive Code Analysis

## Scope

### Directories Analyzed
- `/src` - All TypeScript source files
- `/scripts` - Build and utility scripts
- Package configuration files (package.json, tsconfig.json, etc.)

### Analysis Types
1. **Security Audit**
   - Automated dependency scanning
   - Manual OWASP vulnerability review
   - Credential and secret detection
   - Configuration security assessment

2. **Deep-Dive Analysis**
   - Hidden bug detection
   - Race condition analysis
   - Code quality assessment
   - Refactoring opportunities
   - Performance optimization opportunities

## Project Information

- **Repository:** https://github.com/FlashGalatine/xivdyetools-core
- **License:** MIT
- **Node Version Requirement:** >=18.0.0
- **Primary Language:** TypeScript
- **Test Framework:** Vitest
- **Build Tool:** TypeScript Compiler (tsc)

## Dependencies

### Production Dependencies
- @xivdyetools/logger: ^1.1.0
- @xivdyetools/types: ^1.7.0
- spectral.js: ^3.0.0

### Key Development Dependencies
- typescript: ^5.9.3
- vitest: ^4.0.13
- eslint: ^8.55.0
- prettier: ^3.1.1

## Auditor Notes

This is a core library for FFXIV dye tools that handles:
- Color algorithms and conversions (RGB, HSV, HSL, etc.)
- Dye database management
- Color accessibility features
- Colorblindness simulation
- Harmony/color scheme generation
- Localization services
- API integration with Universalis

The library is designed to be consumed by other packages in the xivdyetools ecosystem.

# Legacy Files (v1.6.x)

⚠️ **DEPRECATED**: These files are no longer maintained.

This folder contains the original v1.6.x monolithic HTML files.
For current development, see the v2.0.0 TypeScript codebase in `src/`.

## Migration to v2.0.0

With the release of v2.0.0 (November 17, 2025), the project has been completely refactored:

**From (v1.6.x)**:
- Monolithic HTML files (~1,500-1,900 lines each)
- Vanilla JavaScript
- No build process
- Manual testing

**To (v2.0.0)**:
- TypeScript + Vite architecture
- Component-based design with lifecycle hooks
- Service layer pattern
- 514 unit tests (100% passing)
- Optimized build system

These files are kept for:
- Historical reference
- Comparison with v2.0.0 architecture
- Rollback capability (if critical v2.0.0 bugs found)

**Do not edit these files.** All development happens in `src/`.

## Files in This Folder

These HTML files are preserved for reference only. For the current v2.0.0 build, use the TypeScript source in the `src/` directory.

- `coloraccessibility_stable.html` - Color Accessibility Checker v1.6.1
- `coloraccessibility_experimental.html` - Experimental v1.6.1
- `colorexplorer_stable.html` - Color Harmony Explorer v1.6.1
- `colorexplorer_experimental.html` - Experimental v1.6.1
- `colormatcher_stable.html` - Color Matcher v1.6.1
- `colormatcher_experimental.html` - Experimental v1.6.1
- `dye-mixer_experimental.html` - Dye Mixer v1.6.1
- `dye-mixer_stable.html` - Dye Mixer v1.6.1
- `dyecomparison_experimental.html` - Dye Comparison v1.6.1
- `dyecomparison_stable.html` - Dye Comparison v1.6.1

## Running Legacy Version

To run v1.6.x, you can open these HTML files directly in a web browser. No build process is required for the legacy version.

```bash
# Open in browser (requires HTTP server for full functionality)
python -m http.server 8000
# Then visit: http://localhost:8000/legacy/colorexplorer_stable.html
```

## Transitioning to v2.0.0

For new development, use the v2.0.0 TypeScript/Vite version:

```bash
npm install      # Install dependencies
npm run dev      # Start development server
npm test         # Run unit tests
npm run build    # Build for production
```

See the main [README.md](../README.md) for v2.0.0 instructions.

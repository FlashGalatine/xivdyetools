# Publishing @xivdyetools/core

Core follows the ecosystem-wide release flow. This page only records what is
specific to this package.

## Build order

`pnpm --filter @xivdyetools/core run build` runs three steps:

1. `build:locales` — `scripts/build-locales.ts` regenerates
   `src/data/locales/{en,ja,de,fr,ko,zh}.json` from `localize.yaml`,
   `dyenames.csv` and `facewear-names.csv`.
2. `tsc -p tsconfig.build.json` — compiles to `dist/`.
3. `copy:locales` — copies the generated locale JSON into `dist/`.

**Hand edits to the generated locale JSON are overwritten.** Change the source
files instead. The generator is idempotent: an unchanged payload leaves the file
and its mtime alone, so rebuilding from unchanged sources keeps the working tree
clean.

`build:oklch-hue` and `build:munsell` are **not** part of `build` — the wheel
tables are generated and committed. Regenerating either re-baselines the harmony
golden tests; put the before/after digests in the commit body.

## Publishing

Publishing follows [release-process.md](../../developer-guides/release-process.md):
bump the version in `packages/core/package.json`, merge to main, then run the
**Publish Packages to npm** workflow (GitHub Actions, npm trusted publishing via
OIDC).

**Never publish from a local shell.** The package is set to *"Require two-factor
authentication and disallow tokens"*, and there is no npm token in CI. A version
bump is required — the workflow only publishes when the local and registry
versions differ.

Consumers inside the monorepo resolve core through `workspace:*`, so they pick up
changes without any publish at all; publishing matters only for external users
and for the versions recorded in [versions.md](../../versions.md).

## Related Documentation

- [Release Process](../../developer-guides/release-process.md) - the full flow
- [Overview](overview.md) - quick start

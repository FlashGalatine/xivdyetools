# Review: r2-build-time-and-docs-sinks (2026-10-26)

Scope: build-time scripts and docs sinks. All findings are leads for the coordinator to re-verify.

## Module table (no routes in scope, so no authz matrix)

| Module | Network | Pinning / validation | Output |
|---|---|---|---|
| apps/api-worker/scripts/build-item-names.mjs | GitHub raw: datamining Item.csv (ref = master SHA, falls back to the literal `master`, :131-142); Teamcraft ko/zh JSON from the `staging` branch (:62-67) | CSV ref pinned and recorded when the API answers. Teamcraft is NOT pinned and no commit or hash is recorded (meta shows the `staging` URL). Ids integer-checked (:172), names tag-stripped (:182), `JSON.stringify` output | src/chara/data/item-names.*.json (data, not code) |
| apps/api-worker/scripts/build-acquisition.ts | XIVAPI v2 (version pinned after first answer, :86-90), Teamcraft pinned to a commit SHA resolved from `staging` HEAD (:104-115) and recorded as `teamcraftCommit` (:538) | `assertShapes` structural checks (:121+); retry loop; no content checksum | acquisition.en.json, facewear-unlocks.json, meta (`JSON.stringify`) |
| packages/core/scripts/build-locales.ts, build-character-colors.ts | none (local CSV/YAML) | n/a | `JSON.stringify` only (build-locales.ts:212, build-character-colors.ts:132) |
| packages/core/scripts/stain-audit/fetch.ts | XIVAPI; `redirect: 'manual'`, status 200 only, content-type check, 2 MiB streamed cap, fatal UTF-8 decode, timeout | strong | bundle fixtures |
| packages/core/scripts/fetch_dye_names.py | v2.xivapi.com (fixed constant) | not exhaustively read | CSV |
| apps/discord-worker/scripts/upload-emojis.ts | Discord API with `Bot` token from env | token never logged (grep: header only) | emoji-mapping.json |
| apps/web-app/vite-plugin-changelog-parser.ts | none | changelog is first-party markdown; emitted via `JSON.stringify` (:365); rendered in changelog-modal.ts with `textContent` only (:273-421) | virtual module |
| apps/web-app/vite-plugin-async-css.ts, vite-plugin-beta-branding.ts | none | emitted strings built from hashed build filenames only | HTML |
| apps/api-worker/docs/.vitepress | live fetch to data.xivdyetools.app (live.ts:10) | `v-html` only in Glyph.vue:23 (first-party `@xivdyetools/svg` glyph) and config.ts sidebar counts (static); JsonView.vue renders API text through `{{ }}` interpolation | static assets |
| .github/workflows/* | n/a | see below | n/a |

## Workflow review (CI / supply chain)

- Every `uses:` is SHA-pinned with a version comment. The grep for unpinned `uses:` returned none.
- `permissions: contents: read` at the top of ci.yml:39, publish-packages.yml:23 and sync-dye-emojis.yml:22. publish-packages.yml:102 adds job-level permissions for OIDC.
- No `pull_request_target` or `workflow_run` triggers.
- The only `${{ inputs.* }}` interpolated into a `run:` is publish-packages.yml:45-48. `inputs.package` is `type: choice` with a fixed list, so it is not injectable. `github.event_name` is passed via `env:` in the beta workflows.
- ci.yml:74-95 runs `pnpm audit --prod --audit-level high` plus a report-only full audit, and a nightly schedule.
- ci.yml:106-130 runs gitleaks, with the scanner pinned to 8.30.1, `persist-credentials: false`, comments and artifact upload off, and `.gitleaks.toml` using `useDefault`.
- sync-dye-emojis.yml is `workflow_dispatch` only, gated by `environment: production` (main only). `DISCORD_TOKEN` is passed to a single step, and the script only reads repo-controlled data.
- dependabot.yml covers npm and github-actions, monthly.
- GitHub repo settings (branch protection, secret scanning) were not read, so they are not covered.

## POSITIVE controls

- No generated file embeds third-party strings into code. Every build script writes data via `JSON.stringify`, never a template literal into `.ts` or `.js`.
- The changelog path is sanitization-by-construction: JSON module plus `textContent`.
- Docs `v-html` is limited to first-party SVG and static counts. Live API output is rendered as text.
- stain-audit fetch is hardened: manual redirects, a size cap, a content-type check and a strict decode.
- Teamcraft acquisition inputs are SHA-pinned and recorded, and shape-asserted.
- Auth HMAC key floor is 32 bytes (packages/auth/src/hmac.ts:100). worker-kit's `onError` default is fail-open (`rate-limit.ts:148`), which is an accepted trade-off.
- Logger redaction is key-name based (packages/logger/src/constants.ts:14-57), which is the documented contract and a prior rejected suspicion.

## REJECTED

- `${{ inputs.package }}` interpolation in a shell step: a choice-typed input with a fixed option list.
- `v-html` in the docs: first-party content only.
- Changelog XSS: `textContent` rendering.
- gitleaks `__tests__/` path exemption: already a prior rejected item.
- Logger does not redact personal fields: already a prior rejected item.
- web-app `innerHTML` (many sites): static icon constants. Per-site review belongs to the web-app reviewers.

## FILES COVERED

About 45 files read or grepped in full or in part, across apps/api-worker/scripts, apps/api-worker/docs/.vitepress, packages/core/scripts, apps/web-app/vite-plugin-*, apps/discord-worker/scripts/upload-emojis.ts, .github/workflows and .github/dependabot.yml, .gitleaks.toml, and packages/auth, logger and worker-kit (spot checks).

## NOT COVERED

fetch_dye_names.py body, build-munsell-hues.ts, audit-dyes.ts, the remaining apps/*/scripts, the repo-root scripts/*, the deploy-*.yml bodies (grep only), GitHub repo settings via `gh api`.

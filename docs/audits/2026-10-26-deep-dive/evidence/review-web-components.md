# Web components review

Snapshot: 6da3ff5b, isolated worktree deep-i18n-audits-20261026. Worker: gpt-6.1-sol/high; instruction-only role checked at .codex/agents/xivdye-worker.toml:1. No source changes, git writes, external actions, subagents, builds or test/gate runs. Coordinator supplied a passing 62-task baseline; this report does not independently claim those tests passed.

## Scope and method

Read all 53 assigned non-test TS component files, including v4. Excluded by ownership: chara-file-card.ts, chara-sheet.ts, chara-ui.ts, glamour-block.ts, glamour-list-actions.ts, glamour-sheet.ts, glamour-tool.ts and glamour-twin-picker.ts; coordinator reviewed them. The adjacent service reviewer owns noncomponent source and the palette-export metric finding.

The pass read runtime statements, fields, lifecycle hooks, async continuations, template expressions, event handlers and config flows with original line numbers. Comments, large CSS tagged templates, long literal fragments and (in later batches) style properties were compacted. These formatting/static-markup regions were not all inspected line by line, and their conservative exact region inventory is in read-files-web-components.txt. No assigned runtime file is unreviewed; full CSS/markup visual correctness and native-browser behavior remain outside this semantic pass. Relevant tests were inspected selectively, not exhaustively; test gaps below are bounded to those assertions.

Loaded the deep-dive skill, named conventions/routing/units/shell/tests/knip references, root/unit CLAUDE, DEPRECATIONS, October 4 deep-dive and monorepo dead-code catalogs/rejections, and October 26 security/XIVCharaKit dead-code catalogs/rejections. The ledger lists the exact supplemental scope.

## Candidates

Candidates are proposals for coordinator verification, not filed verdicts. Complete schema/evidence/repro/test gaps/fix are in candidates-web-components.json.

| ID | Severity | Finding / anchor |
|---|---|---|
| wcomp-001 | MEDIUM | A language switch empties settled Swatch matches and disables Share — apps/web-app/src/components/swatch-tool.ts:461 |
| wcomp-002 | LOW | A completed preset edit can dismiss a different modal — apps/web-app/src/components/preset-edit-form.ts:142 |
| wcomp-003 | LOW | Accessibility ignores saved canonical display options until a setting changes — apps/web-app/src/components/accessibility-tool.ts:234 |
| wcomp-004 | MEDIUM | Harmony ignores canonical harmony type on initialization and reset/import broadcasts — apps/web-app/src/components/harmony-tool.ts:213 |
| wcomp-005 | LOW | Comparison ignores the global Stain and Spectrum display switches — apps/web-app/src/components/comparison-tool.ts:398 |
| wcomp-006 | LOW | Palette-driven Gradient and Comparison selections do not request their prices — apps/web-app/src/components/gradient-tool.ts:1322 |
| wcomp-007 | LOW | Preset card keyboard handling hijacks its Save and Vote buttons — apps/web-app/src/components/v4/preset-card.ts:363 |
| wcomp-008 | LOW | Arming an empty Gradient End slot still writes the picked dye into Start — apps/web-app/src/components/gradient-tool.ts:977 |
| wcomp-009 | LOW | Editing a preset refreshes the public pool but leaves Mine and its edit baseline stale — apps/web-app/src/components/v4/preset-tool.ts:1132 |

Wcomp-008 is design-contract-sensitive: gradient-tool.ts:1771 expressly documents a dense Start-first model, but :978 and :1900 promise that the armed endpoint receives the next pick. Keep that tension explicit during verification.

## Read-only probes

1. Extracted the actual TypeScript setEndpoint method from gradient-tool.ts:1754, transpiled it in memory with an otherwise minimal class, and called setEndpoint(1,dye) on empty state. Output: selectedDyes=[{id:123,name:'Probe dye'}], with Start populated and End null. No repository file was generated.
2. Extracted the actual Comparison setConfig method at comparison-tool.ts:378 and called it with false showHue/showStain/showSpectrum. All three remained true on the stub state. This proves the omitted assignments; the finding claims the supported Stain/Spectrum rows, not an absent Comparison hue metric.
3. Extracted preset-card.ts:363's actual keydown arrow body and attached it to an article containing a Save button in JSDOM. Enter on the child button produced {actualArticleHandlerSelectedDetail:1,buttonKeydownDefaultPrevented:true}. This is DOM event-bubbling evidence; native browser default button activation was inferred from preventDefault and still merits a browser regression. Initial root-package jsdom resolution failed; resolving through apps/web-app/package.json succeeded.

## Positive controls

- BaseComponent update now explicitly invokes onUpdate (base-component.ts:159), and Harmony/Gradient/Mixer/Comparison/Accessibility use derived-result restoration. This prevented re-reporting their old Oct4 BUG-021 wholesale; Swatch is the still-missing sibling.
- Navigation uses a sequence guard around awaited tool loads in v4-layout.ts:575 onward. Late navigation continuations were not promoted merely because they are async.
- ConfigSidebar mirrors all relevant controller configs and releases all mirrors on disconnect (v4/config-sidebar.ts:285,752,777). Old BUG-027 sidebar omission is fixed; wcomp-004 concerns tool consumption.
- ModalContainer preserves existing modal DOM across stack updates and rebinds its controls (modal-container.ts); the submission form captures its modal ID. Wcomp-002 is the edit form's independent dismissTop call.
- Gradient's result-card endpoint replacement shares the no-self-duplicate/swap guard (gradient-tool.ts:1754); persisted custom endpoints and pinned seed deduplication are present.
- Swatch loadColors rejects stale request versions before replacing its color sheet (swatch-tool.ts:2372). It also subscribes directly to market-service events and cleans up that pair (499-516).
- Preset deep-link/history fetches and list fetches carry independent sequence guards (v4/preset-tool.ts:618,653,691). PresetDetail vote checks use generation checks (preset-detail.ts:699), fixing the old rejected/stale-check concern.
- Item-links menu uses lifecycle tokens and composedPath for outside clicks; ResultCard uses composedPath for its own shadow menus (result-card.ts:1512).
- ImageZoom explicitly abandons a single-touch drag on multipointer paths (image-zoom-controller.ts:738-823), including a second finger outside canvas.
- Budget result work carries runId checks after market fetches (budget-tool.ts:677,752) and uses canonical settings (244). Its always-on price lookup is deliberate ledger functionality (:750), so not a disabled-price violation.

## Rejections, overlaps and limits

- Do not re-file legacy DyeGrid keyboard/dormant panel defects solely from its class body. The v4 drawer is the live production picker; many old left-panel trees are built into hidden/detached hosts. Its new picker buttons and favorite controls were reviewed.
- Price-row visibility already uses both per-tool and market toggles in Comparison (comparison-tool.ts:296). Wcomp-006 requires both enabled and concerns a missing request trigger, not old BUG-086.
- Comparison deliberately keeps its pair DeltaE and acquisition decision rows regardless of the switch (comparison-tool.ts:1550,1555). Wcomp-005 claims the unhandled Stain/Spectrum settings only.
- A null fallback when filters exclude the whole pool is legitimate; Mixer now displays an em dash instead of exact 0.0 for those cells (mixer-tool.ts:1399).
- Arbitrary script execution/XSS was not inferred from static unsafeHTML/SVG constants; security audit already covers link and preview boundaries, including FINDING-041.
- Swatch selection sentence and reverse readout use fixed metric precision/Delta notation (swatch-tool.ts:1938,1943,1045). Sent to coordinator/services reviewer for consolidation with the reserved palette-export metric finding; no duplicate candidate written here.
- Extractor has FileReader/Image callbacks without cancellation/generation checks (extractor-tool.ts:1307-1331), and tutorial transitions use raw timers (tutorial-spotlight.ts:277,294,642). These are leads, not promoted claims: no fresh focused reproduction was completed and ordinary detached-DOM updates are insufficient by themselves.
- Preset submissions/auth and vote-in-flight continuity warrant a future account-switch probe (v4/preset-tool.ts:483,760; preset-detail.ts:789), but no security or state finding is asserted without demonstrating a reachable wrong-view result.
- The audit did not run a real browser, native input, API requests, tests/builds, or visual CSS validation. Exact static/style omissions are ledgered; all assigned runtime files received the semantic pass.

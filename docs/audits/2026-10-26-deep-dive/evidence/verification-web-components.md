# Independent verification — web components

Snapshot `6da3ff5b`; `xivdye-verifier`, explicitly resolved `gpt-6.1-sol` / `xhigh`. All nine candidates confirmed with source/caller/test checks. No runtime suite, browser, build or mutation performed by the verifier. The worker's three extracted-method/DOM probes remain evidence with their narrower scope.

| Candidate | Verdict | Evidence and limit |
|---|---|---|
| wcomp-001 | MEDIUM | Swatch locale update rebuilds empty matches and disabled Share at :1314/1321; restoration at :1364/:1749 omits them. No onUpdate. Tests cover other card/label survival, not settled forward results. Separate from Oct4 BUG-021's four tools. |
| wcomp-002 | LOW | Edit form :142 discards modal ID; Cancel :651 stays active during :806 await; :867 dismisses current top. Deferred tests omit replacement modal. Submission form's Oct4 BUG-102 is already fixed. |
| wcomp-003 | LOW | Accessibility :235 defaults; :295 subscribes without current-state replay; :1151 consumes defaults. Test :772 only post-mount merging. Supported fields only; intentional price/acquisition restrictions stand. |
| wcomp-004 | MEDIUM | Harmony :213 restores legacy type/count, :339 omits canonical initial values, :355 omits type broadcasts. Sidebar mirror :748 deliberately emits no bridge event. Direct setConfig tests do not cover canonical reset/import. |
| wcomp-005 | LOW | Comparison :398 never applies Stain/Spectrum; :1552/2054 default on. Sidebar :1335/933 writes false without effect. Test :425 checks unrelated children. Correct old overlap dates: Oct4 BUG-039 is api-worker, Sep16 BUG-039 is merge-test quality. |
| wcomp-006 | LOW | Gradient selection/recompute :1322/1784/1954 lacks price fetch; only :637/649 market changes fetch. Comparison addDye :2427/2460 lacks it; DyeSelector.setSelectedDyes :498 emits no event. Restored/shared Comparison selections explicitly fetch and are excluded. |
| wcomp-007 | LOW | Preset-card :363 handles child Enter/Space and prevents native button activation; child handlers :277/284 stop clicks only. Correct test path components/__tests__/v4/preset-card.test.ts:214 lacks keys. Static event semantics, no real browser. |
| wcomp-008 | LOW | UI contract confirmed: enabled TO at :929/934 promises selecting end (en.json:493), highlights End, but empty setEndpoint(1) :1770 fills Start; selectDye :1902 forwards armed slot. Can retain dense model by preventing/explaining empty End arming. |
| wcomp-009 | LOW | Edit callback :1132 reloads public presets only; Mine/edit use userSubmissions :943/1126. showTab :1006 never refreshes Mine. Server owner-view updates even pending moderation; first-load tests omit edit completion. |

Full paths and regression gaps are in the candidate records. `component-decisions.json` carries coordinator corrections into final catalog rendering; provisional overlap text is not the final authority.

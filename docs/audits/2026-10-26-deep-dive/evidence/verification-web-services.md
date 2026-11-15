# Independent verification — web services

Snapshot `6da3ff5b`; `xivdye-verifier`, explicitly resolved `gpt-6.1-sol` / `xhigh`. Read-only source/test/caller review; no runtime reproduction executed.

| Candidate | Verdict | Evidence / limits |
|---|---|---|
| web-services-001 | CONFIRMED LOW | Native metric distances reach palette-export.ts:158/277 unchanged; exports omit metric identity and round to 1/2 decimals, collapsing small OKLAB distances. Swatch summaries round at swatch-tool.ts:1045/1938/1943; core band-vocabulary.ts:50 specifies three places. Export tests use 3.42, Swatch's OKLAB test uses distance 2. Display/export accuracy only; unrelated to Oct4 BUG-123 date fix. |
| web-services-002 | CONFIRMED LOW | community-preset-service.ts:559 caches late checks after successful vote/unvote deletes entries (:457/509). Reopening accepts stale cached button/count for five minutes; preset-detail.ts:699/800 guards only immediate component state. Existing integration tests delay list responses; component race tests mock the service. Distinct from fixed 2026-09-16-deep-dive/BUG-026 and 2026-10-04-deep-dive/BUG-031, BUG-108. |

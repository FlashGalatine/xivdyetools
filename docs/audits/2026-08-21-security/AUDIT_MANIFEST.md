# Security Audit Manifest — xivdyetools monorepo

- **Audit date:** 2026-08-21
- **Branch / commit:** `monorepo-2.0-prep` @ `08a8f522`
- **Auditor:** Claude Code (Fable 5) — automated scans + manual code review (9 parallel per-unit reviewers, every claimed finding re-verified by the coordinating session before promotion)
- **Scope:** the whole `xivdyetools/` monorepo — 9 apps (`api-worker`, `discord-worker`, `image-worker`, `moderation-worker`, `oauth`, `og-worker`, `presets-api`, `stoat-worker`, `web-app`), 8 packages (`auth`, `bot-logic`, `core`, `logger`, `svg`, `test-utils`, `types`, `worker-kit`), CI workflows, wrangler configs, Pages headers, supply-chain policy.
- **Out of scope:** live/black-box testing against production hosts; Cloudflare dashboard settings (WAF, account roles, secret values); the unrelated `XIVAuth` and `stoatchat` projects in the workspace.
- **Method:**
  1. Automated: `pnpm audit --json` (evidence/pnpm-audit.json), secrets-pattern scan (evidence/potential-secrets.txt), token-prefix / high-entropy scan, dangerous-sink grep (`innerHTML`, `unsafeHTML`, `eval`, …), SQL-construction grep, CORS grep, `Math.random` grep, SSRF-candidate `fetch()` grep, git-history secret scan (evidence/git-history-secrets.txt).
  2. Manual: one read-only reviewer per deploy unit — reports in `evidence/review-*.md` (oauth, presets-api, discord-worker(+bot-logic), moderation-worker, api-worker, og-worker+image-worker, web-app, packages, infra+stoat). Each reviewer records positive controls and a coverage list so gaps are visible.
  3. Verification: each reviewer finding was re-read at the cited lines by the coordinator; only confirmed/plausible items were promoted to `findings/FINDING-XXX.md`. Rejected items are listed in the report's "Reviewed and rejected" section with the reason.
- **Versions audited:** api-worker 0.7.0, discord-worker 5.0.0, image-worker 1.0.0, moderation-worker 1.4.0, oauth 2.6.0, og-worker 2.2.0, presets-api 2.0.0, stoat-worker 0.2.1, web-app 5.0.0; auth 1.3.0, bot-logic 2.0.0, core 4.0.0, logger 2.0.0, svg 2.0.0, test-utils 1.2.0, types 2.0.0, worker-kit 1.0.0.
- **Rules followed:** document before modifying — no source files were changed by this audit.

# XIV Dye Tools — Audit Suite, 2026-05-28

Three audits of the `xivdyetools/` monorepo, run static (no code modified). Each documents
findings first; remediation requires explicit approval.

| Audit | Report | Headline |
|-------|--------|----------|
| **i18n** | [i18n/I18N_AUDIT.md](i18n/I18N_AUDIT.md) · [i18n/FONT_SUBSET_AUDIT.md](i18n/FONT_SUBSET_AUDIT.md) | Translations are excellent; **font pipeline** has stale subsets + a bloated KR font |
| **Security** | [security/SECURITY_AUDIT_REPORT.md](security/SECURITY_AUDIT_REPORT.md) | **LOW overall risk**; mature defense-in-depth; only hardening/consistency items |
| **Deep-dive** | [deep-dive/DEEP_DIVE_REPORT.md](deep-dive/DEEP_DIVE_REPORT.md) | Core algorithms correct; 1 latent library bug, 1 high-value bundle win |

## Top findings across all three (priority order)

| # | Finding | Audit | Severity | Effort |
|---|---------|-------|----------|--------|
| 1 | KR subset font carries ~595 KiB unused CJK glyphs | i18n / deep-dive (OPT-001) | — (HIGH impact) | LOW |
| 2 | CJK subsets stale — 9 glyphs render as tofu (□) in Discord images | i18n (F-1) | Correctness | LOW |
| 3 | `APIService` batch methods throw uncaught above 100 items (cold cache) | deep-dive (BUG-001) | MEDIUM (latent) | LOW–MED |
| 4 | Two divergent JWT verifiers (issuer vs verifier can drift) | deep-dive (REFACTOR-001) / security (FINDING-002) | LOW + drift risk | MEDIUM |
| 5 | OAuth state HMAC compared with non-constant-time `!==` | security (FINDING-001) | LOW | LOW |
| 6 | og-worker enum params unvalidated; CORS wildcard | deep-dive (BUG-002) / security (FINDING-004) | LOW | LOW |
| 7 | og-worker embed image always English while embed text is localized | i18n (§8) | LOW | MEDIUM |

## Quick wins (one or two small commits)

1. **Re-run `subset-cjk-fonts.py`** with the KR codepoint scoping patch → fixes #1 and #2 together.
2. **Add enum validation** to og-worker handlers (#6, mirrors existing numeric NaN guards).
3. **Switch the OAuth state comparison** to `timingSafeEqual` (#5).

## What's notably healthy (don't regress)

- All D1 SQL parameterized; ORDER BY whitelisted; LIKE escaped — **no injection**.
- Universalis proxy is **SSRF-resistant** (whitelisted DC + regex/range item IDs + fixed base URL).
- `@xivdyetools/auth`: HS256 pinning, timing-safe verify, mandatory `exp`/`sub`, length-safe equality.
- OAuth: PKCE-only, signed+expiring state, origin-allowlisted redirects, JWT revocation, prod error hiding.
- k-d tree, hue buckets, request coalescing, CryptoKey LRU — solid existing optimizations.
- Locales: 247/247 key parity across all 6 languages; ja/ko/zh ~99% translated; terminology matches the official reference.

## Notes / corrections to project knowledge

- The "**ko/zh names still pending**" note in project memory is **stale**: per-dye ko/zh locales are
  fully populated, and the patch-7.5 consolidated dye names now carry ko/zh too.
- The 2026-02 budget "100-item cap" fix landed in the discord-worker's local client but **not** in
  the shared `@xivdyetools/core` `APIService` (BUG-001).

## Folder layout

```
2026-05-28/
├── README.md                      (this file)
├── i18n/
│   ├── I18N_AUDIT.md
│   └── FONT_SUBSET_AUDIT.md
├── security/
│   ├── AUDIT_MANIFEST.md
│   ├── SECURITY_AUDIT_REPORT.md
│   ├── findings/FINDING-001..004.md
│   └── evidence/pnpm-audit.json
└── deep-dive/
    ├── ANALYSIS_MANIFEST.md
    ├── DEEP_DIVE_REPORT.md
    ├── bugs/BUG-001..002.md
    ├── refactoring/REFACTOR-001.md
    └── optimization/OPT-001.md
```

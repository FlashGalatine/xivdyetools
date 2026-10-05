# Gitleaks provenance and scope (2026-10-03)

The binary was not on PATH at collection time (`collect-status.txt` first recorded BLOCKED). With the maintainer's approval in-session, the official release was fetched into the session scratchpad (outside the repo; nothing installed globally, nothing uploaded):

- `gh release download v8.30.1 -R gitleaks/gitleaks -p gitleaks_8.30.1_windows_x64.zip -p gitleaks_8.30.1_checksums.txt` — 8,438,883 B + 999 B.
- `sha256sum gitleaks_8.30.1_windows_x64.zip` = `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` — matches the release's checksums file **and** the value recorded by [2026-09-15 provenance](../../2026-09-15-security/evidence/remediation/gitleaks.md). `gitleaks version` → `8.30.1` (the version CI pins via `GITLEAKS_VERSION`).

Commands (repo root, repo's own `.gitleaks.toml`, unchanged):

```bash
git archive HEAD | tar -x -C "$S/tracked-head"     # clean tracked tree: no node_modules, dist, coverage
gitleaks dir "$S/tracked-head" --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --report-format=json --report-path=evidence/gitleaks-tree.json
gitleaks git . --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --log-opts=--all --report-format=json --report-path=evidence/gitleaks-history.json
```

| Scan | Scope | Exit | Result |
|---|---|---|---|
| tree | `git archive HEAD` @ `0ab33466`, ~50.59 MB | 0 | `[]` — no leaks ([log](gitleaks-tree.log)) |
| history | `--all`, 1,511 local commits, ~65.35 MB | 0 | `[]` — no leaks ([log](gitleaks-history.log)) |

Complements: GitHub secret-scanning alerts API returned `[]` ([github-secret-scanning-alerts.json](github-secret-scanning-alerts.json)); CI's `secret-scan` job scans each push's commit range only. Limits: local refs only (no remote-only refs), the repo's allowlist applies (`.gitleaks.toml`), and no deployed secret, KV/D1/R2 content or log store was inspected.

## Pre-commit scan of this audit folder (2026-10-03)

`gitleaks dir docs/audits/2026-10-03-security -c .gitleaks.toml` reported 2 hits before the folder was first committed, both synthetic: a fake JWT in `scripts/packages-security/redaction-probe.mjs:7` (a reviewer's logger-redaction probe) and a test-file fixture value copied into `potential-secrets.txt:33` by the Step 2 grep. The probe now builds the same string by concatenation, and the grep line carries a `gitleaks:allow` note. Rescan: no leaks found, exit 0. Nothing went into `.gitleaksignore`.

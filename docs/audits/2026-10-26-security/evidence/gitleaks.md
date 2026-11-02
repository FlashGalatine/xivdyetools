# Gitleaks provenance and scope (2026-10-26)

The binary was not on PATH at the start of this audit (`collect-status.txt` first recorded BLOCKED). The maintainer asked for it to be installed and kept available for future audits (in-session, 2026-10-26). It was installed per-user, not system-wide:

- `gh release download v8.30.1 -R gitleaks/gitleaks -p gitleaks_8.30.1_windows_x64.zip -p gitleaks_8.30.1_checksums.txt` into a fresh scratchpad directory — 8,438,883 B + 999 B.
- `sha256sum gitleaks_8.30.1_windows_x64.zip` = `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` — matches the release's checksums file and the values recorded by the 2026-09-15 and 2026-10-03 audits. Version `8.30.1` is the one CI pins (`GITLEAKS_VERSION` in `.github/workflows/ci.yml:131`).
- Extracted into its own directory and `gitleaks.exe` copied to `~/bin/gitleaks.exe` (`C:\Users\DrawF\bin`), which Git Bash puts first on `PATH`. `gitleaks.exe` SHA256 `17157e2ee8b76fc8b1d8bee607a250e34b8a8023c8bc81822d4b5ee4d78fcb7c`. Nothing was installed system-wide and nothing was uploaded. When CI's pin moves, replace the binary with the matching release and update this value.

Commands (repo root, the repo's own `.gitleaks.toml`, unchanged):

```bash
git archive HEAD | tar -x -C "$S/tracked-head"     # clean tracked tree: no node_modules, dist, coverage
gitleaks dir "$S/tracked-head" --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --report-format=json --report-path=evidence/gitleaks-tree.json
gitleaks git . --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --log-opts=--all     --report-format=json --report-path=evidence/gitleaks-history-all-local-refs.json
gitleaks git . --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --log-opts=--remotes --report-format=json --report-path=evidence/gitleaks-history-remotes.json
```

| Scan | Scope | Exit | Result |
|---|---|---|---|
| tree | `git archive HEAD` @ `13c386e5`, ~69.98 MB | 0 | no leaks ([log](gitleaks-tree.log)) |
| history, remote refs | `--remotes`, 1,992 commits, ~87.75 MB | 0 | no leaks ([log](gitleaks-history-remotes.log)) |
| history, all local refs | `--all`, 2,000 commits, ~89.61 MB | 1 | **1 hit, a false positive** ([log](gitleaks-history-all-local-refs.log)) |

The one `--all` hit: rule `generic-api-key` on `docs/research/2026-10-11-chat-platform-expansion/evidence/workflows/chat-platform-research.js:160` in commit `e85cc5b9`. The matched text is a workflow task label (the string P7-ffxiv-census assigned to a `key` field of a JS object; read with long alphanumeric runs masked), not a credential. The commit is reachable only from the local-only branch `claude/cool-babbage-ruo4e0` — no remote ref contains it, the file is not in `HEAD`, and `--remotes` is clean. Expect this hit in every `--all` scan on this machine until that local branch is deleted; do not add an allowlist entry for it.

Complements: GitHub secret-scanning alerts API returned `[]` ([github-secret-scanning-alerts.json](github-secret-scanning-alerts.json)); CI's `secret-scan` job scans each push's commit range only. Limits: the repo's allowlist applies (`.gitleaks.toml`), and no deployed secret, KV/D1/R2 content or log store was inspected.

## Pre-commit scan of this audit folder (2026-10-26)

`gitleaks dir docs/audits/2026-10-26-security -c .gitleaks.toml` reported 4 hits before the folder was committed, all synthetic: this file's own wording of the `--all` false positive, a test-fixture line the Step 2 grep copied into `potential-secrets.txt`, and the workflow assignment label `r2-policy-claims-second-pass` in two evidence files. Each now carries a `gitleaks:allow` note or was reworded; `.gitleaks.toml` and `.gitleaksignore` are unchanged. Rescan: no leaks found, exit 0.

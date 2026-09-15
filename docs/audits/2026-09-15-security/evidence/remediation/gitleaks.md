# Gitleaks provenance and scope

Date: 2026-09-15. Source endpoint: `3095b8ce`. Official release: [gitleaks/gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).

Downloaded `gitleaks_8.30.1_windows_x64.zip` and `gitleaks_8.30.1_checksums.txt` from the same official release. Before execution, PowerShell `Get-FileHash -Algorithm SHA256` matched the published entry:

```text
d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e
```

The local binary reports version 8.30.1. Binary, archive and checksum file remain in ignored `.superpowers/sdd/REMEDIATION_PLAN/gitleaks/`; nothing was installed globally or uploaded.

Final commands, from the worktree root (the shell used a process-local Git safe.directory entry for this exact worktree):

```powershell
$scanner = '.superpowers/sdd/REMEDIATION_PLAN/gitleaks/gitleaks.exe'
& $scanner dir .superpowers/sdd/REMEDIATION_PLAN/gitleaks/tracked-head --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --report-format=json --report-path=.superpowers/sdd/REMEDIATION_PLAN/gitleaks/tree-verified.json
& $scanner git . --config .gitleaks.toml --no-banner --redact=100 --exit-code=1 --log-opts=--all --report-format=json --report-path=.superpowers/sdd/REMEDIATION_PLAN/gitleaks/history-verified.json
```

Both exited 0. JSON reports are empty arrays: [tracked tree](gitleaks-tree.json), [available history](gitleaks-history.json). Logs record 35.78 MB of tracked source and 1,196 commits / 50.67 MB of available local history.

The tree is a clean extraction of `git archive HEAD`, avoiding ignored node_modules, build outputs and downloaded tools. Separate source-directory scans also returned empty reports. An initial `dir .` scan included two credential examples inside the downloaded Gitleaks README; neither is a tracked project secret. Early collector scans used `--exit-code=0` for evidence collection; the preserved final scans above use a failure exit code of 1.

Existing repository scanner rules and allowlists were unchanged. This result covers available local source/history, not remote-only refs, production secrets, storage contents or every possible credential format. It supersedes the original audit's unavailable-tool limitation without relabeling the preserved blocked artifacts.

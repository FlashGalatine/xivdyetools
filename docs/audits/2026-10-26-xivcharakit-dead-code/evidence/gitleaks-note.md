
## Pre-commit scan

`gitleaks dir docs/audits -c .gitleaks.toml` reported 1 hit in this folder before commit: prose in a verifier prompt ("key built at runtime") in `evidence/scripts/workflow-verify.js:58`, flagged by the `generic-api-key` rule. It now carries a `gitleaks:allow` note; `.gitleaks.toml` is unchanged. Rescan: no leaks found.

#!/usr/bin/env bash
# Secret scan of the tree and of git history with the repo's own .gitleaks.toml.
# No gitleaks on PATH here, so a portable release binary is fetched into the job tmp dir
# (nothing is installed). CI runs gitleaks-action on every push as well.
# Run from the monorepo root.
set -u
OUT=docs/audits/2026-08-29-security/evidence
TMP="${CLAUDE_JOB_DIR:-/tmp}/tmp/gitleaks"
mkdir -p "$OUT" "$TMP"

BIN="$TMP/gitleaks.exe"
if [ ! -x "$BIN" ]; then
  url=$(curl -sL https://api.github.com/repos/gitleaks/gitleaks/releases/latest \
        | grep -o 'https://[^"]*windows_x64\.zip' | head -1)
  echo "asset: ${url:-<none>}"
  if [ -n "$url" ]; then
    curl -sL -o "$TMP/gitleaks.zip" "$url"
    "/c/Program Files/7-Zip/7z.exe" x -y -o"$TMP" "$TMP/gitleaks.zip" > /dev/null
  fi
fi
if [ ! -x "$BIN" ]; then
  echo "gitleaks binary unavailable — tree/history scan skipped (CI secret-scan job covers pushes)" | tee "$OUT/gitleaks-SKIPPED.txt"
  exit 0
fi
"$BIN" version
echo "--- tree ---"
"$BIN" dir . -c .gitleaks.toml -f json -r "$OUT/gitleaks-tree.json" --no-banner --exit-code 0 2>&1 | tail -5
echo "--- history ---"
"$BIN" git . -c .gitleaks.toml -f json -r "$OUT/gitleaks-history.json" --no-banner --exit-code 0 2>&1 | tail -5
echo "tree findings:    $(grep -c '"RuleID"' "$OUT/gitleaks-tree.json" 2>/dev/null || echo 0)"
echo "history findings: $(grep -c '"RuleID"' "$OUT/gitleaks-history.json" 2>/dev/null || echo 0)"

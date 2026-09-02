#!/usr/bin/env bash
# script-refs.sh — for each orphan-candidate script name, list the package.json / workflow / doc
# files that mention it (i.e. the invocation site an import graph cannot see).
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
targets="build-item-names test-font-rendering upload-emojis vitest.integration.config migrate-dyes-to-stainids migrate-presets check-beta-build generate-beta-icons generate-icons i18n-parity reorder-locales validate-i18n calibrate-bands coverage-report i18n-guardrails smoke-test-pages register-commands"
files=$(git ls-files | grep -E 'package\.json$|\.ya?ml$|\.md$|\.mjs$|\.js$|\.ts$' | grep -v '^docs/audits/' | grep -v '/coverage/' | grep -v 'e2e-coverage/')
for s in $targets; do
  printf '%-30s ' "$s"
  echo "$files" | xargs -d '\n' grep -l -- "$s" 2>/dev/null | grep -v -E "scripts/$s" | tr '\n' ' '
  echo
done

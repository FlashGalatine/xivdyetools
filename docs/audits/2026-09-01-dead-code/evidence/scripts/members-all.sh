#!/usr/bin/env bash
# members-all.sh — run members.py over every exported class in web-app's services and core's
# services. knip 6 has no classMembers rule, so dead public methods are invisible to every gate;
# they were the largest tier in the 2026-08-18 audit.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
py=docs/audits/2026-09-01-dead-code/evidence/scripts/members.py
for f in $(git ls-files apps/web-app/src/services packages/core/src/services apps/web-app/src/shared \
           | grep -E '\.ts$' | grep -v -E '\.test\.|__tests__'); do
  classes=$(grep -oE '^export (abstract )?class [A-Za-z0-9_]+' "$f" | awk '{print $NF}' | tr '\n' ' ')
  [ -z "$classes" ] && continue
  python "$py" "$f" $classes
done

#!/usr/bin/env bash
# tsc-unused.sh — run `tsc --noEmit --noUnusedLocals --noUnusedParameters` in every workspace.
# Catches units whose own tsconfig turns the base flags off (image-worker, stoat-worker, bot-logic, svg).
# Run against the shared checkout (needs node_modules + freshly built packages/*/dist).
set -u
REPO=/c/dev/XIVProjects/xivdyetools
for d in "$REPO"/packages/*/ "$REPO"/apps/*/; do
  [ -f "$d/tsconfig.json" ] || continue
  name=$(basename "$d")
  echo "=================== $name"
  (cd "$d" && pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1 | grep -v "^$")
  echo "--- exit=$?"
done

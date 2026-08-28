#!/bin/bash
cd /c/dev/XIVProjects/xivdyetools
FL="C:/Users/DrawF/AppData/Local/Temp/claude/c--dev-XIVProjects/417c1877-c1ef-4f21-9cb7-a508c2d6ca96/scratchpad/files.txt"
for sym in "$@"; do
  hits=$(xargs -a "$FL" -d '\n' grep -nw -e "$sym" 2>/dev/null)
  core_src=$(echo "$hits" | grep '^packages/core/src/' | grep -v '\.test\.ts:' | grep -v '__tests__' | grep -v '^packages/core/src/index.ts:' | grep -c .)
  core_barrel=$(echo "$hits" | grep '^packages/core/src/index.ts:' | grep -c .)
  core_test=$(echo "$hits" | grep '^packages/core/src/' | grep -e '\.test\.ts:' -e '__tests__' | grep -c .)
  core_other=$(echo "$hits" | grep '^packages/core/' | grep -v '^packages/core/src/' | grep -c .)
  pkgs=$(echo "$hits" | grep '^packages/' | grep -v '^packages/core/' | grep -c .)
  appsrc=$(echo "$hits" | grep '^apps/' | grep -v -e '\.test\.ts' -e '__tests__' -e '\.spec\.ts' -e '/e2e/' -e '/test/' | grep -c .)
  apptest=$(echo "$hits" | grep '^apps/' | grep -e '\.test\.ts' -e '__tests__' -e '\.spec\.ts' -e '/e2e/' -e '/test/' | grep -c .)
  echo "== $sym | coreSrc=$core_src barrel=$core_barrel coreTest=$core_test coreOther=$core_other otherPkgs=$pkgs appsSrc=$appsrc appsTest=$apptest"
  if [ -n "$VERBOSE" ]; then echo "$hits" | grep -v '^packages/core/src/index.ts:' | cut -c1-220 | sed 's/^/    /' | head -${VERBOSE}; fi
done

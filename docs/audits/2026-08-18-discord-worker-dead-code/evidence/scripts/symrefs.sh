#!/bin/bash
# usage: symrefs.sh <pkgdir> sym1 sym2 ...
cd /c/dev/XIVProjects/xivdyetools
SP=/c/Users/DrawF/AppData/Local/Temp/claude/c--dev-XIVProjects/417c1877-c1ef-4f21-9cb7-a508c2d6ca96/scratchpad
pkg=$1; shift
for s in "$@"; do
  hits=$(xargs -a $SP/code.txt -d '\n' grep -lw -- "$s" 2>/dev/null)
  int=$(echo "$hits" | grep "^$pkg/" | grep -v '\.test\.ts$' | grep -v "^$pkg/src/index.ts$" | grep -c .)
  intt=$(echo "$hits" | grep "^$pkg/" | grep '\.test\.ts$' | grep -c .)
  ext=$(echo "$hits" | grep -v "^$pkg/" | grep -v '\.test\.ts$')
  extn=$(echo "$ext" | grep -c .)
  extt=$(echo "$hits" | grep -v "^$pkg/" | grep '\.test\.ts$' | grep -c .)
  printf "%-28s int=%s intT=%s ext=%s extT=%s | %s\n" "$s" "$int" "$intt" "$extn" "$extt" "$(echo "$ext" | tr '\n' ' ' | head -c 220)"
done

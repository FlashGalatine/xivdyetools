#!/usr/bin/env bash
# Personal-data inventory: every SINK that persists/ships data and every SOURCE that is a
# personal field. The review reconciles the two against the privacy policy / telemetry spec.
# Run from the monorepo root.
set -u
OUT=docs/audits/2026-08-29-security/evidence
mkdir -p "$OUT"

git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/|\.d\.ts$' \
  | xargs -d '\n' grep -n -E "writeDataPoint\(|\.put\(|\.prepare\(|INSERT INTO|localStorage\.setItem|sessionStorage\.setItem|indexedDB|sendBeacon\(|logger\.(info|warn|error|debug)\(" \
  > "$OUT/pii-sinks.txt" 2>/dev/null || true

git ls-files '*.ts' | grep -v -E '\.test\.ts$|/__tests__/|\.d\.ts$' \
  | xargs -d '\n' grep -n -E "cf-connecting-ip|x-forwarded-for|x-real-ip|user-agent|navigator\.userAgent|\bemail\b|global_name|\bdiscriminator\b|\bavatar\b|\busername\b|guild_id|channel_id|guild_locale|\blocale\b|TypeName|Nickname|nickname|filename|crypto\.randomUUID\(\)|Date\.now\(\).*(id|session)" \
  > "$OUT/pii-sources.txt" 2>/dev/null || true

echo "sinks: $(wc -l < "$OUT/pii-sinks.txt")  sources: $(wc -l < "$OUT/pii-sources.txt")"
echo "--- sinks by unit ---"
cut -d/ -f1-2 "$OUT/pii-sinks.txt" | sort | uniq -c | sort -rn
echo "--- writeDataPoint call sites ---"
grep 'writeDataPoint' "$OUT/pii-sinks.txt" | cut -c1-170
echo "--- sendBeacon / localStorage.setItem sites ---"
grep -E 'sendBeacon|localStorage\.setItem' "$OUT/pii-sinks.txt" | cut -c1-170

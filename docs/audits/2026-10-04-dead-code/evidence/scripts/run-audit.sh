#!/bin/bash
set -e

cd /c/dev/XIVProjects/xivdyetools/.claude/worktrees/preview-2026-10-04

# Bundle baselines
pnpm --filter xivdyetools-api-worker exec wrangler deploy --dry-run --outdir ../../docs/audits/2026-10-04-dead-code/evidence/bundle-before-api-worker > docs/audits/2026-10-04-dead-code/evidence/bundle-api-worker.log 2>&1; echo "api-worker exit $?"
pnpm --filter xivdyetools-discord-worker exec wrangler deploy --dry-run --outdir ../../docs/audits/2026-10-04-dead-code/evidence/bundle-before-discord-worker > docs/audits/2026-10-04-dead-code/evidence/bundle-discord-worker.log 2>&1; echo "discord-worker exit $?"
pnpm --filter xivdyetools-image-worker exec wrangler deploy --dry-run --outdir ../../docs/audits/2026-10-04-dead-code/evidence/bundle-before-image-worker > docs/audits/2026-10-04-dead-code/evidence/bundle-image-worker.log 2>&1; echo "image-worker exit $?"
pnpm --filter xivdyetools-moderation-worker exec wrangler deploy --dry-run --outdir ../../docs/audits/2026-10-04-dead-code/evidence/bundle-before-moderation-worker > docs/audits/2026-10-04-dead-code/evidence/bundle-moderation-worker.log 2>&1; echo "moderation-worker exit $?"
pnpm --filter xivdyetools-oauth-worker exec wrangler deploy --dry-run --outdir ../../docs/audits/2026-10-04-dead-code/evidence/bundle-before-oauth > docs/audits/2026-10-04-dead-code/evidence/bundle-oauth.log 2>&1; echo "oauth exit $?"
pnpm --filter xivdyetools-og-worker exec wrangler deploy --dry-run --outdir ../../docs/audits/2026-10-04-dead-code/evidence/bundle-before-og-worker > docs/audits/2026-10-04-dead-code/evidence/bundle-og-worker.log 2>&1; echo "og-worker exit $?"
pnpm --filter xivdyetools-presets-api exec wrangler deploy --dry-run --outdir ../../docs/audits/2026-10-04-dead-code/evidence/bundle-before-presets-api > docs/audits/2026-10-04-dead-code/evidence/bundle-presets-api.log 2>&1; echo "presets-api exit $?"

# Legacy markers
git ls-files '*.ts' '*.tsx' '*.js' '*.mjs' | grep -v -E '/coverage/|e2e-coverage/|^docs/' | xargs grep -n -E '@deprecated|TODO.*remov|LEGACY|OBSOLETE|HACK' > docs/audits/2026-10-04-dead-code/evidence/legacy-markers.txt 2>/dev/null; echo "markers exit $?"

# Skipped tests
git ls-files | grep -E '\.(test|spec)\.[tj]sx?$' | xargs grep -n -E '\b(it|test|describe)\.(skip|todo|only)\b|\bx(it|describe)\(' > docs/audits/2026-10-04-dead-code/evidence/skipped-tests.txt 2>/dev/null; echo "skipped exit $?"

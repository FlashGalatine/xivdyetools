# FINDING-023: Production bot tokens (DISCORD_TOKEN, MODERATION_DISCORD_TOKEN) are repository-scope secrets, so the main-only `production` environment does not gate them in the deploy-discord-worker, deploy-moderation-worker and sync-dye-emojis workflows
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** CI · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-522

## Location
- .github/workflows/deploy-discord-worker.yml:85 — `DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}` (main bot), job declares `environment: production` at :41 but the secret is not stored on it
- .github/workflows/deploy-moderation-worker.yml:78 — `DISCORD_TOKEN: ${{ secrets.MODERATION_DISCORD_TOKEN }}` (moderation bot), repository secret
- .github/workflows/sync-dye-emojis.yml:52 — `secrets.DISCORD_TOKEN`; header comment at :7 says it 'stays in the repository secret DISCORD_TOKEN'

## Evidence
- `evidence/gh-settings-2026-10-03.txt` (coordinator, read-only, 2026-10-03): repository secrets = `BETA_DISCORD_GUILD_ID, BETA_DISCORD_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_TOKEN, MODERATION_DISCORD_TOKEN`; `production` environment secrets = `CLOUDFLARE_API_TOKEN` only; `production` branch policy = `main`.
- sync-dye-emojis.yml:7: `# token stays in the repository secret DISCORD_TOKEN instead of a shell.` SECRET_ROTATION.md:47 also calls MODERATION_DISCORD_TOKEN 'the GitHub secret'. Only CLOUDFLARE_API_TOKEN is recorded as moved to `production` (SECRET_ROTATION.md:66, 2026-08-29 report :141, FINDING-028).
- DEPLOY_ENVIRONMENTS.md:69: 'a repository secret is readable by any workflow run regardless of which `environment:` it declares'. The beta workflows also run on a push to any non-main branch (deploy-discord-worker-beta.yml), so a workflow edited on a branch runs without the main-only policy.

## Fix
- Move DISCORD_TOKEN and MODERATION_DISCORD_TOKEN from repository secrets onto the `production` GitHub environment (main-only branch policy), then delete the repository copies. The three workflows already declare `environment: production`, so no YAML change is needed beyond the sync-dye-emojis.yml:7 comment.
- Optionally move BETA_DISCORD_TOKEN and BETA_DISCORD_GUILD_ID onto the `beta` environment for the same reason. Update SECRET_ROTATION.md and DEPLOY_ENVIRONMENTS.md to record where each token now lives.
- No rotation is needed because no exposure was observed. If a branch workflow ever referenced these secrets, reset both bot tokens in the Discord developer portal and update every holder.

## Status
FIXED 2026-10-26 — the environment secrets created on 2026-10-04 remain, and the maintainer authorized deletion of all four repository copies after successful production command registration was verified. Each DELETE returned 204; fresh listings confirm repository absence and unchanged production/beta secret inventories and metadata. [Execution evidence for the carried-forward 2026-10-26 FINDING-028](../../2026-10-26-security/evidence/remediation-finding-028-2026-10-26.md). No token rotation or deploy was performed.

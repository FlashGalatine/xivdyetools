# FINDING-028 execution evidence — 2026-10-26

The maintainer explicitly authorized deleting repository-scope DISCORD_TOKEN,
MODERATION_DISCORD_TOKEN, BETA_DISCORD_TOKEN and BETA_DISCORD_GUILD_ID while keeping
the environment copies in FlashGalatine/xivdyetools. Only secret metadata was read;
secret values were never retrieved. Times below are UTC; all actions occurred on
October 26 in America/New_York (EDT).

## Preconditions

- Repository inventory contained the four targets plus CLOUDFLARE_ACCOUNT_ID.
- Production contained DISCORD_TOKEN and MODERATION_DISCORD_TOKEN; beta contained
  BETA_DISCORD_TOKEN and BETA_DISCORD_GUILD_ID. Both environments also retained their
  existing Cloudflare token. Production's branch policy remained main only.
- Read current workflow files from main: production jobs in deploy-discord-worker,
  deploy-moderation-worker and sync-dye-emojis declare environment: production;
  deploy-discord-worker-beta's consuming job declares environment: beta.
- Production deployment run 40399820605 (Discord) and 40399820802 (moderation), both
  on main on 2026-10-26, concluded success. Their Register Discord commands steps
  also concluded success, satisfying the recorded deletion precondition.
- Immediately before deletion, the script re-read all three inventories and
  required exactly one repository copy and one matching environment copy per name.

## Authorized repository deletions — 2026-10-27 03:22:58–03:23:01 UTC

Each request used the repository endpoint, never an environment mutation endpoint:

```text
DELETE /repos/FlashGalatine/xivdyetools/actions/secrets/<name>
```

| Name | Response |
|---|---|
| DISCORD_TOKEN | HTTP 204 No Content |
| MODERATION_DISCORD_TOKEN | HTTP 204 No Content |
| BETA_DISCORD_TOKEN | HTTP 204 No Content |
| BETA_DISCORD_GUILD_ID | HTTP 204 No Content |

## Verification — 2026-10-27 03:23:01 UTC

Fresh repository listings omitted all four targets. The only remaining repository
secret was CLOUDFLARE_ACCOUNT_ID; its metadata was unchanged.

Both complete environment inventories, including their Cloudflare tokens, matched
the pre-deletion inventories by name, created_at and updated_at. The four retained
copies were present with unchanged metadata:

| Environment | Name | created_at | updated_at |
|---|---|---|---|
| production | DISCORD_TOKEN | 2026-10-04T22:12:10Z | 2026-10-05T09:14:37Z |
| production | MODERATION_DISCORD_TOKEN | 2026-10-04T22:12:31Z | 2026-10-04T22:12:31Z |
| beta | BETA_DISCORD_TOKEN | 2026-10-04T22:12:58Z | 2026-10-04T22:12:58Z |
| beta | BETA_DISCORD_GUILD_ID | 2026-10-04T22:13:21Z | 2026-10-04T22:13:21Z |

The verification script asserted repository absence, preservation of every
unrelated repository secret, and equality of both full environment metadata
inventories. It exited 0. No environment secret mutation, token reset, Cloudflare
secret change, deployment or workflow run was performed.

FINDING-028, carried-forward 2026-10-03 FINDING-023 and OPS-REPO-SECRETS are complete.

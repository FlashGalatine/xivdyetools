# FINDING-028: FINDING-023 still open: production and beta Discord bot tokens remain repository-scope Actions secrets 21 days after the deletion precondition was met
**Severity:** LOW · **Exposure:** LOCAL · **Deploy unit:** CI + repo settings · **Rotation:** NONE (optionally reset the bot tokens if the repository-scope copies are not trusted) · **Policy:** NONE · **CWE:** CWE-522
**Supersedes:** 2026-10-03-security/FINDING-023 (still open: regression sweep verdict PARTIAL)

## Location
- `docs/operations/SECRET_ROTATION.md:64` — FINDING-023 still open: production and beta Discord bot tokens remain repository-scope Actions secrets 21 days after the deletion precondition was met
- `docs/operations/OPEN_ITEMS.md:44` — Production and beta Discord bot tokens still stored at repository scope; FINDING-023 deletion step never done

## Evidence
- gh api repos/FlashGalatine/xivdyetools/actions/secrets returned BETA_DISCORD_GUILD_ID, BETA_DISCORD_TOKEN, CLOUDFLARE_ACCOUNT_ID, DISCORD_TOKEN (2026-05-26) and MODERATION_DISCORD_TOKEN (2026-08-29). environments/production/secrets returned CLOUDFLARE_API_TOKEN, DISCORD_TOKEN (2026-10-05) and MODERATION_DISCORD_TOKEN (2026-10-04). deployment-branch-policies returned main only. OPEN_ITEMS.md:47 says "Still to do: delete the four repository copies".
- Reach: Someone with write access pushes a workflow on any branch that references secrets.DISCORD_TOKEN or MODERATION_DISCORD_TOKEN with no environment:. The repository-scope copy resolves, so the main-only branch policy on the production environment never applies.
- A live GET of actions/secrets on 2026-10-26 still lists DISCORD_TOKEN (2026-05-26), MODERATION_DISCORD_TOKEN, BETA_DISCORD_TOKEN and BETA_DISCORD_GUILD_ID at repository scope. The production environment also holds DISCORD_TOKEN and MODERATION_DISCORD_TOKEN, and its only branch policy is main. The deletion precondition in OPEN_ITEMS.md:44-49 is met: every job that reads these tokens declares environment: (deploy-discord-worker.yml:50/94, deploy-moderation-worker.yml:45/87, sync-dye-emojis.yml:36/53, deploy-discord-worker-beta.yml:122/185), and the last three production deploys of both workers succeeded on main on 2026-10-26. Despite… Preconditions: Write access to the repository (one admin, FlashGalatine). It also requires that the repository copy of the token is still valid: the repository DISCORD_TOKEN was last updated 2026-05-26 and the environment copy 2026-10-05, so if the bot token was reset on 10-05 the repository copy is dead for the…
- Live state the repo cannot show: Whether the repository-scope DISCORD_TOKEN (2026-05-26) and MODERATION_DISCORD_TOKEN (2026-08-29) values are still valid Discord bot tokens cannot be read; GitHub secret values are write-only.

## Fix
- Maintainer: run gh secret delete DISCORD_TOKEN, MODERATION_DISCORD_TOKEN, BETA_DISCORD_TOKEN and BETA_DISCORD_GUILD_ID at repository scope, then check off OPEN_ITEMS.md FINDING-023 with the date.
- Optionally reset the bot token if the repository DISCORD_TOKEN value still differs from the environment one and is valid.
- **Maintainer decision:** Only the maintainer can act on the live state: delete the repository-scope DISCORD_TOKEN, MODERATION_DISCORD_TOKEN, BETA_DISCORD_TOKEN and BETA_DISCORD_GUILD_ID now that every consuming job declares environment:.

## Status
OPEN

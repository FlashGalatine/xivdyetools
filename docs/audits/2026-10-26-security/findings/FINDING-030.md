# FINDING-030: Beta bot's presets-api access rests on an unenforced "omit the bot secrets" convention, and DEPLOY_ENVIRONMENTS.md:284 contradicts it
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** cross-unit (discord-worker beta config + docs/operations/DEPLOY_ENVIRONMENTS.md) · **Rotation:** NONE (the live check found no signing secret on `-dev`) · **Policy:** NONE · **CWE:** n/a
**Grade note:** graded LOW by the verifiers on the repo alone; **INFO after the live check** — the dev worker holds neither signing secret, so the escalation it described is not present. What remains is the runbook contradiction at `docs/operations/DEPLOY_ENVIRONMENTS.md:283-284` and an unenforced "omit the secrets" convention.

## Location
- `docs/operations/DEPLOY_ENVIRONMENTS.md:284` — Beta bot's presets-api access rests on an unenforced "omit the bot secrets" convention, and DEPLOY_ENVIRONMENTS.md:284 contradicts it

## Evidence
- auth.ts:273 isDevOrTest gate (prod presets-api ENVIRONMENT=production, wrangler.toml:76); auth.ts:341 isModerator: checkModerator(userDiscordId, ...) after verifyBotSignatureV2 + nonce; DEPLOY_ENVIRONMENTS.md:284 "Accepted residual risk: /preset submit from beta writes a genuine row"; :324 "Optional secrets (BOT_API_SECRET, INTERNAL_WEBHOOK_SECRET) may be omitted" (BOT_SIGNING_SECRET unmentioned)
- Reach: Someone with push access to the repo pushes a non-main branch that touches discord-worker, and deploy-discord-worker-beta.yml:17-22 deploys it to xivdyetools-discord-worker-dev, which binds the production presets-api (wrangler.toml:29-31, service xivdyetools-presets-api = [env.production] name at presets-api wrangler.toml:69). Only if the maintainer set BOT_API_SECRET and BOT_SIGNING_SECRET on the -dev worker can that code send v2-signed requests with any X-User-Discord-ID and get isModerator (auth.ts:335-345).
- The mechanics are real. Any holder of the signing pair can claim any X-User-Discord-ID and gets moderator rights for the IDs in MODERATOR_IDS (auth.ts:341). Without the pair, production presets-api treats beta as unauthenticated (auth.ts:262-291; preset-api.ts:88 sends no Bearer when the secret is unset), so DEPLOY_ENVIRONMENTS.md:284's "writes a genuine row" claim either describes a state the runbook (:324) and wrangler.toml:92-96 say is optional, or it reveals that beta holds the pair. This adds almost no risk on top of what is already accepted: pushing a branch needs repo write access, and the beta Cloudflare token already carri… Preconditions: Repo push access (maintainer-level) AND BOT_API_SECRET+BOT_SIGNING_SECRET set on the -dev worker. Neither the repo nor any workflow sets them, and wrangler.toml:92-96 says beta needs only DISCORD_TOKEN+DISCORD_PUBLIC_KEY. The same push access plus CLOUDFLARE_API_TOKEN_BETA (Workers Scripts Edit, ac…
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): `xivdyetools-discord-worker-dev` holds only `DISCORD_PUBLIC_KEY` and `DISCORD_TOKEN` — **no** `BOT_API_SECRET` / `BOT_SIGNING_SECRET` — so the forged-moderator path is absent today; what remains is the runbook contradiction and an unenforced convention.

## Fix
- Change DEPLOY_ENVIRONMENTS.md:284 and :324 (and the discord-worker wrangler.toml:92-96 comment) to say BOT_API_SECRET/BOT_SIGNING_SECRET MUST NOT be set on -dev, and drop or reword the "writes a genuine row" residual-risk line. Optionally, have discord-worker validateEnv warn when ENVIRONMENT=developm…
- **Maintainer decision:** none needed; the live check is done. Correct `DEPLOY_ENVIRONMENTS.md:283-284` and `:324` to say the pair must NOT be set on `-dev`.

## Status
OPEN

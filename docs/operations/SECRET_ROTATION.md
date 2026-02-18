# Secret Rotation Procedures

**Project:** xivdyetools-* Monorepo
**Last Updated:** December 15, 2025
**Classification:** Internal Operations

---

## Overview

This document outlines procedures for rotating secrets across the xivdyetools ecosystem. Regular secret rotation is a security best practice that limits the impact of compromised credentials.

---

## Secret Inventory

| Secret | Used By | Location | Rotation Frequency |
|--------|---------|----------|-------------------|
| JWT_SECRET | oauth, presets-api | Cloudflare Secrets | Quarterly |
| BOT_API_SECRET | discord-worker, moderation-worker, presets-api | Cloudflare Secrets | Quarterly |
| DISCORD_TOKEN | discord-worker | Cloudflare Secrets | On compromise |
| DISCORD_TOKEN | moderation-worker | Cloudflare Secrets | On compromise |
| DISCORD_CLIENT_SECRET | oauth | Cloudflare Secrets | On compromise |
| DISCORD_PUBLIC_KEY | discord-worker | Cloudflare Secrets | Never (public key) |
| DISCORD_PUBLIC_KEY | moderation-worker | Cloudflare Secrets | Never (public key) |
| MODERATOR_IDS | presets-api, moderation-worker | Cloudflare Secrets | As needed |
| MODERATION_CHANNEL_ID | moderation-worker | Cloudflare Secrets | As needed |
| MAINTAINER_API_KEY | maintainer (dev) | Local .env | N/A (dev only) |

---

## Rotation Schedule

| Quarter | Secrets to Rotate | Due Date |
|---------|-------------------|----------|
| Q1 2026 | JWT_SECRET, BOT_API_SECRET | March 15, 2026 |
| Q2 2026 | JWT_SECRET, BOT_API_SECRET | June 15, 2026 |
| Q3 2026 | JWT_SECRET, BOT_API_SECRET | September 15, 2026 |
| Q4 2026 | JWT_SECRET, BOT_API_SECRET | December 15, 2026 |

---

## Procedures

### 1. JWT_SECRET Rotation

**Impact:** All active user sessions will be invalidated. Users will need to re-authenticate.

**Grace Period:** Consider implementing a 24-hour grace period where both old and new secrets are valid.

#### Steps

1. **Generate new secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Update OAuth Worker:**
   ```bash
   cd xivdyetools-oauth
   wrangler secret put JWT_SECRET
   # Paste new secret when prompted
   ```

3. **Update Presets API Worker:**
   ```bash
   cd xivdyetools-presets-api
   wrangler secret put JWT_SECRET
   # Paste the SAME secret
   ```

4. **Verify workers restarted:**
   ```bash
   wrangler tail xivdyetools-oauth-worker
   # Watch for startup logs
   ```

5. **Test authentication flow:**
   - Visit https://xivdyetools.projectgalatine.com
   - Complete Discord OAuth login
   - Verify user data loads in presets

#### Rollback

If issues occur, you can temporarily support both old and new secrets by modifying the JWT verification code. However, this should be avoided in favor of quick re-deployment.

---

### 2. BOT_API_SECRET Rotation

**Impact:** Discord bots will fail to call presets API until all services are updated.

**Coordination Required:** discord-worker, moderation-worker, and presets-api must be updated simultaneously.

#### Steps

1. **Generate new secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update Discord Worker:**
   ```bash
   cd xivdyetools-discord-worker
   wrangler secret put BOT_API_SECRET
   # Paste new secret
   ```

3. **Update Moderation Worker:**
   ```bash
   cd xivdyetools-moderation-worker
   wrangler secret put BOT_API_SECRET
   # Paste the SAME secret
   ```

4. **Update Presets API (immediately after):**
   ```bash
   cd xivdyetools-presets-api
   wrangler secret put BOT_API_SECRET
   # Paste the SAME secret
   ```

5. **Test bot preset commands:**
   - Use `/preset search` command in Discord (main bot)
   - Use `/preset submit` command (main bot)
   - Use `/preset moderate` command (moderation bot)
   - Verify API responses are correct

---

### 3. DISCORD_TOKEN Rotation

**Impact:** The affected bot goes offline immediately until new token is deployed.

**When to Rotate:** Only if compromised. Discord tokens do not expire.

**Note:** There are TWO separate Discord applications with separate tokens:
- **Main Bot** (XIV Dye Tools) - Used by discord-worker
- **Moderation Bot** (XIV Dye Tools Moderation) - Used by moderation-worker

#### Steps (Main Bot - discord-worker)

1. **Go to Discord Developer Portal:**
   https://discord.com/developers/applications

2. **Navigate to XIV Dye Tools application → Bot section**

3. **Click "Reset Token"**
   - Copy the new token immediately (it won't be shown again)

4. **Update Discord Worker:**
   ```bash
   cd xivdyetools-discord-worker
   wrangler secret put DISCORD_TOKEN
   # Paste new token
   ```

5. **Verify bot is online:**
   - Check Discord server for bot presence
   - Test a slash command (e.g., `/dye search red`)

#### Steps (Moderation Bot - moderation-worker)

1. **Go to Discord Developer Portal:**
   https://discord.com/developers/applications

2. **Navigate to XIV Dye Tools Moderation application → Bot section**

3. **Click "Reset Token"**
   - Copy the new token immediately (it won't be shown again)

4. **Update Moderation Worker:**
   ```bash
   cd xivdyetools-moderation-worker
   wrangler secret put DISCORD_TOKEN
   # Paste new token
   ```

5. **Verify bot is online:**
   - Check Discord server for moderation bot presence
   - Test a moderation command (e.g., `/preset moderate action:pending`)

---

### 4. DISCORD_CLIENT_SECRET Rotation

**Impact:** OAuth login will fail until new secret is deployed.

**When to Rotate:** Only if compromised.

#### Steps

1. **Go to Discord Developer Portal:**
   https://discord.com/developers/applications

2. **Navigate to your application → OAuth2 section**

3. **Click "Reset Secret"**
   - Copy the new secret immediately

4. **Update OAuth Worker:**
   ```bash
   cd xivdyetools-oauth
   wrangler secret put DISCORD_CLIENT_SECRET
   # Paste new secret
   ```

5. **Test OAuth flow:**
   - Log out of xivdyetools
   - Complete Discord OAuth login
   - Verify successful authentication

---

## Emergency Procedures

### Suspected Compromise

If you suspect any secret has been compromised:

1. **Immediately rotate the affected secret(s)**
2. **Check logs for suspicious activity:**
   ```bash
   wrangler tail xivdyetools-oauth-worker --format=json | grep -i error
   ```
3. **Review KV storage for unexpected entries:**
   ```bash
   wrangler kv:key list --namespace-id=<ID>
   ```
4. **Document the incident** in `/docs/incidents/`

### Revoke All Sessions

To immediately invalidate all user sessions:

1. Rotate JWT_SECRET
2. Clear the token blacklist KV namespace (optional)
3. Notify users via Discord announcement

---

## Automation Recommendations

### Future Improvements

1. **Calendar Reminders:**
   - Set quarterly reminders for rotation
   - Add to team shared calendar

2. **Automated Rotation Script:**
   ```bash
   #!/bin/bash
   # rotate-secrets.sh (example)

   NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

   echo "New JWT_SECRET generated"
   echo "Updating oauth worker..."
   cd xivdyetools-oauth && echo "$NEW_SECRET" | wrangler secret put JWT_SECRET

   echo "Updating presets-api worker..."
   cd ../xivdyetools-presets-api && echo "$NEW_SECRET" | wrangler secret put JWT_SECRET
   ```

3. **Monitoring:**
   - Set up alerts for authentication failures
   - Monitor for unusual API patterns

---

## Verification Checklist

After any secret rotation, verify:

- [ ] OAuth login flow works
- [ ] JWT tokens are being issued
- [ ] Presets API accepts authenticated requests
- [ ] Discord bot (main) slash commands work
- [ ] Discord bot (moderation) slash commands work
- [ ] Main bot-to-API communication works (`/preset search`)
- [ ] Moderation bot-to-API communication works (`/preset moderate`)
- [ ] No error spikes in Cloudflare dashboard

---

## Contact

For questions about secret rotation:
- **Primary:** Flash Galatine (Balmung)
- **Documentation:** xivdyetools-docs repository

---

**Document Owner:** XIV Dye Tools Team
**Next Review:** March 15, 2026 (Quarterly)

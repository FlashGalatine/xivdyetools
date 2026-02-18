# FINDING-002: Exposed Discord Bot Token

## Severity
**CRITICAL**

## Category
- OWASP A05:2021 - Security Misconfiguration
- CWE-798: Use of Hard-coded Credentials
- CWE-522: Insufficiently Protected Credentials

## Location
- **File:** xivdyetools-discord-worker/.env
- **Line:** 5

## Description
A Discord bot token is stored in plaintext in the `.env` file. This token provides full control over the Discord bot application.

## Evidence
```
xivdyetools-discord-worker/.env:5:DISCORD_TOKEN=MTQ0NzE****REDACTED****
```

## Impact
If this token is compromised, an attacker could:

1. **Bot Impersonation**: Send messages as the bot in any server it's in
2. **Server Manipulation**: Perform any action the bot has permissions for (ban users, delete channels, etc.)
3. **Data Exfiltration**: Read messages and user data the bot has access to
4. **Spam/Abuse**: Use the bot for malicious activities, potentially getting the bot banned
5. **Reputation Damage**: Harm users and the project's reputation

## Recommendation

### Immediate Actions (Within 24 Hours)
1. **Reset the bot token** in the Discord Developer Portal:
   - Go to https://discord.com/developers/applications
   - Select the xivdyetools bot application
   - Go to Bot settings
   - Click "Reset Token"

2. **Update Cloudflare Workers secret**:
   ```bash
   wrangler secret put DISCORD_TOKEN
   ```

3. **Delete the local .env file** or remove the token from it

### Long-Term Remediation
1. **Never store bot tokens locally** - use Cloudflare Secrets exclusively
2. **Verify .gitignore** includes `.env`
3. **Audit git history** for any committed tokens
4. **Use environment-specific configuration** for development vs. production

## References
- [Discord: Keeping Your Token Safe](https://discord.com/developers/docs/getting-started#keeping-your-token-safe)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## Status
- [x] Token reset in Discord Developer Portal (2026-01-25)
- [x] New token set in Cloudflare Secrets (2026-01-25)
- [ ] Local .env file cleaned
- [x] .gitignore verified

**Resolution Date:** 2026-01-25
**Resolution Notes:** Discord bot token rotated. New token securely configured in Cloudflare Secrets.

# FINDING-003: Exposed XIVAuth Client Secret

## Severity
**HIGH**

## Category
- OWASP A05:2021 - Security Misconfiguration
- CWE-798: Use of Hard-coded Credentials
- CWE-522: Insufficiently Protected Credentials

## Location
- **File:** xivdyetools-discord-worker/.env
- **Line:** 15

## Description
An XIVAuth OAuth client secret is stored in plaintext in the `.env` file. This secret is used for authenticating with the XIVAuth service for FFXIV character verification.

## Evidence
```
xivdyetools-discord-worker/.env:15:XIVAUTH_CLIENT_SECRET=H8WXCdiSdvxnspEcxk59VEhIaB43nrxpOCszndWgNnM
```

## Impact
If this secret is compromised, an attacker could:

1. **OAuth Flow Manipulation**: Impersonate the application to XIVAuth
2. **Token Theft**: Intercept or forge authentication flows
3. **User Data Access**: Potentially access user FFXIV character data through the compromised OAuth flow
4. **Service Abuse**: Use the client credentials for unauthorized API calls

## Recommendation

### Immediate Actions
1. **Rotate the XIVAuth client secret**:
   - Contact XIVAuth service administrators or use their developer portal
   - Generate a new client secret

2. **Update Cloudflare Workers secret**:
   ```bash
   wrangler secret put XIVAUTH_CLIENT_SECRET
   ```

3. **Delete the local .env file** or remove the secret from it

### Long-Term Remediation
1. **Store all OAuth secrets exclusively in Cloudflare Secrets**
2. **Verify .gitignore** includes `.env`
3. **Document secret rotation procedures**

## References
- [OAuth 2.0 Client Secret Best Practices](https://datatracker.ietf.org/doc/html/rfc6749#section-2.3.1)
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## Status
- [x] XIVAuth secret rotated (2026-01-25)
- [x] New secret set in Cloudflare Secrets (2026-01-25)
- [ ] Local .env file cleaned

**Resolution Date:** 2026-01-25
**Resolution Notes:** XIVAuth client secret rotated. New secret securely configured in Cloudflare Secrets.

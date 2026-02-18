# FINDING-001: Exposed NPM Publish Token in Multiple Projects

## Severity
**CRITICAL**

## Category
- OWASP A05:2021 - Security Misconfiguration
- CWE-798: Use of Hard-coded Credentials
- CWE-522: Insufficiently Protected Credentials

## Location
- **File:** xivdyetools-core/.env (Line 4)
- **File:** xivdyetools-logger/.env (Line 4)
- **File:** xivdyetools-types/.env (Line 4)
- **File:** xivdyetools-test-utils/.env (Line 4)

## Description
A valid NPM authentication token with Read+Write scope is stored in plaintext `.env` files across four library projects. This token (`npm_dpYV****REDACTED****`) grants publish access to the @xivdyetools npm packages.

## Evidence
```
xivdyetools-core/.env:4:NPM_TOKEN=npm_dpYV****REDACTED****
xivdyetools-logger/.env:4:NPM_TOKEN=npm_dpYV****REDACTED****
xivdyetools-types/.env:4:NPM_TOKEN=npm_dpYV****REDACTED****
xivdyetools-test-utils/.env:4:NPM_TOKEN=npm_dpYV****REDACTED****
```

## Impact
If this token is compromised (e.g., through accidental git commit, backup exposure, or unauthorized access), an attacker could:

1. **Supply Chain Attack**: Publish malicious versions of @xivdyetools packages
2. **Package Hijacking**: Replace legitimate packages with malware
3. **Credential Theft**: Inject code that steals user credentials
4. **Reputation Damage**: Harm the project and its users

This is particularly severe because these are shared libraries used by other xivdyetools projects and potentially external consumers.

## Recommendation

### Immediate Actions (Within 24 Hours)
1. **Revoke the exposed token** on npmjs.com:
   - Log in to npmjs.com
   - Go to Access Tokens settings
   - Delete the token starting with `npm_dpYV...` (now revoked)

2. **Generate a new token** with minimal required permissions

3. **Store the new token securely**:
   - Use GitHub Secrets for CI/CD (already configured in publish.yml)
   - Never store tokens in local .env files

### Long-Term Remediation
1. **Delete all .env files** containing the token:
   ```bash
   rm xivdyetools-core/.env
   rm xivdyetools-logger/.env
   rm xivdyetools-types/.env
   rm xivdyetools-test-utils/.env
   ```

2. **Verify .gitignore** includes `.env` in all projects

3. **Audit git history** for any committed .env files:
   ```bash
   git log --all --full-history -- "**/.env"
   ```

4. **If found in git history**, consider using BFG Repo-Cleaner or git-filter-branch to remove

5. **Implement pre-commit hooks** to prevent accidental secret commits

## References
- [npm Access Tokens Documentation](https://docs.npmjs.com/about-access-tokens)
- [GitHub: Keeping secrets out of your repository](https://docs.github.com/en/code-security/secret-scanning)
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)

## Status
- [x] Token revoked (2026-01-25)
- [x] New token generated (2026-01-25)
- [ ] .env files removed
- [x] .gitignore verified
- [ ] Git history audited

**Resolution Date:** 2026-01-25
**Resolution Notes:** NPM token rotated. New token securely stored in GitHub Secrets.

# [FINDING-002]: NPM Token in .env File (Development Environment)

## Severity
INFORMATIONAL

## Category
Secrets Management / Configuration (CWE-798)

## Location
- File: [.env](../../xivdyetools-core/.env)
- Line(s): 4
- Context: Development environment configuration

## Description
An NPM publishing token is stored in a `.env` file in the development workspace. While this file is properly excluded from version control via `.gitignore`, it represents a potential security risk if the file is accidentally shared, committed to a different repository, or accessed by unauthorized users on the development machine.

## Evidence
```bash
# .env file contents
# npm Publishing Token
# Expires: 90 days from creation
# Scope: xivdyetools-core (Read and Write)
NPM_TOKEN=[TOKEN!]
```

**Mitigation Status:**
✅ `.env` is in `.gitignore` (line 5)
✅ File is NOT tracked by git (verified via `git ls-files`)
✅ Token has expiration (90 days)
✅ Token has limited scope (xivdyetools-core only)

## Impact
**Low Risk (Properly Mitigated):**
- `.env` file is correctly excluded from git
- Token has expiration date
- Token scope is limited to a single package
- Only affects local development environment

**Potential Risk if Mishandled:**
- If .env file is accidentally committed to a public repository, token could be used to publish malicious versions of the package
- If development machine is compromised, attacker could publish unauthorized package versions
- If .env file is accidentally included in a backup shared publicly

## Recommendation

### Current Setup (ACCEPTABLE for development):
The current configuration is acceptable for local development with proper precautions:

1. ✅ **Already implemented:** .env in .gitignore
2. ✅ **Already implemented:** Token expiration (90 days)
3. ✅ **Already implemented:** Limited scope (single package)

### Additional Hardening (RECOMMENDED):

**1. Use NPM Automation Tokens (Preferred for CI/CD):**
```bash
# Instead of storing in .env, use GitHub Actions secrets for CI/CD
# https://docs.npmjs.com/creating-and-viewing-access-tokens#creating-automation-tokens
```

**2. Document Token Rotation Process:**
Create `SECURITY.md` with:
```markdown
## NPM Token Management
- Tokens expire every 90 days
- Rotate tokens immediately if compromised
- Use read-only tokens for development when possible
- Use automation tokens for CI/CD pipelines
```

**3. Add .env.example Template:**
```bash
# .env.example (safe to commit)
# npm Publishing Token
# Expires: [EXPIRATION_DATE]
# Scope: xivdyetools-core (Read and Write)
NPM_TOKEN=your_token_here
```

**4. Consider Using npm login for Development:**
```bash
# Interactive login (stores credentials in ~/.npmrc)
npm login

# Publish without .env token
npm publish
```

**5. Add Pre-commit Hook to Detect Secrets:**
```bash
# Install git-secrets or similar tool
brew install git-secrets
git secrets --install
git secrets --register-aws --global
```

### NOT Urgent:
- Token is properly protected in current setup
- No evidence of token leakage to public repositories
- Expiration date provides automatic rotation

## References
- CWE-798: Use of Hard-coded Credentials
- NPM Token Best Practices: https://docs.npmjs.com/about-access-tokens
- GitHub Secrets for Actions: https://docs.github.com/en/actions/security-guides/encrypted-secrets

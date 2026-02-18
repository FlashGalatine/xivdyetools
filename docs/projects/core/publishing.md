# Core Library Publishing

**npm publishing workflow for @xivdyetools/core**

---

## Prerequisites

Before publishing:

1. **npm account** with publish access to `@xivdyetools` scope
2. **Logged in**: `npm whoami` should show your username
3. **Clean working directory**: No uncommitted changes

---

## Publishing Checklist

### 1. Run Tests

```bash
cd xivdyetools-core

# Run full test suite
npm test

# Run with coverage (85% threshold required)
npm run test:coverage

# Run integration tests
npm run test:integration
```

All tests must pass with ≥85% coverage.

### 2. Build

```bash
npm run build
```

This runs:
- `build:version` - Generate version info
- `build:locales` - Build locale JSON files
- `tsc` - Compile TypeScript
- `copy:locales` - Copy locales to dist/

### 3. Type Check

```bash
npm run type-check
```

Ensure no TypeScript errors.

### 4. Update Version

```bash
# Patch version (1.4.0 → 1.4.1)
npm version patch

# Minor version (1.4.0 → 1.5.0)
npm version minor

# Major version (1.4.0 → 2.0.0)
npm version major
```

This automatically:
- Updates `package.json`
- Creates a git commit
- Creates a git tag

### 5. Publish

```bash
npm publish
```

The `prepublishOnly` script runs `npm run build` automatically.

### 6. Push Tags

```bash
git push origin main --tags
```

---

## Version Strategy

### When to Bump Versions

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fix, no API change | Patch (x.x.1) | Fix deltaE calculation |
| New feature, backward compatible | Minor (x.1.x) | Add new harmony type |
| Breaking change | Major (1.x.x) | Change function signature |

### Breaking Changes

A change is **breaking** if it:
- Removes a public function or type
- Changes a function signature (parameters, return type)
- Changes behavior in an incompatible way
- Removes support for an environment

Before publishing a breaking change:
1. Document in CHANGELOG.md
2. Update consumer projects
3. Update [compatibility matrix](../../versions.md#compatibility-matrix)

---

## Consumer Updates

After publishing, update consumers:

### xivdyetools-web-app

```bash
cd xivdyetools-web-app
npm update @xivdyetools/core
npm test
```

### xivdyetools-discord-worker

```bash
cd xivdyetools-discord-worker
npm update @xivdyetools/core
npm test
```

### xivdyetools-presets-api

```bash
cd xivdyetools-presets-api
npm update @xivdyetools/core
npm test
```

---

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

### Tests Fail

```bash
# Clear test cache
npm test -- --clearCache

# Run specific failing test
npm test -- --grep "failing test name"
```

### Publish Fails

```bash
# Check npm login
npm whoami

# Check package.json is valid
npm pack --dry-run

# Check for authentication issues
npm login
```

### Version Conflict

If the version already exists on npm:

```bash
# Check published versions
npm view @xivdyetools/core versions

# Bump version again
npm version patch
```

---

## Rollback

If a bad version was published:

### Deprecate (Soft)

```bash
npm deprecate @xivdyetools/core@1.4.1 "Critical bug, use 1.4.2"
```

### Unpublish (Hard - Use Sparingly)

```bash
# Only within 72 hours of publish
npm unpublish @xivdyetools/core@1.4.1
```

**Note**: npm has strict unpublish rules. Prefer deprecation.

---

## Automated CI/CD (Future)

Planned GitHub Actions workflow:

```yaml
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Related Documentation

- [Overview](overview.md) - Library introduction
- [Versions](../../versions.md) - Version matrix
- [Release Process](../../developer-guides/release-process.md) - Full release workflow

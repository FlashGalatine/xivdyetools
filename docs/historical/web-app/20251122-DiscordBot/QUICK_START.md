# Quick Start: npm Package Architecture

**XIV Dye Tools** - Three Repositories, One Shared Library

**Last Updated**: November 22, 2025

---

## Architecture Overview

```
📦 @xivdyetools/core          # npm package (NEW REPO)
   ├── ColorService             # Pure color algorithms
   ├── DyeService               # Dye matching & harmonies
   └── Dye Database             # 125+ FFXIV dyes
         ↓ Published to npm/GitHub Packages
         ↓
   ┌─────────────────┬──────────────────────┐
   ↓                 ↓                      ↓
📂 xivdyetools    📂 discord-bot          📂 future projects
 (web app)         (Discord bot)           (Dalamud, API, etc.)
 Cloudflare Pages   Fly.io
```

---

## Three Repositories

| Repository | Purpose | Hosting | Status |
|------------|---------|---------|--------|
| **xivdyetools** | Web application | Cloudflare Pages | ✅ Existing |
| **xivdyetools-core** | Shared npm package | npm / GitHub Packages | 🔨 Create first |
| **xivdyetools-discord-bot** | Discord bot | Fly.io | 🔨 Create second |

---

## Implementation Order

### Step 1: Create Core Package (Week 1)

**Repository**: `xivdyetools-core`

```bash
# 1. Create new repo
mkdir xivdyetools-core
cd xivdyetools-core
git init

# 2. Initialize npm package
npm init --scope=@xivdyetools

# 3. Extract services from web app
# See: PACKAGE_GUIDE.md

# 4. Publish to npm
npm publish --access public
```

**Result**: `@xivdyetools/core@1.0.0` published to npm

**Documentation**: [PACKAGE_GUIDE.md](./PACKAGE_GUIDE.md)

---

### Step 2: Update Web App (Week 1)

**Repository**: `xivdyetools` (existing)

```bash
cd xivdyetools

# Install core package
npm install @xivdyetools/core

# Update imports
# Before: import { ColorService } from './services/color-service';
# After:  import { ColorService, dyeDatabase } from '@xivdyetools/core';

# Delete old files
rm -rf src/services/color-service.ts
rm -rf src/services/dye-service.ts
```

**Result**: Web app now uses shared package

---

### Step 3: Create Discord Bot (Weeks 2-6)

**Repository**: `xivdyetools-discord-bot` (new)

```bash
# 1. Create new repo
mkdir xivdyetools-discord-bot
cd xivdyetools-discord-bot
git init

# 2. Install dependencies
npm init -y
npm install @xivdyetools/core discord.js sharp canvas ioredis

# 3. Create bot structure
# See: ARCHITECTURE.md

# 4. Deploy to Fly.io
fly launch
fly deploy
```

**Result**: Discord bot deployed and running

**Documentation**: [ARCHITECTURE.md](./ARCHITECTURE.md), [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Key Files

### Core Package

**`@xivdyetools/core`** - Published npm package

```typescript
// package.json
{
  "name": "@xivdyetools/core",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}

// src/index.ts - Public API
export { ColorService } from './services/ColorService';
export { DyeService } from './services/DyeService';
export { default as dyeDatabase } from './data/colors_xiv.json';
```

### Web App

**`xivdyetools`** - Consumes core package

```typescript
// package.json
{
  "dependencies": {
    "@xivdyetools/core": "^1.0.0"
  }
}

// src/components/harmony-generator-tool.ts
import { ColorService, DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase); // Browser: inject data
const harmony = ColorService.generateHarmony('#3B82F6', 'complementary');
```

### Discord Bot

**`xivdyetools-discord-bot`** - Consumes core package

```typescript
// package.json
{
  "dependencies": {
    "@xivdyetools/core": "^1.0.0",
    "discord.js": "^14.14.1"
  }
}

// src/commands/harmony.ts
import { ColorService, DyeService } from '@xivdyetools/core';

const dyeService = new DyeService(); // Node.js: auto-loads data
const harmony = ColorService.generateHarmony('#3B82F6', 'complementary');
```

---

## Updating the Shared Package

When you update color algorithms:

```bash
# 1. Make changes in core package
cd xivdyetools-core
# Edit src/services/ColorService.ts

# 2. Bump version
npm version patch  # 1.0.0 → 1.0.1

# 3. Publish
npm publish

# 4. Update web app
cd ../xivdyetools
npm update @xivdyetools/core

# 5. Update Discord bot
cd ../xivdyetools-discord-bot
npm update @xivdyetools/core
```

---

## Future Projects

All of these can consume `@xivdyetools/core`:

### Dalamud Plugin (C#)

```csharp
// Option 1: Use via JavaScript interop
using Microsoft.ClearScript.V8;
var engine = new V8ScriptEngine();
engine.Execute("const { DyeService } = require('@xivdyetools/core')");

// Option 2: Port to C# (recommended)
public class DyeService {
    // Same algorithms, C# syntax
}
```

### REST API

```typescript
// server.ts
import express from 'express';
import { ColorService, DyeService } from '@xivdyetools/core';

app.get('/api/match/:color', (req, res) => {
  const dyeService = new DyeService();
  res.json(dyeService.findClosestDyes(req.params.color, 5));
});
```

### CLI Tool

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { DyeService } from '@xivdyetools/core';

program
  .command('match <color>')
  .action((color) => {
    const dyeService = new DyeService();
    console.table(dyeService.findClosestDyes(color, 5));
  });
```

---

## Benefits of This Architecture

### ✅ Single Source of Truth
- Update color algorithms in one place
- Web app and Discord bot always in sync
- No code duplication

### ✅ Maximum Flexibility
- Easy to add new projects (Dalamud, API, mobile app)
- Each project can use its own framework
- Core package is framework-agnostic

### ✅ Community Sharing
- Others can use your color algorithms
- Published on npm for easy discovery
- Contribut

ions benefit all projects

### ✅ Independent Deployment
- Web app deploys to Cloudflare Pages
- Discord bot deploys to Fly.io
- Each can update independently

---

## Common Questions

### Q: Do I need to update all projects when core package changes?

**A**: Only if you want to. Semantic versioning lets you control updates:
- `"^1.0.0"` - Auto-update patches (1.0.1, 1.0.2)
- `"~1.0.0"` - Lock to 1.0.x
- `"1.0.0"` - Exact version lock

### Q: How do I keep projects in sync?

**A**: Use Renovate Bot or Dependabot to auto-create PRs when core package updates.

### Q: Can I keep core package private?

**A**: Yes! Publish to GitHub Packages instead of npm:
```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### Q: What if I want to test core changes before publishing?

**A**: Use npm link:
```bash
cd xivdyetools-core
npm link

cd ../xivdyetools-discord-bot
npm link @xivdyetools/core

# Test changes, then:
npm unlink @xivdyetools/core
npm install @xivdyetools/core
```

---

## Next Steps

1. **Read PACKAGE_GUIDE.md** - Learn how to create the core package
2. **Read ARCHITECTURE.md** - Understand the Discord bot architecture
3. **Read DEPLOYMENT.md** - Learn how to deploy to Fly.io

**Ready to start?** Begin with creating the core package!

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team

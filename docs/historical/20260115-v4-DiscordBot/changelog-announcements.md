# Changelog Announcements Feature

**Automatic Discord announcements when `CHANGELOG-laymans.md` is updated**

---

## Overview

When a push is made to any `xivdyetools-*` repository and the `CHANGELOG-laymans.md` file has been modified, the discord-worker should automatically post an announcement to a designated Discord channel.

### Goals

| Goal | Description |
|------|-------------|
| **User Awareness** | Keep Discord community informed of updates in friendly, non-technical language |
| **Automatic** | No manual intervention required after setup |
| **Filtered** | Only triggers on `CHANGELOG-laymans.md` changes, not every push |
| **Multi-project** | Works across all xivdyetools-* repositories |

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Channel strategy** | Single channel for all projects | Keeps community engagement in one place; easier to manage |
| **Role pings** | Optional (configurable) | Users can opt-in to notifications without forcing pings |
| **Authentication** | Raw GitHub URLs (no token) | All repos are currently public; token can be added later if needed |

---

## Architecture

### Event Flow

```
GitHub Push Event
       │
       ▼
GitHub Webhook ─────────► Discord Worker
(POST /webhooks/github)    │
                           ▼
                    Validate Signature
                           │
                           ▼
                    Check: Was CHANGELOG-laymans.md modified?
                           │
              ┌────────────┴────────────┐
              │                         │
           No │                     Yes │
              ▼                         ▼
         Return 200              Fetch changelog content
         (no action)                    │
                                        ▼
                               Parse latest version entry
                                        │
                                        ▼
                               Format Discord embed
                                        │
                                        ▼
                               POST to announcement channel

```

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| GitHub Webhook Route | `src/routes/webhooks.ts` | Handle incoming GitHub push events |
| Changelog Parser | `src/services/changelog-parser.ts` | Extract latest entry from markdown |
| Announcement Service | `src/services/announcements.ts` | Send embeds to Discord channel |

---

## GitHub Webhook Setup

### Webhook Configuration

For each `xivdyetools-*` repository, configure a webhook:

| Setting | Value |
|---------|-------|
| **Payload URL** | `https://discord-worker.xivdyetools.com/webhooks/github` |
| **Content type** | `application/json` |
| **Secret** | Shared `GITHUB_WEBHOOK_SECRET` environment variable |
| **Events** | "Just the push event" |
| **Active** | ✅ |

### Signature Verification

GitHub signs webhook payloads with HMAC-SHA256. The worker must verify the `X-Hub-Signature-256` header.

```typescript
// src/utils/github-verify.ts
import { timingSafeEqual } from 'crypto';

export async function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await computeHmacSha256(payload, secret);
  const expected = `sha256=${expectedSignature}`;

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;

  const sigBuffer = new TextEncoder().encode(signature);
  const expBuffer = new TextEncoder().encode(expected);

  return timingSafeEqual(sigBuffer, expBuffer);
}

async function computeHmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

---

## Webhook Handler

### Route Definition

```typescript
// src/routes/webhooks.ts
import { Hono } from 'hono';
import { verifyGitHubSignature } from '../utils/github-verify';
import { parseChangelog, formatAnnouncementEmbed } from '../services/changelog';
import { sendChannelMessage } from '../services/discord-api';

const webhooks = new Hono<{ Bindings: Env }>();

webhooks.post('/github', async (c) => {
  const signature = c.req.header('X-Hub-Signature-256');
  const event = c.req.header('X-GitHub-Event');

  if (!signature || event !== 'push') {
    return c.json({ message: 'Ignored' }, 200);
  }

  const body = await c.req.text();
  const isValid = await verifyGitHubSignature(body, signature, c.env.GITHUB_WEBHOOK_SECRET);

  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const payload: GitHubPushPayload = JSON.parse(body);

  // Only process pushes to main/master branch
  if (!payload.ref.endsWith('/main') && !payload.ref.endsWith('/master')) {
    return c.json({ message: 'Non-default branch, ignored' }, 200);
  }

  // Check if CHANGELOG-laymans.md was modified
  const changelogModified = payload.commits.some(commit =>
    commit.added.includes('CHANGELOG-laymans.md') ||
    commit.modified.includes('CHANGELOG-laymans.md')
  );

  if (!changelogModified) {
    return c.json({ message: 'No changelog changes' }, 200);
  }

  // Process in background to respond quickly
  c.executionCtx.waitUntil(
    processChangelogAnnouncement(c.env, payload)
  );

  return c.json({ message: 'Processing announcement' }, 202);
});

export { webhooks };
```

### Push Payload Types

```typescript
// src/types/github.ts
export interface GitHubPushPayload {
  ref: string;                    // "refs/heads/main"
  before: string;                 // Previous commit SHA
  after: string;                  // New commit SHA
  repository: {
    name: string;                 // "xivdyetools-web-app"
    full_name: string;            // "owner/xivdyetools-web-app"
    html_url: string;             // "https://github.com/..."
    default_branch: string;       // "main"
  };
  commits: GitHubCommit[];
  head_commit: GitHubCommit;
  pusher: {
    name: string;
    email: string;
  };
}

export interface GitHubCommit {
  id: string;                     // SHA
  message: string;
  timestamp: string;
  added: string[];                // New files
  removed: string[];              // Deleted files
  modified: string[];             // Changed files
}
```

---

## Changelog Parser

### Parsing Strategy

The `CHANGELOG-laymans.md` follows a consistent format:

```markdown
# What's New in Version X.Y.Z

*Released: Month Day, Year*

---

## Section Heading

Content...

---

*For the full technical changelog, see [CHANGELOG.md](./CHANGELOG.md)*
```

The parser extracts:
1. **Version** from the `# What's New in Version X.Y.Z` heading
2. **Release date** from the `*Released: ...*` line
3. **Summary sections** (first 1-2 `## Section Heading` blocks)
4. **First ~500 characters** for the announcement preview

```typescript
// src/services/changelog-parser.ts

export interface ParsedChangelog {
  version: string;
  releaseDate: string;
  title: string;
  sections: ChangelogSection[];
  fullText: string;
}

export interface ChangelogSection {
  heading: string;
  content: string;
}

export function parseChangelog(markdown: string): ParsedChangelog | null {
  // Match: # What's New in Version X.Y.Z
  const versionMatch = markdown.match(/^#\s+What's New in Version\s+([\d.]+)/m);
  if (!versionMatch) return null;

  const version = versionMatch[1];

  // Match: *Released: January 21, 2026*
  const dateMatch = markdown.match(/^\*Released:\s+(.+?)\*$/m);
  const releaseDate = dateMatch?.[1] ?? 'Unknown';

  // Extract sections (## headings)
  const sectionRegex = /^##\s+(.+?)$([\s\S]*?)(?=^##|\*For the full technical|$)/gm;
  const sections: ChangelogSection[] = [];
  let match;

  while ((match = sectionRegex.exec(markdown)) !== null) {
    sections.push({
      heading: match[1].trim(),
      content: match[2].trim()
    });
  }

  return {
    version,
    releaseDate,
    title: `What's New in Version ${version}`,
    sections,
    fullText: markdown
  };
}
```

---

## Announcement Embed Format

### Design Goals

| Goal | Implementation |
|------|----------------|
| **At-a-glance** | Clear version number and date in title |
| **Scannable** | Key changes as bullet points, not full text |
| **Actionable** | Link to full changelog on GitHub/website |
| **Branded** | Consistent color and formatting |

### Embed Structure

```typescript
// src/services/announcements.ts
import { ParsedChangelog } from './changelog-parser';

const BRAND_COLOR = 0x5865F2; // Discord blurple, or use XIV-themed color

export function formatAnnouncementEmbed(
  changelog: ParsedChangelog,
  repoName: string,
  repoUrl: string
): DiscordEmbed {
  // Create summary from first section
  const summary = changelog.sections.length > 0
    ? truncateWithEllipsis(changelog.sections[0].content, 300)
    : 'See full changelog for details.';

  // Build bullet points from section headings
  const sectionList = changelog.sections
    .slice(0, 4)
    .map(s => `• ${s.heading}`)
    .join('\n');

  return {
    title: `${getProjectEmoji(repoName)} ${getProjectName(repoName)} — v${changelog.version}`,
    description: summary,
    color: BRAND_COLOR,
    fields: [
      {
        name: 'What Changed',
        value: sectionList || 'Various improvements',
        inline: false
      }
    ],
    footer: {
      text: `Released ${changelog.releaseDate}`
    },
    timestamp: new Date().toISOString(),
    url: `${repoUrl}/blob/main/CHANGELOG-laymans.md`
  };
}

function getProjectName(repoName: string): string {
  const names: Record<string, string> = {
    'xivdyetools-web-app': 'XIV Dye Tools Web App',
    'xivdyetools-discord-worker': 'Discord Bot',
    'xivdyetools-core': 'Core Library',
    'xivdyetools-presets-worker': 'Community Presets',
  };
  return names[repoName] ?? repoName;
}

function getProjectEmoji(repoName: string): string {
  const emojis: Record<string, string> = {
    'xivdyetools-web-app': '🌐',
    'xivdyetools-discord-worker': '🤖',
    'xivdyetools-core': '📦',
    'xivdyetools-presets-worker': '🎨',
  };
  return emojis[repoName] ?? '📝';
}

function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trim() + '…';
}
```

### Example Announcement

```
┌────────────────────────────────────────────────────────────┐
│ 🌐 XIV Dye Tools Web App — v4.1.1                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  We've made the mobile version of XIV Dye Tools much       │
│  easier to use! This update fixes several annoying issues  │
│  that made the app harder to use on phones and tablets.    │
│                                                            │
│  ── What Changed ──                                        │
│  • 🐛 Mobile Experience Improvements                       │
│                                                            │
│                                                            │
│  Released January 21, 2026                                 │
└────────────────────────────────────────────────────────────┘
```

---

## Fetching Changelog Content

### Option A: Fetch from GitHub Raw

Fetch the raw markdown directly from GitHub:

```typescript
async function fetchChangelogContent(
  repo: string,
  branch: string
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/CHANGELOG-laymans.md`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'XIV-Dye-Tools-Discord-Worker'
    }
  });

  if (!response.ok) {
    console.error(`Failed to fetch changelog: ${response.status}`);
    return null;
  }

  return response.text();
}
```

### Option B: Fetch from GitHub API

Use the GitHub API for better rate limiting and access control:

```typescript
async function fetchChangelogViaApi(
  repo: string,
  branch: string,
  token: string
): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo}/contents/CHANGELOG-laymans.md?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.raw',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'XIV-Dye-Tools-Discord-Worker'
    }
  });

  if (!response.ok) return null;
  return response.text();
}
```

**Recommendation:** Option A (raw URL) is simpler and doesn't require authentication for public repos.

---

## Environment Variables

New variables needed:

| Variable | Purpose | Example |
|----------|---------|---------|
| `GITHUB_WEBHOOK_SECRET` | Verify webhook signatures | `your-webhook-secret` |
| `ANNOUNCEMENT_CHANNEL_ID` | Discord channel to post to | `123456789012345678` |
| `ANNOUNCEMENT_ROLE_ID` | (Optional) Role to ping for updates | `123456789012345678` |
| `GITHUB_TOKEN` | (Optional) For private repos or higher rate limits | `ghp_xxxx` |

---

## Optional Role Ping

Users can opt-in to receive notifications by assigning themselves a role (e.g., "Update Notifications"). When configured, announcements will mention this role.

### Discord Server Setup

1. Create a role (e.g., `@Update Notifications`)
2. Make it self-assignable via reaction roles or Discord's role picker
3. Add the role ID to `ANNOUNCEMENT_ROLE_ID` environment variable

### Implementation

The role ping is prepended to the message content only if `ANNOUNCEMENT_ROLE_ID` is set:

```typescript
function buildAnnouncementContent(env: Env): string {
  const base = '📢 **New Update Released!**';

  if (env.ANNOUNCEMENT_ROLE_ID) {
    return `<@&${env.ANNOUNCEMENT_ROLE_ID}> ${base}`;
  }

  return base;
}
```

### Behavior

| `ANNOUNCEMENT_ROLE_ID` | Result |
|------------------------|--------|
| Not set / empty | `📢 **New Update Released!**` |
| Set to role ID | `@Update Notifications 📢 **New Update Released!**` |

This keeps the feature purely additive — if you don't configure a role, announcements work without pings.

---

## Processing Flow

```typescript
// src/services/announcements.ts

async function processChangelogAnnouncement(
  env: Env,
  payload: GitHubPushPayload
): Promise<void> {
  try {
    // 1. Fetch the changelog content
    const content = await fetchChangelogContent(
      payload.repository.full_name,
      payload.repository.default_branch
    );

    if (!content) {
      console.error('Failed to fetch changelog content');
      return;
    }

    // 2. Parse the changelog
    const parsed = parseChangelog(content);

    if (!parsed) {
      console.error('Failed to parse changelog');
      return;
    }

    // 3. Check for duplicate (avoid re-announcing same version)
    const cacheKey = `changelog:${payload.repository.name}:${parsed.version}`;
    const alreadyAnnounced = await env.KV.get(cacheKey);

    if (alreadyAnnounced) {
      console.log(`Version ${parsed.version} already announced, skipping`);
      return;
    }

    // 4. Format and send the announcement
    const embed = formatAnnouncementEmbed(
      parsed,
      payload.repository.name,
      payload.repository.html_url
    );

    await sendChannelMessage(
      env.ANNOUNCEMENT_CHANNEL_ID,
      env.DISCORD_BOT_TOKEN,
      {
        content: buildAnnouncementContent(env),
        embeds: [embed]
      }
    );

    // 5. Mark as announced (TTL: 30 days)
    await env.KV.put(cacheKey, 'true', { expirationTtl: 60 * 60 * 24 * 30 });

    console.log(`Announced ${payload.repository.name} v${parsed.version}`);

  } catch (error) {
    console.error('Failed to process changelog announcement:', error);
  }
}
```

---

## Duplicate Prevention

The KV cache prevents re-announcing the same version if:
- The webhook fires multiple times for the same push
- A `CHANGELOG-laymans.md` file is updated without changing the version number
- Multiple commits in quick succession touch the changelog

**Cache Key Format:** `changelog:{repo-name}:{version}`

**TTL:** 30 days (allows re-announcement if version is somehow reused after a month)

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid signature | Return 401, log attempt |
| Non-push event | Return 200, ignore |
| Non-default branch | Return 200, ignore |
| No changelog changes | Return 200, ignore |
| Failed to fetch content | Log error, return 202 (webhook succeeded) |
| Failed to parse | Log error, skip announcement |
| Discord API error | Log error, don't cache (allow retry) |

---

## Testing Considerations

### Manual Testing

1. Create a test webhook delivery in GitHub (Settings → Webhooks → Redeliver)
2. Use ngrok or similar for local development
3. Verify signature validation with intentionally wrong secrets

### Automated Testing

```typescript
// tests/changelog-parser.test.ts
describe('parseChangelog', () => {
  it('extracts version from standard heading', () => {
    const md = `# What's New in Version 4.1.1\n\n*Released: January 21, 2026*`;
    const result = parseChangelog(md);
    expect(result?.version).toBe('4.1.1');
  });

  it('extracts sections', () => {
    const md = `# What's New in Version 1.0.0

*Released: January 1, 2026*

## Bug Fixes

Fixed the thing.

## New Features

Added the stuff.
`;
    const result = parseChangelog(md);
    expect(result?.sections).toHaveLength(2);
    expect(result?.sections[0].heading).toBe('Bug Fixes');
  });

  it('returns null for invalid format', () => {
    const md = `# Random Header\n\nSome content`;
    const result = parseChangelog(md);
    expect(result).toBeNull();
  });
});
```

---

## Future Enhancements

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| **Preview images** | Generate OG-style preview images with the version | Low |
| **Diff summary** | Include "X bugs fixed, Y features added" metrics | Low |
| **Release notes link** | Link to a dedicated releases page instead of raw file | Low |
| **Private repo support** | Add `GITHUB_TOKEN` for authenticated requests if any repo becomes private | As needed |

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/routes/webhooks.ts` | GitHub webhook handler |
| `src/utils/github-verify.ts` | HMAC-SHA256 signature verification |
| `src/services/changelog-parser.ts` | Parse CHANGELOG-laymans.md |
| `src/services/announcements.ts` | Format and send announcements |
| `src/types/github.ts` | GitHub webhook payload types |

### Modified Files

| File | Change |
|------|--------|
| `src/index.ts` | Import and mount webhooks router |
| `src/types/env.ts` | Add new environment variables |
| `wrangler.toml` | Add new secrets |

---

## Related Documents

- [V4 Parity Update](v4-parity-update.md) - Discord bot command reference
- [Discord Worker Analysis](../../historical/20251207-DeepDive/discord-worker-analysis.md) - Architecture details

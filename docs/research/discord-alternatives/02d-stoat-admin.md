# Stoat Bot — Stats & Admin Commands

**Parent document:** [02-stoat.md](./02-stoat.md)

---

### Stats & Admin Commands

The Discord worker has a `/stats` command with 5 subcommands — 1 public, 4 admin-only. On Stoat, these become `!xivdye stats` subcommands, powered by the SQLite `command_stats` table instead of KV counters + Analytics Engine.

#### Discord → Stoat Command Mapping

| Discord `/stats` subcommand | Stoat equivalent | Access | Change notes |
|---|---|---|---|
| `summary` (public) | `!xd stats` (no subcommand) | Anyone | Same info — total commands, success rate, features, links |
| `overview` (admin) | `!xd stats overview` | Admin | **Enhanced** — SQL enables time-series, per-guild, trend comparisons |
| `commands` (admin) | `!xd stats commands` | Admin | Same rankings — SQL `GROUP BY` replaces KV list scan |
| `preferences` (admin) | `!xd stats prefs` | Admin | **Simplified** — SQL `COUNT` replaces 100-user KV sample |
| `health` (admin) | `!xd stats health` | Admin | Different checks — SQLite, WebSocket, Upstash, Universalis |

#### Authorization Model

The Discord worker checks `STATS_AUTHORIZED_USERS` (comma-separated snowflake IDs in env). On Stoat, the same pattern applies but uses Stoat user IDs (26-char ULID format, e.g., `01GPXD...`).

```typescript
// config/admin.ts
interface AdminConfig {
  /** Stoat user IDs authorized for admin stats */
  authorizedUsers: string[];
  /** Stoat user IDs authorized for preset moderation (separate concern) */
  moderatorUsers: string[];
}

function loadAdminConfig(): AdminConfig {
  const authorized = process.env.STATS_AUTHORIZED_USERS?.split(',').map(id => id.trim()) ?? [];
  const moderators = process.env.MODERATOR_IDS?.split(',').map(id => id.trim()) ?? [];
  return { authorizedUsers: authorized, moderatorUsers: moderators };
}

function isAuthorized(userId: string): boolean {
  return adminConfig.authorizedUsers.includes(userId);
}
```

**Validation:** Stoat user IDs are ULIDs (26 alphanumeric chars). Validate at startup:
```typescript
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
// Stoat ULIDs use Crockford's Base32 — no I, L, O, U
```

**Key difference from Discord:** The env var values change (Discord snowflakes → Stoat ULIDs), but the mechanism is identical. A shared `isAuthorized()` check before routing to admin subcommands.

#### Public Subcommand: `!xd stats`

Shows basic bot info and aggregate stats. Non-admin, visible to everyone.

```typescript
async function handleStatsSummary(message: Message): Promise<void> {
  const stats = await getAggregateStats();

  await message.channel?.sendMessage({
    embeds: [{
      title: '📊 XIV Dye Tools Bot (Stoat)',
      description: 'An FFXIV dye matching and color analysis bot.',
      colour: '#5865F2',
    }],
    content: [
      '**🎨 Features**',
      '• Color matching & extraction',
      '• Dye blending (6 algorithms)',
      '• Character color matching',
      '• Color harmony generation',
      '• Accessibility analysis',
      '',
      '**📈 Stats**',
      `• **Commands Used:** ${stats.totalCommands.toLocaleString()}`,
      `• **Success Rate:** ${stats.successRate.toFixed(1)}%`,
      '',
      '**🔗 Links**',
      '[Web App](https://xivdyetools.com) • [Docs](https://docs.xivdyetools.com)',
    ].join('\n'),
  });
}
```

**Why `content` + `embeds` mixed:** Stoat embeds don't support `fields`, `footer`, or `author`. To approximate Discord's multi-field layout, use the embed for the title/color and `content` for the structured text body. This is the same pattern used across all other Stoat command responses.

#### Admin Subcommand: `!xd stats overview`

Volume metrics, unique users, success rates — all derived from the `command_stats` SQLite table.

```typescript
interface AggregateStats {
  totalCommands: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  uniqueUsersToday: number;
  uniqueUsersWeek: number;     // NEW: not possible with KV
  commandsToday: number;       // NEW: not possible with KV
  commandsYesterday: number;   // NEW: trend comparison
  topGuild: { id: string; count: number } | null;  // NEW: per-guild insight
}

function getAggregateStats(): AggregateStats {
  const db = getDatabase();

  const totals = db.prepare(`
    SELECT
      COUNT(*)                                          AS total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END)     AS successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)     AS failures
    FROM command_stats
  `).get() as { total: number; successes: number; failures: number };

  const uniqueToday = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS cnt
    FROM command_stats
    WHERE created_at >= date('now')
  `).get() as { cnt: number };

  const uniqueWeek = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS cnt
    FROM command_stats
    WHERE created_at >= date('now', '-7 days')
  `).get() as { cnt: number };

  const today = db.prepare(`
    SELECT COUNT(*) AS cnt FROM command_stats WHERE created_at >= date('now')
  `).get() as { cnt: number };

  const yesterday = db.prepare(`
    SELECT COUNT(*) AS cnt FROM command_stats
    WHERE created_at >= date('now', '-1 day') AND created_at < date('now')
  `).get() as { cnt: number };

  const topGuild = db.prepare(`
    SELECT guild_id, COUNT(*) AS cnt
    FROM command_stats
    WHERE guild_id IS NOT NULL
    GROUP BY guild_id ORDER BY cnt DESC LIMIT 1
  `).get() as { guild_id: string; cnt: number } | undefined;

  return {
    totalCommands: totals.total,
    successCount: totals.successes,
    failureCount: totals.failures,
    successRate: totals.total > 0 ? (totals.successes / totals.total) * 100 : 0,
    uniqueUsersToday: uniqueToday.cnt,
    uniqueUsersWeek: uniqueWeek.cnt,
    commandsToday: today.cnt,
    commandsYesterday: yesterday.cnt,
    topGuild: topGuild ? { id: topGuild.guild_id, count: topGuild.cnt } : null,
  };
}
```

**Why this is better than Discord's KV approach:**
- **Unique users per week** — impossible with KV (would require listing `usertrack:{date}:` for 7 dates)
- **Today vs yesterday trend** — impossible with flat counters (no historical breakdown)
- **Per-guild breakdown** — trivial SQL query vs. never tracked on Discord
- **Atomic, consistent** — `better-sqlite3` is synchronous; no optimistic concurrency issues
- **No TTL management** — data retention is a `DELETE` cron, not scattered per-key TTLs

**Response format (admin overview):**
```
📈 Usage Overview

📊 Volume
• Total Commands: 12,345
• Successful: 12,100
• Failed: 245

👥 Users
• Unique Today: 47
• Unique This Week: 312
• Avg Cmds/User: 5.2

📅 Trend
• Today: 230 commands
• Yesterday: 198 commands (+16.2%)

✅ Quality
• Success Rate: 98.02%
• Error Rate: 1.98%
```

#### Admin Subcommand: `!xd stats commands`

Per-command usage breakdown — ranked by count, with percentages.

```typescript
function getCommandBreakdown(): { command: string; count: number; percentage: number }[] {
  const db = getDatabase();

  const total = db.prepare('SELECT COUNT(*) AS cnt FROM command_stats').get() as { cnt: number };

  const rows = db.prepare(`
    SELECT command, COUNT(*) AS cnt
    FROM command_stats
    GROUP BY command
    ORDER BY cnt DESC
  `).all() as { command: string; cnt: number }[];

  return rows.map(row => ({
    command: row.command,
    count: row.cnt,
    percentage: total.cnt > 0 ? (row.cnt / total.cnt) * 100 : 0,
  }));
}
```

**Response format (top 10 + bottom 5):**
```
⭐ Command Usage Breakdown

🏆 Top 10 Commands
🥇 !xd info — 3,210 (26.0%)
🥈 !xd match — 2,150 (17.4%)
🥉 !xd harmony — 1,840 (14.9%)
4. !xd extract — 1,200 (9.7%)
5. !xd blend — 980 (7.9%)
...

📉 Least Used
• !xd about — 12
• !xd random — 28
• !xd a11y — 35

📊 Total unique commands: 14
```

**No V4/legacy split needed:** The Discord worker tracks V4 vs legacy command migration because it supports both APIs during transition. The Stoat bot starts fresh — all commands are "V1" of the Stoat bot. Drop this distinction entirely.

#### Admin Subcommand: `!xd stats prefs`

Preference adoption rates — SQL replaces the Discord worker's sample-100-users-from-KV approach.

```typescript
function getPreferenceStats(): Record<string, { set: number; total: number; rate: number }> {
  const db = getDatabase();

  const total = db.prepare('SELECT COUNT(*) AS cnt FROM preferences').get() as { cnt: number };

  // Each preference column — count non-null values
  const columns = ['language', 'blending', 'matching', 'clan', 'gender', 'world', 'market'] as const;
  const result: Record<string, { set: number; total: number; rate: number }> = {};

  for (const col of columns) {
    const row = db.prepare(
      `SELECT COUNT(*) AS cnt FROM preferences WHERE ${col} IS NOT NULL`
    ).get() as { cnt: number };
    result[col] = {
      set: row.cnt,
      total: total.cnt,
      rate: total.cnt > 0 ? (row.cnt / total.cnt) * 100 : 0,
    };
  }

  return result;
}
```

**Key improvement:** The Discord worker reads up to 100 individual KV values to estimate adoption rates (expensive, sampled). The Stoat bot does `SELECT COUNT(*) FROM preferences WHERE column IS NOT NULL` — exact counts, single query per column, all 7 columns in <1ms on SQLite.

**Response format:**
```
⚙️ Preference Adoption (312 users total)

🌐 Language Set: 45.2% (141)
🎨 Blending Mode: 23.1% (72)
🎯 Matching Method: 18.6% (58)
👤 Clan: 31.4% (98)
⚧ Gender: 29.5% (92)
🌍 World: 38.8% (121)
💰 Market Enabled: 15.1% (47)
```

#### Admin Subcommand: `!xd stats health`

System health probe — tests each infrastructure component and reports status.

```typescript
interface HealthReport {
  sqlite: { status: 'ok' | 'error'; latencyMs: number; rowCount?: number };
  websocket: { status: 'connected' | 'disconnected' | 'reconnecting'; uptime?: number };
  upstash: { status: 'ok' | 'slow' | 'error'; latencyMs: number };
  universalis: { status: 'ok' | 'error'; latencyMs: number };
  presetApi: { status: 'ok' | 'error' | 'not_configured'; latencyMs?: number };
  memory: { heapUsed: string; heapTotal: string; rss: string };
  process: { uptime: string; nodeVersion: string; pid: number };
}

async function getHealthReport(): Promise<HealthReport> {
  const db = getDatabase();

  // SQLite health — simple count query
  const sqliteStart = Date.now();
  let sqliteStatus: HealthReport['sqlite'];
  try {
    const row = db.prepare('SELECT COUNT(*) AS cnt FROM command_stats').get() as { cnt: number };
    sqliteStatus = { status: 'ok', latencyMs: Date.now() - sqliteStart, rowCount: row.cnt };
  } catch {
    sqliteStatus = { status: 'error', latencyMs: Date.now() - sqliteStart };
  }

  // WebSocket health — check revolt.js client state
  const wsStatus = client.websocket.connected
    ? 'connected'
    : client.websocket.ready ? 'reconnecting' : 'disconnected';

  // Upstash health — ping via HTTP
  const upstashStart = Date.now();
  let upstashStatus: HealthReport['upstash'];
  try {
    await redis.ping();
    const latency = Date.now() - upstashStart;
    upstashStatus = { status: latency > 500 ? 'slow' : 'ok', latencyMs: latency };
  } catch {
    upstashStatus = { status: 'error', latencyMs: Date.now() - upstashStart };
  }

  // Universalis health — lightweight request
  const uniStart = Date.now();
  let uniStatus: HealthReport['universalis'];
  try {
    const res = await fetch('https://universalis.app/api/v2/extra/stats/world-upload-counts');
    uniStatus = { status: res.ok ? 'ok' : 'error', latencyMs: Date.now() - uniStart };
  } catch {
    uniStatus = { status: 'error', latencyMs: Date.now() - uniStart };
  }

  // Memory usage
  const mem = process.memoryUsage();
  const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

  // Process uptime
  const uptimeSec = process.uptime();
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const mins = Math.floor((uptimeSec % 3600) / 60);

  return {
    sqlite: sqliteStatus,
    websocket: { status: wsStatus, uptime: uptimeSec },
    upstash: upstashStatus,
    universalis: uniStatus,
    presetApi: process.env.PRESETS_API_URL
      ? { status: 'ok', latencyMs: 0 }  // Could add actual ping
      : { status: 'not_configured' },
    memory: { heapUsed: formatMB(mem.heapUsed), heapTotal: formatMB(mem.heapTotal), rss: formatMB(mem.rss) },
    process: { uptime: `${days}d ${hours}h ${mins}m`, nodeVersion: process.version, pid: process.pid },
  };
}
```

**Response format:**
```
🏥 System Health

💾 SQLite: 🟢 OK (0.2ms, 12,345 rows)
🔌 WebSocket: 🟢 Connected (uptime: 3d 14h 22m)
⚡ Upstash Redis: 🟢 OK (12ms)
🌐 Universalis API: 🟢 OK (89ms)
📦 Preset API: 🟢 Configured

💻 Process
• Node.js: v22.14.0
• PID: 4821
• Heap: 45.2 / 128.0 MiB
• RSS: 89.7 MiB
```

**Compared to Discord's health check:**
| Check | Discord | Stoat |
|---|---|---|
| KV / SQLite latency | KV `get('health:check')` | `SELECT COUNT(*) FROM command_stats` |
| Connection status | N/A (stateless Worker) | WebSocket connected/disconnected/reconnecting |
| Analytics | `env.ANALYTICS` binding present | N/A (SQLite replaces Analytics Engine) |
| External services | Config check only (set/not set) | **Active ping** — Upstash, Universalis |
| Memory | N/A (Worker has no `process.memoryUsage()`) | Heap, RSS, total |
| Process uptime | N/A (Workers are ephemeral) | `process.uptime()` in days/hours/mins |

The Stoat health check is significantly more useful because a persistent process has meaningful state to report — connection status, memory usage, uptime. The Discord Worker's health check is mostly "is the config present?" since each request is stateless.

#### Admin Command: `!xd admin`

Separate from stats — operational admin commands that modify state or trigger actions.

| Command | Description | Notes |
|---|---|---|
| `!xd admin cleanup` | Delete stats older than N days | Default: 30 days. `DELETE FROM command_stats WHERE created_at < date('now', '-N days')` |
| `!xd admin reload-dyes` | Re-initialize DyeDatabase from core | Hot-reload after `@xivdyetools/core` update |
| `!xd admin cache-clear` | Clear in-memory LRU image cache | Useful after SVG template changes |
| `!xd admin cache-stats` | Show LRU cache hit/miss rates | `cache.size`, `cache.calculatedSize`, hit rate |
| `!xd admin db-size` | Report SQLite file size and table counts | `PRAGMA page_count`, `PRAGMA page_size` |
| `!xd admin masquerade-upload` | Run swatch avatar pre-upload script | Re-uploads ~140 dye swatches to Autumn CDN |
| `!xd admin shutdown` | Graceful shutdown | Close WebSocket, flush SQLite WAL, exit |

```typescript
async function handleAdminCommand(message: Message, args: string[]): Promise<void> {
  if (!isAuthorized(message.authorId)) {
    // Silently ignore — don't reveal admin commands exist
    return;
  }

  const subcommand = args[0];

  switch (subcommand) {
    case 'cleanup': {
      const days = parseInt(args[1] ?? '30', 10);
      if (days < 1 || days > 365) {
        await message.reply({ content: '⚠️ Days must be 1-365.' });
        return;
      }
      const db = getDatabase();
      const result = db.prepare(
        `DELETE FROM command_stats WHERE created_at < date('now', '-${days} days')`
      ).run();
      await message.reply({
        content: `🧹 Cleaned up **${result.changes}** stats rows older than ${days} days.`,
      });
      break;
    }

    case 'reload-dyes': {
      const { DyeDatabase } = await import('@xivdyetools/core');
      DyeDatabase.initialize();
      await message.reply({ content: '🔄 DyeDatabase reloaded.' });
      break;
    }

    case 'cache-clear': {
      imageCache.clear();
      await message.reply({ content: '🗑️ Image cache cleared.' });
      break;
    }

    case 'cache-stats': {
      const size = imageCache.size;
      const maxSize = imageCache.max;
      await message.reply({
        content: [
          '📊 **Image Cache Stats**',
          `• Entries: ${size} / ${maxSize}`,
          `• Calculated Size: ${(imageCache.calculatedSize / 1024 / 1024).toFixed(1)} MiB`,
        ].join('\n'),
      });
      break;
    }

    case 'db-size': {
      const db = getDatabase();
      const pageCount = db.pragma('page_count', { simple: true }) as number;
      const pageSize = db.pragma('page_size', { simple: true }) as number;
      const totalBytes = pageCount * pageSize;
      const tables = db.prepare(
        `SELECT name, (SELECT COUNT(*) FROM pragma_table_info(name)) AS cols
         FROM sqlite_master WHERE type='table' ORDER BY name`
      ).all() as { name: string; cols: number }[];
      const tableCounts = await Promise.all(
        tables.map(t => {
          const row = db.prepare(`SELECT COUNT(*) AS cnt FROM "${t.name}"`).get() as { cnt: number };
          return `• \`${t.name}\`: ${row.cnt.toLocaleString()} rows (${t.cols} cols)`;
        })
      );
      await message.reply({
        content: [
          '💾 **Database Info**',
          `• File size: ${(totalBytes / 1024).toFixed(1)} KiB`,
          `• Pages: ${pageCount} × ${pageSize} bytes`,
          '',
          '**Tables:**',
          ...tableCounts,
        ].join('\n'),
      });
      break;
    }

    case 'shutdown': {
      await message.reply({ content: '👋 Shutting down gracefully...' });
      // Close WebSocket, flush WAL, exit
      client.logout();
      const db = getDatabase();
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      process.exit(0);
      break;
    }

    default:
      await message.reply({
        content: `Unknown admin command: \`${subcommand}\`. Available: cleanup, reload-dyes, cache-clear, cache-stats, db-size, masquerade-upload, shutdown`,
      });
  }
}
```

**Design decisions:**

1. **Silent ignore for unauthorized users** — `!xd admin` commands don't reveal their existence to non-admins. Unlike `!xd stats` (which has a public subcommand), admin commands are fully invisible.

2. **`shutdown` is safe** — flushes SQLite WAL before exiting. On Fly.io, the process manager (systemd or Docker) restarts it automatically.

3. **`cleanup` has guardrails** — minimum 1 day, maximum 365 days. Default 30 days matches the Discord worker's 30-day TTL on KV counters.

4. **`reload-dyes` enables hot updates** — After publishing a new `@xivdyetools/core` version with new dye data, run this instead of redeploying the bot. The DyeDatabase singleton re-reads from the imported JSON.

#### Analytics Tracking (Data Collection)

Every command execution writes a row to `command_stats`. This is the Stoat equivalent of the Discord worker's dual KV + Analytics Engine tracking.

```typescript
// storage/analytics.ts
import { getDatabase } from './database.js';

const INSERT_STMT = `
  INSERT INTO command_stats (command, user_id, guild_id, success, error_type, latency_ms)
  VALUES (?, ?, ?, ?, ?, ?)
`;

/** Track a command execution — called after every command handler */
function trackCommand(params: {
  command: string;
  userId: string;
  guildId: string | null;
  success: boolean;
  errorType?: string;
  latencyMs?: number;
}): void {
  const db = getDatabase();
  db.prepare(INSERT_STMT).run(
    params.command,
    params.userId,
    params.guildId,
    params.success ? 1 : 0,
    params.errorType ?? null,
    params.latencyMs ?? null,
  );
}
```

**Integration point — command router:**
```typescript
// In the main command dispatcher
const startTime = Date.now();
let success = true;
let errorType: string | undefined;

try {
  await handler(message, args);
} catch (error) {
  success = false;
  errorType = error instanceof Error ? error.constructor.name : 'Unknown';
  // Send error response to user...
} finally {
  trackCommand({
    command: commandName,
    userId: message.authorId,
    guildId: message.channel?.serverId ?? null,
    success,
    errorType,
    latencyMs: Date.now() - startTime,
  });
}
```

**Key differences from Discord worker:**
| Aspect | Discord Worker | Stoat Bot |
|---|---|---|
| **Write mechanism** | `ctx.waitUntil()` (fire-and-forget) | Synchronous SQLite insert (blocking but <1ms) |
| **Concurrency** | Optimistic read-modify-write loop with retries | Atomic single INSERT, no contention |
| **Data model** | Separate counter keys (`stats:total`, `stats:cmd:X`) | Single table, aggregated via SQL `GROUP BY` |
| **User tracking** | Separate `usertrack:{date}:{userId}` marker keys | Derived: `SELECT COUNT(DISTINCT user_id)` |
| **Retention** | 30-day TTL per key (auto-expire) | Periodic `DELETE WHERE created_at < ...` cron |
| **Latency tracking** | Field exists but always 0 (never measured) | **Actually measured** via `Date.now()` delta |
| **Query capability** | Flat counters (total, success, failure, per-cmd) | Full SQL: time-series, per-guild, per-user, trends |

#### Data Retention

Daily cleanup via a scheduled function (Node.js `setInterval` or a cron-style library):

```typescript
// Run daily at 03:00 UTC
function cleanupOldStats(retentionDays = 30): void {
  const db = getDatabase();
  const result = db.prepare(
    `DELETE FROM command_stats WHERE created_at < date('now', '-' || ? || ' days')`
  ).run(retentionDays);
  logger.info(`Stats cleanup: deleted ${result.changes} rows older than ${retentionDays} days`);
}

// Schedule with setInterval (simple) or node-cron (precise)
setInterval(() => cleanupOldStats(), 24 * 60 * 60 * 1000);
```

Alternatively, use SQLite's `VACUUM` after large deletions to reclaim disk space:
```typescript
if (result.changes > 1000) {
  db.exec('VACUUM');
}
```

#### File Layout

```
src/
  commands/
    stats.ts            ← !xd stats [summary|overview|commands|prefs|health]
    admin.ts            ← !xd admin [cleanup|reload-dyes|cache-clear|...]
  storage/
    analytics.ts        ← trackCommand(), getAggregateStats(), getCommandBreakdown(), etc.
  config/
    admin.ts            ← isAuthorized(), isModerator(), ULID validation
```

---

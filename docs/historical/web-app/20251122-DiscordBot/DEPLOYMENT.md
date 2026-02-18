# Deployment Guide

**XIV Dye Tools Discord Bot** - Infrastructure & Hosting Setup

**Version**: 1.0.0
**Last Updated**: November 22, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Hosting Options](#hosting-options)
3. [Environment Configuration](#environment-configuration)
4. [Docker Setup](#docker-setup)
5. [Fly.io Deployment](#flyio-deployment)
6. [Railway Deployment](#railway-deployment)
7. [Heroku Deployment](#heroku-deployment)
8. [Self-Hosted (VPS)](#self-hosted-vps)
9. [Redis Setup](#redis-setup)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Monitoring & Logging](#monitoring--logging)
12. [Scaling Strategies](#scaling-strategies)

---

## Overview

The XIV Dye Tools Discord Bot requires:
- **Node.js** 18+ runtime
- **Redis** for caching Universalis API responses
- **Persistent storage** for user preferences (optional)
- **24/7 uptime** to respond to Discord commands

### Resource Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 512 MB | 1 GB |
| **Storage** | 100 MB | 500 MB |
| **Redis** | 64 MB | 128 MB |
| **Network** | 1 GB/month | 5 GB/month |

**Cost Estimate**: $5-15/month depending on platform

---

## Hosting Options

### Comparison Table

| Platform | Pros | Cons | Cost | Best For |
|----------|------|------|------|----------|
| **Fly.io** | Global edge deployment, Docker-native, free tier | Requires Docker knowledge | Free-$5/month | Experienced developers |
| **Railway** | Easy setup, Redis included, GitHub integration | Limited free tier | $5/month | Quick deployment |
| **Heroku** | Mature platform, add-ons ecosystem | More expensive | $7/month | Production apps |
| **DigitalOcean** | Full control, predictable pricing | Manual setup required | $6/month | Self-hosting |
| **AWS/GCP** | Enterprise features, scalability | Complex, expensive | $10+/month | Large-scale |

**Recommendation**: **Fly.io** if already familiar, **Railway** for beginners, **DigitalOcean** for advanced users

---

## Environment Configuration

### Required Environment Variables

**`.env`:**
```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here

# Redis Configuration
REDIS_URL=redis://localhost:6379
# or Railway format: redis://default:password@redis.railway.internal:6379

# Database (Optional - for user preferences)
DATABASE_URL=postgresql://user:password@localhost:5432/xivdyetools

# Bot Configuration
NODE_ENV=production
LOG_LEVEL=info
MAX_IMAGE_SIZE_MB=8
COMMAND_COOLDOWN_MS=3000

# Universalis API (no authentication required)
# Free tier: 25 req/s (50 req/s burst), 8 concurrent connections per IP
# Base URL is hardcoded: https://universalis.app/api/v2

# Feature Flags (Optional)
ENABLE_PRICING=true
ENABLE_IMAGE_MATCHING=true
ENABLE_ANALYTICS=false
```

### Getting Your Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application → Name it "XIV Dye Tools"
3. Go to **Bot** tab → Click "Add Bot"
4. Under **Token**, click "Reset Token" → Copy and save
5. Enable **Message Content Intent** (required for some features)
6. Under **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Attach Files`, `Embed Links`
7. Copy generated URL and invite bot to your server

### Validation Script

**`scripts/validate-env.ts`:**
```typescript
import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'REDIS_URL'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

---

## Docker Setup

### Dockerfile

**`Dockerfile`:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (canvas, sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Copy package files
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/discord-bot/package*.json ./packages/discord-bot/

# Install dependencies
RUN npm ci --workspaces

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build --workspaces

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for canvas
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

# Copy built files and node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/discord-bot/dist ./packages/discord-bot/dist
COPY --from=builder /app/packages/discord-bot/package.json ./packages/discord-bot/
COPY --from=builder /app/package.json ./

# Copy data files
COPY packages/core/src/data ./packages/core/src/data

# Set user to non-root
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start bot
CMD ["node", "packages/discord-bot/dist/bot.js"]
```

### Docker Compose (Local Development)

**`docker-compose.yml`:**
```yaml
version: '3.8'

services:
  bot:
    build: .
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

networks:
  app-network:
    driver: bridge

volumes:
  redis-data:
```

### Build & Run

```bash
# Build image
docker build -t xivdyetools-discord-bot .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f bot

# Stop
docker-compose down
```

---

## Railway Deployment

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your `xivdyetools-discord-bot` repository

### Step 2: Add Redis Service

1. In your project, click **New** → **Database** → **Add Redis**
2. Railway automatically sets `REDIS_URL` environment variable

### Step 3: Configure Environment Variables

1. Go to your bot service → **Variables**
2. Add:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `NODE_ENV=production`

### Step 4: Configure Build Settings

**`railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks",
    "buildCommand": "npm install && npm run build --workspaces"
  },
  "deploy": {
    "startCommand": "node packages/discord-bot/dist/bot.js",
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 3
  }
}
```

### Step 5: Deploy

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

**Cost**: ~$5/month (bot + Redis)

---

## Fly.io Deployment

**Recommended for**: Developers already familiar with Fly.io or Docker

### Why Fly.io?

✅ **Global deployment** - Deploy close to Discord's servers (lower latency)
✅ **Docker-native** - Full control over environment
✅ **Generous free tier** - 3 shared-cpu VMs + 3GB storage
✅ **Built-in Redis** - `fly-redis` add-on available
✅ **Firecracker microVMs** - Fast cold starts, persistent connections
✅ **No auto-sleep** - Bot stays running 24/7

### Prerequisites

```bash
# Install Fly CLI
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Verify installation
fly version

# Login to Fly.io
fly auth login
```

### Step 1: Create Dockerfile for Fly.io

**`Dockerfile`** (optimized for Fly.io):
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (canvas, sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

# Copy package files
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/discord-bot/package*.json ./packages/discord-bot/

# Install dependencies
RUN npm ci --workspaces

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build --workspaces

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for canvas
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    pixman

# Copy built files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/discord-bot/dist ./packages/discord-bot/dist
COPY --from=builder /app/packages/discord-bot/package.json ./packages/discord-bot/
COPY --from=builder /app/package.json ./

# Copy data files (dye database, etc.)
COPY packages/core/src/data ./packages/core/src/data

# Health check (Fly.io will use this)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose health check port
EXPOSE 8080

# Start bot
CMD ["node", "packages/discord-bot/dist/bot.js"]
```

### Step 2: Configure fly.toml

**`fly.toml`:**
```toml
app = "xivdyetools-discord-bot"  # Change to your app name
primary_region = "sjc"     # San Jose (close to Discord US servers)
                           # Other regions: iad (Virginia), lhr (London), nrt (Tokyo)

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  LOG_LEVEL = "info"
  MAX_IMAGE_SIZE_MB = "8"
  COMMAND_COOLDOWN_MS = "3000"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false  # Keep bot running 24/7 (critical!)
  auto_start_machines = true
  min_machines_running = 1    # Always keep 1 instance running

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20

  [[services.tcp_checks]]
    interval = "15s"
    timeout = "10s"
    grace_period = "30s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512  # Increase to 1024 if image rendering is slow
```

### Step 3: Create App

```bash
# Launch interactive setup
fly launch

# Follow prompts:
# - App name: xivdyetools-discord-bot
# - Region: sjc (or closest to Discord servers)
# - PostgreSQL: No (unless you want user preferences)
# - Redis: Yes (create Upstash Redis)
# - Deploy now: No (set secrets first)
```

This creates `fly.toml` automatically. You can customize it with the config above.

### Step 4: Set Up Redis

```bash
# Create Redis instance (Upstash Redis via Fly.io)
fly redis create

# Follow prompts:
# - Redis name: xivdyetools-redis
# - Region: same as bot (sjc)
# - Eviction policy: allkeys-lru (recommended)

# This outputs a connection string like:
# redis://default:password@fly-xivdyetools-redis.upstash.io

# The REDIS_URL secret is automatically set in your app
```

**Alternative**: Use external Redis (Upstash directly):
```bash
# If you want more control, sign up at upstash.com
# Get connection string and set manually:
fly secrets set REDIS_URL=redis://default:password@your-redis.upstash.io
```

### Step 5: Set Secrets

```bash
# Set Discord bot token
fly secrets set DISCORD_TOKEN=your_bot_token_here

# Set Discord client ID
fly secrets set DISCORD_CLIENT_ID=your_client_id

# Verify secrets are set
fly secrets list
```

### Step 6: Deploy

```bash
# Deploy to Fly.io
fly deploy

# Monitor deployment
fly logs

# Check status
fly status

# Open in browser (shows health check)
fly open
```

### Step 7: Verify Deployment

```bash
# View real-time logs
fly logs

# Check health status
fly checks list

# SSH into container (for debugging)
fly ssh console

# Inside container:
node -e "console.log(process.env.DISCORD_TOKEN ? 'Token set' : 'Token missing')"
```

### Common Fly.io Commands

```bash
# View logs (real-time)
fly logs

# View logs (last 100 lines)
fly logs --lines 100

# Scale memory
fly scale memory 1024  # Increase to 1GB RAM

# Scale CPU
fly scale vm shared-cpu-2x  # 2 CPUs

# Restart bot
fly apps restart

# SSH into running instance
fly ssh console

# View metrics
fly dashboard metrics

# Destroy app (careful!)
fly apps destroy xivdyetools-discord-bot
```

### Environment Variables on Fly.io

**Set via secrets** (recommended for sensitive data):
```bash
fly secrets set DISCORD_TOKEN=your_token
fly secrets set REDIS_URL=redis://...
```

**Set via fly.toml** (for non-sensitive config):
```toml
[env]
  NODE_ENV = "production"
  LOG_LEVEL = "info"
  MAX_IMAGE_SIZE_MB = "8"
```

### Automatic Deployments (GitHub Actions)

**`.github/workflows/deploy-fly.yml`:**
```yaml
name: Deploy to Fly.io

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy Discord Bot
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Fly.io CLI
        uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

**Get FLY_API_TOKEN**:
```bash
# Create deploy token
fly tokens create deploy -x 999999h

# Add to GitHub Secrets:
# Settings → Secrets → Actions → New repository secret
# Name: FLY_API_TOKEN
# Value: [paste token]
```

### Fly.io-Specific Features

#### Persistent Volumes (Optional)

If you want to cache rendered images between deployments:

```bash
# Create volume
fly volumes create xiv_cache --size 1  # 1GB

# Update fly.toml
[mounts]
  source = "xiv_cache"
  destination = "/app/cache"
```

#### Multi-Region Deployment

Deploy to multiple regions for global low latency:

```bash
# Scale to 3 regions
fly scale count 3 --region sjc,iad,lhr

# Traffic routes to nearest region automatically
```

#### Monitoring with Fly.io Dashboard

```bash
# Open dashboard
fly dashboard

# View metrics (CPU, RAM, requests)
fly dashboard metrics

# Set up alerts (via Fly.io web UI)
# Go to app → Monitoring → Create alert
```

### Troubleshooting Fly.io

#### Bot not starting

```bash
# Check logs
fly logs

# Common issues:
# - Missing secrets (DISCORD_TOKEN)
# - Redis not connected
# - auto_stop_machines = true (bot sleeps!)

# Fix auto_stop_machines
fly.toml:
  auto_stop_machines = false  # Must be false!
```

#### Out of memory

```bash
# Check memory usage
fly vm status

# Scale to 1GB RAM
fly scale memory 1024

# Or update fly.toml:
[[vm]]
  memory_mb = 1024
```

#### Redis connection errors

```bash
# Test Redis connection
fly redis connect

# Check REDIS_URL secret
fly secrets list

# Verify Redis is running
fly redis status
```

#### Canvas/Sharp errors

Make sure Dockerfile has all native dependencies:
```dockerfile
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg \
    pixman
```

### Cost Estimate (Fly.io)

**Free Tier** (generous limits):
- 3 shared-cpu-1x VMs (256 MB RAM each)
- 3 GB persistent storage
- 160 GB outbound data transfer

**This bot uses** (~1 VM):
- 1 shared-cpu-1x VM (512 MB RAM)
- Redis (Upstash free tier: 256 MB)
- Minimal storage (<100 MB)

**Expected Costs**:

| Scenario | Cost |
|----------|------|
| **Free tier** (light usage) | $0/month |
| **Exceeded free tier** (512 MB RAM) | ~$2-3/month |
| **With Redis** (Upstash paid tier) | ~$4-5/month |
| **Scaled** (1 GB RAM, 2 regions) | ~$8-10/month |

**Advantage**: Cheapest option if staying within free tier!

### Fly.io vs. Railway vs. Heroku

| Feature | Fly.io | Railway | Heroku |
|---------|--------|---------|--------|
| **Free tier** | ✅ Generous | ⚠️ $5 credit | ❌ None |
| **Redis included** | ✅ Via Upstash | ✅ Built-in | ⚠️ Paid add-on |
| **Docker support** | ✅ Native | ✅ Yes | ⚠️ Buildpacks |
| **Global deployment** | ✅ Multi-region | ❌ Single region | ⚠️ Limited |
| **Learning curve** | ⚠️ Medium | ✅ Easy | ✅ Easy |
| **Pricing** | ✅ Free-$5 | $5/month | $7/month |

**Best choice if**:
- ✅ Already using Fly.io for other projects
- ✅ Want global deployment (multi-region)
- ✅ Comfortable with Docker
- ✅ Want to minimize costs (free tier is generous)

**Cost**: Free tier / ~$2-5/month

---

## Heroku Deployment

### Step 1: Create Heroku App

```bash
# Install Heroku CLI
brew install heroku/brew/heroku  # macOS
# or: curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create xivdyetools-discord-bot

# Add Redis addon
heroku addons:create heroku-redis:mini
```

### Step 2: Configure Buildpacks

```bash
# Add Node.js buildpack
heroku buildpacks:add heroku/nodejs

# If using canvas, add:
heroku buildpacks:add --index 1 https://github.com/heroku/heroku-buildpack-apt
```

**`Aptfile`** (for canvas dependencies):
```
libcairo2-dev
libjpeg-dev
libpango1.0-dev
libgif-dev
```

### Step 3: Set Environment Variables

```bash
heroku config:set DISCORD_TOKEN=your_token_here
heroku config:set DISCORD_CLIENT_ID=your_client_id
heroku config:set NODE_ENV=production
```

### Step 4: Configure Procfile

**`Procfile`:**
```
worker: node packages/discord-bot/dist/bot.js
```

### Step 5: Deploy

```bash
git push heroku main

# Scale worker dyno
heroku ps:scale worker=1

# View logs
heroku logs --tail
```

**Cost**: ~$7/month (Eco dyno + Redis Mini)

---

## Self-Hosted (VPS)

### Recommended Providers

- **DigitalOcean Droplet** - $6/month (1GB RAM)
- **Linode** - $5/month (1GB RAM)
- **Vultr** - $6/month (1GB RAM)
- **Hetzner** - €4.5/month (2GB RAM, EU only)

### Step 1: Initial Server Setup

```bash
# SSH into server
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager)
npm install -g pm2

# Install Redis
apt install redis-server -y
systemctl enable redis-server
systemctl start redis-server
```

### Step 2: Deploy Application

```bash
# Create app directory
mkdir -p /opt/xivdyetools-bot
cd /opt/xivdyetools-bot

# Clone repository
git clone https://github.com/FlashGalatine/xivdyetools-discord-bot.git .

# Install dependencies
npm ci --workspaces

# Build
npm run build --workspaces

# Create .env file
nano .env
# (paste your environment variables)
```

### Step 3: PM2 Configuration

**`ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'xivdyetools-discord-bot',
    script: './packages/discord-bot/dist/bot.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

### Step 4: Start & Monitor

```bash
# Start bot
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Enable PM2 startup on boot
pm2 startup systemd

# Monitor
pm2 monit

# View logs
pm2 logs xivdyetools-discord-bot
```

### Step 5: Automatic Updates

**`update.sh`:**
```bash
#!/bin/bash

cd /opt/xivdyetools-discord-bot

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --workspaces

# Build
npm run build --workspaces

# Restart bot
pm2 restart xivdyetools-discord-bot

echo "✅ Bot updated and restarted"
```

```bash
chmod +x update.sh

# Schedule weekly updates (cron)
crontab -e
# Add: 0 3 * * 0 /opt/xivdyetools-discord-bot/update.sh
```

---

## Redis Setup

### Local Development (Docker)

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine redis-server --appendonly yes
```

### Production (Managed)

**Railway**: Automatic (included in project)

**Heroku**: `heroku addons:create heroku-redis:mini`

**DigitalOcean**: Managed Redis ($15/month) or self-hosted

### Redis Configuration

**`redis.conf`** (self-hosted):
```conf
# Basic settings
bind 127.0.0.1
port 6379
protected-mode yes

# Memory
maxmemory 128mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

appendonly yes
appendfilename "appendonly.aof"

# Security
requirepass your_secure_password_here
```

### Redis Monitoring

```bash
# Check memory usage
redis-cli info memory

# Monitor commands in real-time
redis-cli monitor

# Get cache hit rate
redis-cli info stats | grep keyspace
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**`.github/workflows/deploy.yml`:**
```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --workspaces

      - name: Run tests
        run: npm run test --workspaces

      - name: Build
        run: npm run build --workspaces

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway up --service discord-bot
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### Pre-Deployment Checklist

```bash
# Run all checks before deploying
npm run lint --workspaces
npm run test --workspaces
npm run build --workspaces

# Test bot locally
docker-compose up --build
```

---

## Monitoring & Logging

### Logging Setup

**`packages/discord-bot/src/utils/logger.ts`:**
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Health Check Endpoint

**`packages/discord-bot/src/health.ts`:**
```typescript
import express from 'express';
import { client } from './bot';
import { redis } from './utils/cache';

const app = express();

app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'OK',
    checks: {
      discord: client.isReady() ? 'UP' : 'DOWN',
      redis: 'DOWN'
    }
  };

  try {
    await redis.ping();
    health.checks.redis = 'UP';
  } catch (error) {
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.listen(3000, () => {
  console.log('Health check server running on port 3000');
});
```

### Monitoring with Grafana (Optional)

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

volumes:
  grafana-storage:
```

---

## Scaling Strategies

### Horizontal Scaling (Multiple Bot Instances)

**Discord bot sharding** is required for bots in 2,500+ servers:

```typescript
import { ShardingManager } from 'discord.js';

const manager = new ShardingManager('./dist/bot.js', {
  token: process.env.DISCORD_TOKEN!,
  totalShards: 'auto'
});

manager.on('shardCreate', shard => {
  console.log(`Launched shard ${shard.id}`);
});

manager.spawn();
```

### Redis Cluster (High Availability)

**When to use**: >10,000 requests/minute

**Setup**:
```bash
# Use managed Redis cluster (Railway, AWS ElastiCache, etc.)
# Or set up Redis Cluster manually
```

### Rate Limiting

```typescript
import { RateLimiter } from 'discord.js-rate-limiter';

const limiter = new RateLimiter(5, 60000); // 5 commands/minute

if (limiter.take(interaction.user.id)) {
  return interaction.reply({
    content: '⏱️ You are being rate limited.',
    ephemeral: true
  });
}
```

---

## Cost Breakdown

### Small Bot (<100 servers)

**Option 1: Fly.io (Cheapest)**
| Item | Provider | Cost |
|------|----------|------|
| Hosting | Fly.io (free tier) | $0-2/month |
| Redis | Upstash (free tier) | $0 |
| **Total** | | **$0-2/month** |

**Option 2: Railway (Easiest)**
| Item | Provider | Cost |
|------|----------|------|
| Hosting | Railway | $5/month |
| Redis | Railway (included) | $0 |
| **Total** | | **$5/month** |

### Medium Bot (100-1,000 servers)

| Item | Provider | Cost |
|------|----------|------|
| Hosting | DigitalOcean (2GB) | $12/month |
| Redis | Self-hosted | $0 |
| Domain (optional) | Namecheap | $1/month |
| **Total** | | **$13/month** |

### Large Bot (>1,000 servers)

| Item | Provider | Cost |
|------|----------|------|
| Hosting | AWS ECS (2 vCPU, 4GB) | $30/month |
| Redis | AWS ElastiCache | $15/month |
| Monitoring | Grafana Cloud | $0 (free tier) |
| **Total** | | **$45/month** |

---

## Next Steps

1. **Choose hosting platform** based on your needs & budget
2. **Set up environment variables** securely
3. **Deploy bot** following platform-specific guide
4. **Configure Redis** for caching
5. **Set up monitoring** to track uptime & errors
6. **Implement CI/CD** for automated deployments

---

## Troubleshooting

### Bot Not Starting

```bash
# Check logs
docker logs xivdyetools-discord-bot
# or
pm2 logs

# Common issues:
# - Missing DISCORD_TOKEN
# - Redis not reachable
# - Missing dependencies (canvas, sharp)
```

### High Memory Usage

```bash
# Restart bot
pm2 restart xivdyetools-discord-bot

# Increase memory limit in PM2
max_memory_restart: '1G'
```

### Redis Connection Errors

```bash
# Test Redis connection
redis-cli -u $REDIS_URL ping

# Check firewall rules
# Ensure port 6379 is open (if self-hosted)
```

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0

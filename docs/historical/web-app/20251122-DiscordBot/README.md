# XIV Dye Tools Discord Bot - Planning Documentation

**Version**: 1.0.0
**Status**: Planning Phase
**Last Updated**: November 22, 2025

---

## 📚 Documentation Index

This folder contains comprehensive planning documentation for building a Discord bot that replicates the functionality of the XIV Dye Tools web application.

### Quick Navigation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design, npm package architecture, technology stack | **Start here** - Overview of the entire system |
| **[PACKAGE_GUIDE.md](./PACKAGE_GUIDE.md)** | Creating and publishing the core npm package | Creating @xivdyetools/core |
| **[COMMANDS.md](./COMMANDS.md)** | Discord slash command specifications | Implementing command handlers |
| **[RENDERING.md](./RENDERING.md)** | Image generation algorithms (Canvas API) | Building visual outputs |
| **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** | Step-by-step service extraction from web app | Extracting reusable code |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Hosting, infrastructure, CI/CD (Fly.io recommended) | Deploying to production |
| **[API_REFERENCE.md](./API_REFERENCE.md)** | Complete API documentation for core package | Reference while coding |
| **[DATA_CENTERS.md](./DATA_CENTERS.md)** | Complete data center list & CJK character handling | Implementing Universalis API integration |

---

## 🎯 Project Overview

### Goal

Create a Discord bot that provides XIV Dye Tools functionality directly in Discord servers, allowing users to:
- Generate color harmonies
- Match colors to FFXIV dyes
- Check accessibility (colorblind simulation)
- Compare dyes side-by-side
- Find intermediate dyes for gradients

### Architecture Highlights

- **npm Package Architecture**: `@xivdyetools/core` (shared library) consumed by web app + Discord bot + future projects
- **Code Reuse**: ~80% of web app business logic reused via published npm package
- **Technology Stack**: TypeScript, discord.js, node-canvas, Sharp, Redis
- **Hosting Options**: Fly.io (free-$5/month), Railway ($5/month), or self-hosted

---

## 🚀 Quick Start Guide

### 1. Read the Architecture (5-10 minutes)

Start with **[ARCHITECTURE.md](./ARCHITECTURE.md)** to understand:
- Overall system design
- How services are organized
- Why we can reuse so much code from the web app
- Technology choices and trade-offs

### 2. Review Command Specifications (10-15 minutes)

Read **[COMMANDS.md](./COMMANDS.md)** to see:
- All 6 slash commands (`/harmony`, `/match`, `/accessibility`, etc.)
- Parameter schemas and validation rules
- Example responses and error handling
- Rate limiting strategies

### 3. Understand Service Migration (15-20 minutes)

Study **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** for:
- Step-by-step instructions to extract ColorService (100% reusable)
- How to adapt DyeService (95% reusable, minor changes)
- Refactoring APIService for Node.js (60% reusable)
- Testing strategy to ensure parity with web app

### 4. Learn Image Rendering (10-15 minutes)

Read **[RENDERING.md](./RENDERING.md)** for:
- Canvas-based color wheel generation
- Gradient rendering algorithms
- Colorblind simulation swatch grids
- Performance optimization techniques

### 5. Plan Deployment (15-20 minutes)

Review **[DEPLOYMENT.md](./DEPLOYMENT.md)** to choose:
- Hosting platform (Railway vs. DigitalOcean vs. Heroku)
- Docker setup or PM2 process management
- Redis caching configuration
- CI/CD pipeline with GitHub Actions

### 6. Reference API Documentation (As Needed)

Use **[API_REFERENCE.md](./API_REFERENCE.md)** while coding:
- ColorService: 20+ color conversion and manipulation methods
- DyeService: 15+ harmony generation and matching algorithms
- Complete TypeScript type definitions
- Usage examples for common tasks

**Total Reading Time**: ~60-80 minutes for comprehensive understanding

---

## 📊 Implementation Roadmap

### Phase 1: Core Package Setup (Week 1)

- [ ] Create new repository `xivdyetools-core`
- [ ] Extract ColorService from web app (100% reusable as-is)
- [ ] Migrate DyeService (remove singleton, make environment-agnostic)
- [ ] Copy types, constants, and dye database
- [ ] Write unit tests to ensure parity with web app
- [ ] Publish to npm or GitHub Packages

**References**: [PACKAGE_GUIDE.md](./PACKAGE_GUIDE.md), [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

### Phase 2: Discord Bot Foundation (Week 2)

- [ ] Create new repository `xivdyetools-discord-bot`
- [ ] Install `@xivdyetools/core` package
- [ ] Set up Discord.js bot with slash commands
- [ ] Implement command registration system
- [ ] Create embed builder utilities
- [ ] Set up Redis caching layer
- [ ] Implement rate limiting
- [ ] Add error handling and logging

**References**: [ARCHITECTURE.md](./ARCHITECTURE.md), [COMMANDS.md](./COMMANDS.md)

### Phase 3: Command Implementations (Week 3-4)

- [ ] `/harmony` - Color harmony generation + color wheel rendering
- [ ] `/match` - Color matching (hex/name input)
- [ ] `/match_image` - Image upload color extraction (Sharp)
- [ ] `/accessibility` - Colorblind simulation + swatch grid
- [ ] `/comparison` - Dye comparison table + chart
- [ ] `/mixer` - Color interpolation + gradient rendering

**References**: [COMMANDS.md](./COMMANDS.md), [RENDERING.md](./RENDERING.md)

### Phase 4: Image Rendering (Week 4-5)

- [ ] ColorWheelRenderer - 400×400px wheel with harmony indicators
- [ ] GradientRenderer - 600×100px gradient line
- [ ] SwatchGridRenderer - Colorblind simulation grid
- [ ] ComparisonChartRenderer - HSV scatter plot
- [ ] ImageProcessor - Sharp-based color extraction
- [ ] Caching for rendered images

**References**: [RENDERING.md](./RENDERING.md)

### Phase 5: Testing & Optimization (Week 5-6)

- [ ] Unit tests for all services
- [ ] Integration tests for commands
- [ ] Parity tests (Discord bot vs. web app)
- [ ] Performance optimization (sub-500ms responses)
- [ ] Load testing (100+ concurrent users)

**References**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#testing-parity)

### Phase 6: Deployment & Monitoring (Week 6)

- [ ] Choose hosting platform (Fly.io recommended)
- [ ] Set up Dockerfile
- [ ] Configure Upstash Redis
- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Implement monitoring and logging
- [ ] Deploy to Fly.io

**References**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🔑 Key Technical Decisions

### Why npm Package?

- **Shared Code**: `@xivdyetools/core` consumed by web app, bot, and future projects
- **Single Source of Truth**: Services, types, constants in one published package
- **Easier Testing**: Test core package independently
- **Community Sharing**: Others can use your color algorithms
- **Maximum Flexibility**: Enables Dalamud plugins, APIs, mobile apps, etc.

### Why Node.js Canvas?

- **Familiar API**: Same Canvas API as web browsers
- **Fast**: Hardware-accelerated rendering
- **Reliable**: Mature library with good TypeScript support

### Why Redis?

- **Fast Caching**: Sub-millisecond lookups for API responses
- **Persistent**: Survives bot restarts
- **Scalable**: Can handle thousands of requests/second

### Why Discord.js v14?

- **Most Popular**: Largest community and best documentation
- **TypeScript Support**: First-class TypeScript integration
- **Slash Commands**: Built-in support for Discord's modern command system

---

## 💡 Tips & Best Practices

### Code Reuse

✅ **DO**: Copy services from web app verbatim when possible
❌ **DON'T**: Rewrite algorithms - introduces bugs and breaks parity

### Testing

✅ **DO**: Write parity tests comparing bot output to web app output
❌ **DON'T**: Skip testing - color algorithms are tricky

### Performance

✅ **DO**: Cache rendered images (color wheels, gradients)
❌ **DON'T**: Regenerate images every time - wastes CPU and memory

### Error Handling

✅ **DO**: Gracefully degrade when Universalis API is down
❌ **DON'T**: Crash the bot - show results with base prices instead

---

## 📖 Reading Order by Role

### **Developer** (Implementing the Bot)

1. [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
2. [PACKAGE_GUIDE.md](./PACKAGE_GUIDE.md) - Create core package
3. [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Extract services
4. [COMMANDS.md](./COMMANDS.md) - Command specs
5. [RENDERING.md](./RENDERING.md) - Image generation
6. [API_REFERENCE.md](./API_REFERENCE.md) - Reference while coding
7. [DEPLOYMENT.md](./DEPLOYMENT.md) - Deploy to Fly.io

### **DevOps** (Deploying & Maintaining)

1. [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand components
2. [DEPLOYMENT.md](./DEPLOYMENT.md) - Infrastructure setup
3. [COMMANDS.md](./COMMANDS.md) - Understand workload
4. [API_REFERENCE.md](./API_REFERENCE.md) - Debug issues

### **Project Manager** (Planning & Estimating)

1. [ARCHITECTURE.md](./ARCHITECTURE.md) - Scope & complexity
2. [COMMANDS.md](./COMMANDS.md) - Feature specifications
3. [DEPLOYMENT.md](./DEPLOYMENT.md) - Cost estimates
4. [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Implementation timeline

---

## 🛠️ Technology Summary

| Component | Technology | Why? |
|-----------|-----------|------|
| **Language** | TypeScript 5.3+ | Type safety, better DX |
| **Bot Framework** | discord.js v14 | Best ecosystem, TypeScript support |
| **Image Processing** | Sharp | Fastest, most reliable |
| **Image Rendering** | node-canvas | Canvas API compatibility |
| **Caching** | Redis (ioredis) | Fast, persistent, scalable |
| **API Client** | node-fetch | Drop-in replacement for browser fetch |
| **Database** | PostgreSQL (optional) | User preferences, saved palettes |
| **Hosting** | Fly.io / Railway | Free tier, Docker-native |
| **Testing** | Vitest | Fast, modern, TypeScript-native |

---

## 📈 Expected Outcomes

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Response Time** | <500ms | For all commands without pricing |
| **Response Time (with pricing)** | <2s | Including Universalis API calls |
| **Image Render Time** | <200ms | Color wheels, gradients, swatches |
| **Uptime** | >99.5% | ~3.6 hours downtime/month max |
| **Memory Usage** | <512 MB | With Redis cache |

### Cost Targets

- **Small Bot** (<100 servers): $0-5/month (Fly.io free tier or Railway)
- **Medium Bot** (100-1,000 servers): $13/month (DigitalOcean)
- **Large Bot** (>1,000 servers): $45/month (AWS/GCP)

---

## ❓ FAQ

### Q: Can I reuse the web app services without changes?

**A**: Yes! By publishing them as an npm package (`@xivdyetools/core`), both the web app and Discord bot consume the same code. ColorService is 100% reusable as-is. DyeService needs minor changes (remove singleton, make environment-agnostic).

### Q: Do I need to understand color theory?

**A**: No! All color algorithms are already implemented in ColorService and DyeService. Just call the methods.

### Q: How long will implementation take?

**A**: Estimated 4-6 weeks for a solo developer working part-time. Faster with a team or full-time commitment.

### Q: What if Universalis API goes down?

**A**: The bot gracefully degrades - shows base vendor prices instead of live market board prices. Core functionality (matching, harmonies, accessibility) works offline.

### Q: Can this scale to thousands of servers?

**A**: Yes! Discord.js has built-in sharding for large bots. Redis caching handles high request rates. See [DEPLOYMENT.md](./DEPLOYMENT.md#scaling-strategies).

---

## 🤝 Contributing

This is planning documentation for a future implementation. Once the bot is built:

1. Submit bugs/features via GitHub Issues
2. Contribute code via Pull Requests
3. Update documentation as the bot evolves

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-22 | Initial planning documentation |

---

## 🔗 Related Links

- **Web App Repository**: [XIV Dye Tools](https://github.com/FlashGalatine/xivdyetools) (v2.0.0)
- **Core Package** (when created): [xivdyetools-core](https://github.com/FlashGalatine/xivdyetools-core)
- **Discord Bot** (when created): [xivdyetools-discord-bot](https://github.com/FlashGalatine/xivdyetools-discord-bot)
- **Discord.js Docs**: [discord.js.org](https://discord.js.org)
- **Universalis API**: [universalis.app](https://universalis.app)
- **Fly.io Docs**: [fly.io/docs](https://fly.io/docs)
- **Canvas Docs**: [node-canvas](https://github.com/Automattic/node-canvas)

---

**Ready to start building?** Begin with [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the npm package architecture, then follow [PACKAGE_GUIDE.md](./PACKAGE_GUIDE.md) to create the core package!

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Status**: Planning Complete ✅

# Dye Maintainer Tool

**A developer GUI for adding new dyes to xivdyetools-core**

> This tool streamlines the dye addition process with automatic color conversion, XIVAPI integration, and direct file writing.

---

## Overview

The **Dye Maintainer Tool** (`xivdyetools-maintainer`) is a Vue 3 application that provides a graphical interface for adding new dyes to the core library. Instead of manually editing JSON files, you can:

- Enter a hex color and get RGB/HSV calculated automatically
- Fetch localized names (EN, JA, DE, FR) from XIVAPI with one click
- Preview the exact JSON entry before saving
- Write directly to `colors_xiv.json` and all locale files

---

## When to Use This Tool

Use the Maintainer Tool when:
- A new FFXIV patch introduces new dyes
- You need to correct color values for existing dyes
- You're adding dyes from events or seasonal content

For manual editing or understanding the data format, see [Adding New Dyes](adding-dyes.md).

---

## Prerequisites

- Node.js 18+
- The `xivdyetools-core` library in a sibling directory
- Internet connection (for XIVAPI lookups)

```
XIVProjects/
├── xivdyetools-maintainer/   ← This tool
├── xivdyetools-core/         ← Target for writes
└── ...
```

---

## Quick Start

```bash
# Navigate to the maintainer directory
cd xivdyetools-maintainer

# Install dependencies
npm install

# Start the development server
npm run dev
```

This starts:
- **Frontend**: http://localhost:5174 (Vite dev server)
- **Backend**: http://localhost:3001 (Express file server)

---

## Using the Tool

### Step 1: Enter the Item ID

1. Get the Item ID from [Universalis](https://universalis.app) or [XIVAPI](https://v2.xivapi.com)
2. Enter it in the **Item ID** field
3. Click **"Fetch from XIVAPI"** to auto-populate EN, JA, DE, FR names

### Step 2: Set the Color

1. Use the **color picker** or enter a hex code manually (e.g., `#FF6B6B`)
2. RGB and HSV values are calculated automatically
3. The preview card updates in real-time

### Step 3: Fill Dye Details

| Field | Description |
|-------|-------------|
| **Category** | Neutral, Reds, Blues, Greens, Yellows, Browns, Purples, Special, Facewear |
| **Acquisition** | Dye Vendor, Crafting, Cosmic Exploration, etc. |
| **Price** | Gil cost (if purchasable) |
| **Currency** | Gil, Cosmocredits, or leave empty |

### Step 4: Set Variant Flags

Check any applicable flags:
- **Metallic** - Has metallic sheen
- **Pastel** - Pastel series dye
- **Dark** - Dark series dye
- **Cosmic** - Cosmic series dye

### Step 5: Manual Locale Entry

XIVAPI doesn't have Korean or Chinese names, so enter these manually:
- **Korean (KO)** - 한국어 name
- **Chinese (ZH)** - 中文 name

### Step 6: Review and Save

1. Check the **JSON Preview** panel to verify all data
2. The **Validation Messages** panel shows any issues
3. Click **"Add Dye to Library"** to write to all files

---

## What Gets Updated

When you add a dye, the tool writes to:

| File | Content Added |
|------|---------------|
| `xivdyetools-core/src/data/colors_xiv.json` | Full dye entry (color, category, acquisition, etc.) |
| `xivdyetools-core/src/data/locales/en.json` | English name |
| `xivdyetools-core/src/data/locales/ja.json` | Japanese name |
| `xivdyetools-core/src/data/locales/de.json` | German name |
| `xivdyetools-core/src/data/locales/fr.json` | French name |
| `xivdyetools-core/src/data/locales/ko.json` | Korean name |
| `xivdyetools-core/src/data/locales/zh.json` | Chinese name |

---

## After Adding Dyes

After adding new dyes via the tool, you still need to test, build, and publish:

```bash
# 1. Run tests in core library
cd ../xivdyetools-core
npm test

# 2. Build and publish (if tests pass)
npm run build
npm version patch
npm publish

# 3. Update consumer projects
cd ../xivdyetools-web-app
npm update @xivdyetools/core
npm run build

cd ../xivdyetools-discord-worker
npm update @xivdyetools/core
npm run deploy:production
```

---

## Validation Rules

The tool validates your input:

| Check | Description |
|-------|-------------|
| **Duplicate ID** | Warns if Item ID already exists in database |
| **Required Fields** | Ensures all mandatory fields are filled |
| **Color Format** | Validates hex code format |
| **Name Length** | Checks localized names aren't empty |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vue 3 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Express.js (file I/O) |
| Color Utils | @xivdyetools/core |

---

## Troubleshooting

### "Backend server not running" error

Make sure to start with `npm run dev` which runs both frontend and backend via concurrently.

### XIVAPI fetch fails

- Check your internet connection
- Verify the Item ID is correct (use Universalis to double-check)
- XIVAPI may be temporarily unavailable

### Changes not appearing in consumer apps

After adding a dye:
1. Rebuild the core library (`npm run build` in xivdyetools-core)
2. Publish to npm (`npm publish`)
3. Update the dependency in consumer projects

---

## Related Documentation

- [Adding New Dyes (Manual)](adding-dyes.md) - For understanding the data format
- [Core Library Overview](../projects/core/overview.md)
- [Release Process](../developer-guides/release-process.md)

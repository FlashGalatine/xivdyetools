# Phase 12.1: Build System Setup - Development Guide

**Status**: 🚀 Groundwork Complete
**Branch**: `phase-12.1/build-system`
**Date**: November 16, 2025

---

## ✅ What Has Been Set Up

### 🏗️ Project Structure Created

```
src/
├── index.html              # Entry point HTML
├── main.ts                 # Application entry point
├── apps/                   # Tool applications (will be populated in Phase 12.4)
├── components/             # Reusable UI components (will be populated in Phase 12.3)
├── services/               # Business logic services (will be populated in Phase 12.2)
├── shared/                 # Shared utilities and types
├── data/                   # Static data files (dyes, worlds, etc.)
├── styles/                 # Global and theme styles
│   ├── themes.css         # Theme definitions
│   └── tailwind.css       # Tailwind CSS utilities
└── __tests__/             # Test files (will be populated)
```

### 📦 Configuration Files Created

**Build & Development**:
- ✅ `vite.config.ts` - Vite 5.x configuration
- ✅ `tsconfig.json` - TypeScript strict mode configuration
- ✅ `tsconfig.app.json` - Application-specific TypeScript config
- ✅ `postcss.config.js` - PostCSS with Tailwind and Autoprefixer

**Code Quality**:
- ✅ `.eslintrc.json` - ESLint with TypeScript support
- ✅ `.eslintignore` - ESLint ignore patterns
- ✅ `.prettierrc.json` - Prettier code formatting
- ✅ `.prettierignore` - Prettier ignore patterns

**Testing**:
- ✅ `vitest.config.ts` - Vitest configuration with jsdom

**Package Management**:
- ✅ `package.json` - Updated with v2.0.0-alpha.1 and Phase 12 scripts

### 📄 Entry Points Created

- ✅ `src/index.html` - HTML entry point
- ✅ `src/main.ts` - TypeScript entry point

### 🎨 Styles Setup

- ✅ `src/styles/themes.css` - Theme definitions (10 themes)
- ✅ `src/styles/tailwind.css` - Tailwind CSS imports

---

## 🔧 Next Steps - Installation & Verification

### Step 1: Install Dependencies

```bash
cd /path/to/XIVDyeTools
npm install
```

**Expected Output**:
- ~500+ packages installed
- No security vulnerabilities (unless unavoidable)
- `node_modules/` created with 200MB+ size

**Troubleshooting**:
- If Node version error: Update to Node 18+ with `nvm install 18`
- If npm cache issues: Run `npm cache clean --force`

### Step 2: Verify TypeScript

```bash
npm run type-check
```

**Expected Output**:
```
tsc --noEmit

✅ No errors found (0 errors)
```

**If You Get Errors**:
- Check `tsconfig.json` is correct
- Verify `@types/node` is installed
- Ensure no syntax errors in `.ts` files

### Step 3: Run Development Server

```bash
npm run dev
```

**Expected Output**:
```
  VITE v5.0.8  ready in XX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**If Server Doesn't Start**:
- Check port 5173 is not in use: `lsof -i :5173`
- Clear `.vite` cache: `rm -rf .vite`
- Try different port: `npm run dev -- --port 3000`

### Step 4: Verify Build Works

```bash
npm run build
```

**Expected Output**:
```
tsc --noEmit && vite build

dist/
├── index.html
├── main.js (or main-[hash].js)
└── main.css (or main-[hash].css)
```

**If Build Fails**:
- Check all TypeScript files for type errors
- Verify `src/index.html` exists
- Ensure `src/main.ts` has no import errors

---

## 📋 Checklist for Phase 12.1 Completion

### Build System Setup

- [x] Directory structure created (`src/`, `apps/`, `components/`, `services/`, `shared/`)
- [x] Vite 5.x configuration created
- [x] TypeScript 5.x configured with strict mode
- [x] ESLint with TypeScript plugin configured
- [x] Prettier code formatter configured
- [x] Vitest testing framework configured
- [x] Package.json scripts added for Phase 12
- [x] Entry points created (index.html, main.ts)
- [x] Base styles and theme system set up

### Pending Installation Tasks

- [ ] Run `npm install` to install all dependencies
- [ ] Run `npm run type-check` to verify TypeScript setup
- [ ] Run `npm run dev` to start development server
- [ ] Run `npm run build` to verify production build
- [ ] Run `npm run test` to verify Vitest setup

### When Installation Complete

- [ ] Commit all Phase 12.1 setup changes
- [ ] Push to `phase-12.1/build-system` branch
- [ ] Create PR: `phase-12.1/build-system` → `experimental`
- [ ] Move to Phase 12.2 (TypeScript Migration - Services)

---

## 🚀 Development Workflow

### Starting Development

```bash
# Ensure you're on the correct branch
git checkout phase-12.1/build-system

# Start development server
npm run dev

# In another terminal, run tests in watch mode
npm run test
```

### Code Quality Checks

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Testing with coverage
npm run test:coverage
```

### Before Committing

```bash
# 1. Type check
npm run type-check

# 2. Format code
npm run format

# 3. Lint
npm run lint

# 4. Run tests
npm run test

# 5. Commit with proper message
git commit -m "Phase 12.1: [description]"
```

---

## 📚 Phase 12.1 Deliverables Status

| Deliverable | Status | Details |
|------------|--------|---------|
| **Directory Structure** | ✅ Complete | src/ with all subdirectories created |
| **Vite Configuration** | ✅ Complete | vite.config.ts with proper aliases |
| **TypeScript Setup** | ✅ Complete | tsconfig.json with strict mode |
| **ESLint Setup** | ✅ Complete | .eslintrc.json configured |
| **Prettier Setup** | ✅ Complete | .prettierrc.json configured |
| **Vitest Setup** | ✅ Complete | vitest.config.ts configured |
| **package.json** | ✅ Complete | Scripts and dependencies added |
| **Entry Points** | ✅ Complete | index.html and main.ts created |
| **Styles** | ✅ Complete | Theme and utility CSS files |
| **Dependencies Installation** | ⏳ Pending | Run `npm install` |
| **Verification** | ⏳ Pending | Run `npm run dev` and `npm run build` |

---

## 🔍 Configuration Overview

### Vite Features Enabled

- ✅ TypeScript compilation
- ✅ Hot Module Replacement (HMR)
- ✅ Code splitting for large chunks
- ✅ Sourcemaps for production
- ✅ ES2020 target with native modules
- ✅ Path aliases (@, @components, @services, etc.)

### TypeScript Configuration

- ✅ Strict mode enabled (all type checking enabled)
- ✅ ES2020 target
- ✅ JSX support ready
- ✅ Module resolution configured
- ✅ Source maps enabled
- ✅ Path aliases configured

### ESLint Rules

- ✅ No explicit `any` types
- ✅ Function return types required (warnings)
- ✅ Unused variables not allowed
- ✅ No console.log (warn only on console.warn/error)
- ✅ const/let preferred over var
- ✅ Prettier integration for formatting

### Test Configuration

- ✅ jsdom environment for DOM testing
- ✅ 80% coverage targets
- ✅ Vitest UI for visual test running
- ✅ HTML coverage reports

---

## ⚠️ Important Notes for Phase 12.1

### When Installing Dependencies

```bash
npm install

# This will:
# 1. Install Vite, TypeScript, Vitest, ESLint, Prettier
# 2. Create node_modules/ (~1GB)
# 3. Create package-lock.json
# 4. Install 500+ packages total
```

**Do not commit `node_modules/`** - it's already in `.gitignore`

### Development vs Production

- **Development**: `npm run dev` uses Vite's dev server with HMR
- **Production**: `npm run build` creates optimized `dist/` folder

### Branch Strategy Reminder

```
phase-12.1/build-system (current)
  ↓ (after verification)
experimental (merge via PR)
  ↓ (after Phase 12 complete)
main (v2.0.0 release)
```

---

## 🎯 Success Criteria for Phase 12.1

- ✅ All configuration files in place
- ✅ Directory structure created
- ✅ `npm install` completes without errors
- ✅ `npm run type-check` shows 0 errors
- ✅ `npm run dev` starts server on localhost:5173
- ✅ `npm run build` creates dist/ folder
- ✅ `npm run test` runs Vitest successfully
- ✅ `npm run lint` and `npm run format` work

---

## 📞 Quick Reference

### Common Commands

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build locally
npm run type-check       # Check TypeScript errors
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run test             # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:ui          # Visual test UI
```

### Port Issues

```bash
# If port 5173 is in use:
npm run dev -- --port 3000

# Kill process using port 5173:
# macOS/Linux:
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill

# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### TypeScript Issues

```bash
# Strict type checking
npm run type-check

# Verbose output
npx tsc --noEmit --pretty false

# Check specific file
npx tsc src/main.ts --noEmit
```

---

## 🎓 Learning Resources

- **Vite Docs**: https://vitejs.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Vitest Guide**: https://vitest.dev/
- **ESLint Rules**: https://eslint.org/docs/rules/
- **Tailwind CSS**: https://tailwindcss.com/docs

---

**Phase 12.1 Status**: ✅ Groundwork Complete, Awaiting Installation & Verification
**Next Phase**: Phase 12.2 - TypeScript Migration (Services Layer)
**Ready When**: `npm install` completed and all verification steps passed

---

*Created November 16, 2025 during Phase 12.1 Build System Setup*
*Branch: phase-12.1/build-system*

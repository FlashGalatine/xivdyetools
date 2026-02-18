# Implementation Progress

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## Stage 0: Documentation
- [x] Create documentation folder
- [x] README.md - Overview and summary
- [x] API_CHANGES.md - New endpoints, schema changes
- [x] DISCORD_CHANGES.md - New commands, moderation buttons
- [x] WEB_APP_CHANGES.md - UI changes, routing, bug fixes
- [x] PROGRESS.md - This file

---

## Stage 1: API (Foundation)

### 1.1 Database Migration
- [ ] Add `previous_values` column to presets table
- [ ] Run migration in production

### 1.2 Types
- [ ] Add `PresetEditRequest` interface
- [ ] Add `PresetEditResponse` interface
- [ ] Add `PresetPreviousValues` interface

### 1.3 Service Functions
- [ ] Add `findDuplicatePresetExcluding()` function
- [ ] Add `updatePreset()` function
- [ ] Add `revertPreset()` function

### 1.4 PATCH Endpoint
- [ ] Add route handler for `PATCH /api/v1/presets/:id`
- [ ] Implement ownership check
- [ ] Implement validation
- [ ] Implement duplicate detection
- [ ] Implement moderation integration
- [ ] Store previous_values when flagged

### 1.5 Revert Endpoint
- [ ] Add route handler for `PATCH /api/v1/moderation/:presetId/revert`
- [ ] Implement moderator auth check
- [ ] Restore from previous_values
- [ ] Log action in moderation_log

### 1.6 Deploy & Test
- [ ] Deploy to Cloudflare
- [ ] Test edit endpoint with approved content
- [ ] Test edit endpoint with flagged content
- [ ] Test revert endpoint

---

## Stage 2: Discord Worker

### 2.1 API Client Methods
- [ ] Add `getMyPresets()` function
- [ ] Add `editPreset()` function
- [ ] Add `revertPreset()` function

### 2.2 Edit Subcommand
- [ ] Add edit subcommand handler
- [ ] Implement preset autocomplete (user's presets only)
- [ ] Implement dye autocomplete
- [ ] Handle success response
- [ ] Handle pending moderation response
- [ ] Handle duplicate response

### 2.3 Revert Button
- [ ] Add revert button to moderation panel
- [ ] Add revert modal for reason input
- [ ] Handle revert confirmation

### 2.4 Register Commands
- [ ] Add edit subcommand to preset command definition
- [ ] Run command registration script

### 2.5 Deploy & Test
- [ ] Deploy to Cloudflare
- [ ] Test /preset edit command
- [ ] Test autocomplete
- [ ] Test revert button

---

## Stage 3: Web App

### 3.1 Fix Modal Bug
- [ ] Investigate current behavior
- [ ] Add debug logging
- [ ] Identify root cause
- [ ] Implement fix
- [ ] Verify fix works

### 3.2 Filter Facewear
- [ ] Update `createDyeSelector()` to filter Facewear category
- [ ] Apply same filter to edit form

### 3.3 Service Methods
- [ ] Add `voteForPreset()` method
- [ ] Add `removeVote()` method
- [ ] Add `hasVoted()` method
- [ ] Add `editPreset()` method

### 3.4 URL Routing
- [ ] Add route handling in main.ts
- [ ] Add `selectPresetById()` method to preset-browser-tool
- [ ] Update URL on preset selection
- [ ] Handle browser back button

### 3.5 Share Button
- [ ] Add share button to preset detail panel
- [ ] Implement clipboard copy
- [ ] Show success toast

### 3.6 Vote Button
- [ ] Replace Discord CTA with vote button
- [ ] Show login prompt for unauthenticated users
- [ ] Implement toggle vote behavior
- [ ] Update vote count optimistically

### 3.7 Duplicate Link
- [ ] Update duplicate toast message to include preset name
- [ ] Add link/button to view duplicate preset

### 3.8 Edit Form
- [ ] Create preset-edit-form.ts component
- [ ] Pre-populate with existing values
- [ ] Handle form submission
- [ ] Handle duplicate response
- [ ] Handle moderation status response

### 3.9 My Submissions Edit
- [ ] Add edit button to preset details
- [ ] Show pending review badge when applicable
- [ ] Refresh list after successful edit

### 3.10 Deploy & Test
- [ ] Build for production
- [ ] Deploy to Cloudflare Pages
- [ ] Test all features
- [ ] Verify mobile responsiveness

---

## Git Commits

| Step | Commit Message | Status |
|------|----------------|--------|
| Docs | docs: add preset refinements documentation | [ ] |
| API Types | feat(api): add preset edit types and interfaces | [ ] |
| API Service | feat(api): add updatePreset and revertPreset service functions | [ ] |
| API Edit | feat(api): add PATCH endpoint for preset editing | [ ] |
| API Revert | feat(api): add moderation revert endpoint | [ ] |
| Discord Client | feat(discord): add preset edit API client methods | [ ] |
| Discord Edit | feat(discord): add /preset edit subcommand | [ ] |
| Discord Revert | feat(discord): add revert button to moderation panel | [ ] |
| Discord Register | chore(discord): register updated preset commands | [ ] |
| Web Modal Fix | fix(web): resolve modal dismiss bug on preset submission | [ ] |
| Web Facewear | fix(web): filter facewear dyes from submission form | [ ] |
| Web Services | feat(web): add voting and edit service methods | [ ] |
| Web Routing | feat(web): add URL routing for preset permalinks | [ ] |
| Web Share/Vote | feat(web): add share and vote buttons to preset detail | [ ] |
| Web Duplicate | fix(web): show link to duplicate preset on submission | [ ] |
| Web Edit Form | feat(web): add preset edit form component | [ ] |
| Web Edit Button | feat(web): add edit button to My Submissions panel | [ ] |

---

## Notes

*Add implementation notes, blockers, and decisions here during development.*

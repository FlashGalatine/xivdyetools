# FINDING-011: Web-app builds HTML strings with unescaped remote/user text (`innerHTML`) — My Submissions modal and dye-search empty state

## Severity
**LOW** — the CSP (`script-src 'self'`, no inline) blocks script execution, so the outcome is markup/phishing/CSS injection and DOM clobbering, not code execution; and the attacker must be a moderator (rejection reason) or the victim themself (own preset name, own search query). Reviewer IDs: WEB-1, WEB-2. Coordinator-verified at the sinks.

## Category
CWE-79 Improper Neutralization of Input During Web Page Generation (DOM-based)

## Location
- `apps/web-app/src/components/my-submissions-modal.ts:104, 138, 146, 154` — `${preset.name}` and `${note}` (= API `preset.rejection_reason`, typed by moderators in the moderation bot) interpolated into a template string assigned to `content.innerHTML`.
- `apps/web-app/src/components/dye-grid.ts:76-91` → `components/empty-state.ts:234-243` — the user's search query goes through `tInterpolate('dyeSelector.noResults', { query })` into an HTML string rendered via `innerHTML` (self-XSS today; would become reflected if a deep-link ever pre-fills the query).
- No `escapeHtml` helper exists anywhere in `apps/web-app/src` (all other remote strings are rendered through Lit text bindings or `textContent` — verified positive control).

## Recommendation
Add a tiny `escapeHtml()` (or build these rows with `document.createElement`/Lit `html` templates) and use it for every interpolated string in imperative `innerHTML` templates; add an ESLint rule or test that greps for `${` inside `innerHTML =` assignments. Server-side, give preset `name`/`rejection_reason` a conservative charset.

## References
- Evidence: `../evidence/review-web-app.md` (WEB-1, WEB-2, positive controls)

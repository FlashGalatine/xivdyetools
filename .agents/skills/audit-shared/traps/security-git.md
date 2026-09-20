## 6. Security / git hygiene

- Test fixtures shaped like real tokens (Discord-token-shaped strings) trip GitHub push
  protection on push and force history rewrites — use obviously fake shapes.
- Removing a secret from source does not un-leak it (history, clones); rotate **before** pushing
  the removal commit. Runbook: `docs/operations/SECRET_ROTATION.md` (read its "which worker does
  `wrangler secret put` hit" box first).
- Stage only your own paths — another session often edits the same checkout; `git rm` stages
  immediately, so a later `git commit` for a different path set swallows those deletions unless you
  use `git commit --only -- <paths>`. Never `git stash` for a baseline.
- Bare `wrangler deploy` is production on `oauth` and the live beta on `og-worker`/`discord-worker`
  — see `deploy-units.md` before recommending a command.
- `_headers` patterns MERGE (an `/assets/og/*` rule inherited `immutable`); a glob in a CSS comment
  once deleted an `@font-face`; SPA catch-all + `immutable` can cache an HTML fallback under a `.js`
  URL — diff the custom domain against the pages.dev alias before calling a deploy "partial".

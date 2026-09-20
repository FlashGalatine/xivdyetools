---
name: git-commit-helper
description: Commit staged changes to git without pushing. Use when asked to "commit to git", "commit but don't push", "save changes to git", or any request involving git commits without remote operations.
allowed-tools: Bash
---

# Git Commit Helper

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

## Purpose

Commits staged or specified changes to the current working branch without pushing to remote.

## Instructions

1. **Identify the current branch** (unless explicitly specified):
   ```bash
   git branch --show-current
   ```

2. **Check repository status**:
   ```bash
   git status
   ```

3. **Stage changes if needed**:
   - If changes are unstaged and user wants all changes: `git add .`
   - If specific files mentioned: `git add <files>`
   - If changes are already staged: proceed to commit

4. **Review staged changes**:
   ```bash
   git diff --staged --stat
   ```

5. **Generate commit message**:
   - Use conventional commit format when appropriate: `type(scope): description`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`
   - Keep subject line under 50 characters
   - Add detailed body if changes are complex

6. **Commit the changes**:
   ```bash
   git commit -m "type(scope): concise description" -m "Optional detailed body explaining what and why"
   ```

7. **Confirm completion**:
   - Show the commit hash and summary
   - Remind user changes are local only (not pushed)

## Important Rules

- **NEVER push** to remote unless explicitly asked
- Always work on the current branch unless user specifies otherwise
- Ask for clarification if commit scope is ambiguous
- If working directory is clean, inform the user there's nothing to commit

## Example Output

```
✓ Committed to branch: feature/user-auth
  Commit: a1b2c3d
  Message: feat(auth): add JWT token validation
  
  Files changed: 3
  Insertions: 45
  Deletions: 12
  
  Note: Changes are local only. Use 'git push' when ready to push to remote.
```

## xivdyetools specifics

- Another session often shares the checkout: stage only your own paths and commit with
  `git commit --only -- <paths> -m "…"`; never `git add -A`, never `git stash` for a baseline.
- **Never delegate a commit to a subagent** — the coordinator holds the approved path list and
  the user's yes. This skill is deliberately Bash-only so it cannot spawn one
  (`../audit-shared/model-routing.md`, *Never delegate*).
- Message style: `<type>(<scope>): <claim about behaviour>`, scope = app/package directory name
  (`docs/developer-guides/contributing.md`). Root `CHANGELOG-laymans.md` edits are always their own commit.

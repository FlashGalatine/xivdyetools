# AGENTS.md

Entry point for coding agents that read `AGENTS.md` (Codex, Copilot CLI, Gemini CLI, and others).
Claude Code reads `CLAUDE.md` directly; both routes lead to the same facts.

## Project context

Read [CLAUDE.md](CLAUDE.md) for the monorepo map, commands, dependency flow, deploy hazards and the
*Working in this checkout* rules. Before working inside a package or app, also read that unit's
own `CLAUDE.md`. The filename is historical — the content applies to every agent. Do not load
every unit's file up front.

## Skills

Project skills are tracked in [`.agents/skills/`](.agents/skills/): one folder per skill, each
with a `SKILL.md` (`name` + `description` frontmatter) plus scripts and references.
`.claude/skills` is a symlink to the same directory, so every agent runs identical workflows.
Use a matching skill when the task fits its description or the user names it, and read only the
references that skill names.

Before executing any skill, read
[.agents/skills/audit-shared/model-routing.md](.agents/skills/audit-shared/model-routing.md). It
maps the skills' `collector` / `worker` / `verifier` roles to your runtime's models and tools,
and lists what is never delegated (user approval, commits and pushes, outward-facing prose).
Where a skill labels something a *Claude example* — a slash command, a plugin skill, a named
tool — treat it as one runtime's shortcut and follow the stated procedure with your own tools.

## Non-negotiables

- Command blocks marked `bash` need Bash / Git Bash, not PowerShell.
- Never publish packages, deploy workers, or push to `main`. Merging to `main` is the deploy,
  and a push touching the root `CHANGELOG-laymans.md` fires a public Discord announcement.
- Another agent session may share this checkout: never `git stash`, never switch branches in
  place, stage only your own paths. Work in `.claude/worktrees/<name>` (already git-ignored).

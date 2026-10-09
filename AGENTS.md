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

Before executing a skill, authoring a workflow, or delegating an ad-hoc task or any step of a
remediation sprint, read
[.agents/skills/audit-shared/model-routing.md](.agents/skills/audit-shared/model-routing.md). It
maps the `collector` / `worker` / `verifier` roles to your runtime's models, effort levels
and tools, and lists what is never delegated (user approval, commits and pushes, outward-facing
prose).
Where a skill labels something a *Claude example* — a slash command, a plugin skill, a named
tool — treat it as one runtime's shortcut and follow the stated procedure with your own tools.

## Delegation and model selection

Choose a delegated agent's tier and effort by its task. This applies to skills, workflows, and
ad-hoc delegation. Use the shared routing reference for role contracts and each runtime's native
tools; Claude's model names and Workflow `agent()` options are specific to Claude Code.

For Codex, use this task policy:

| Task | Tier | Reasoning effort |
|---|---|---|
| Fixed commands, inventories, gate runs, and mechanical collection | Luna | `low` |
| Bounded implementation, one review lens, one test file, or a draft | Sol | `medium` |
| Difficult implementation, unfamiliar subsystems, or subtle concurrency | Sol | `high`; raise to `xhigh` when needed |
| Ordinary verification and verdicts that change what ships | Sol | `xhigh` |
| Escalated verdict: no clear verifier majority, a security-critical final call, or a root cause the verifier missed | Astra | `high` |

- **Resolve versions per run:** unless the user pins a subagent model/version, select the latest
  available compatible model in the assigned tier from the active runtime's advertised models.
  The current Codex baselines (2026-10-06) are `gpt-6-luna`, `gpt-6.1-sol`, and `gpt-6-astra`.
  Treat versions in the shared reference as checked baselines; this policy governs Codex version
  selection. Validate the model's supported effort, record the resolved model and effort, and keep
  that pair for the run. Pass an actual model ID; do not invent a versionless `latest` tier alias.
- **Set model and effort explicitly:** pass both on every Codex spawn using the native tool's
  schema. Where supported, use `fork_turns: "none"` or a short history slice; a full-history fork
  inherits the coordinator's settings and cannot accept these overrides. Custom-agent files can
  override spawn settings, so check that the effective pair matches the task policy. Use a
  compatible definition or a native agent carrying the same role contract if a fixed setting
  conflicts; instruction-only templates can leave both settings to the explicit spawn.
- **Map Fable escalation to Astra:** the shared reference's Claude Fable escalation triggers use
  Astra in Codex. An Astra coordinator at `high` or above can make that final call inline. A Sol
  coordinator at `xhigh` or above can perform ordinary verification inline, but delegates an
  escalated verdict to Astra. If Astra or the required controls are unavailable, disclose the
  limitation and leave the escalated verdict unverified.
- **Delegate when useful:** use agents for substantial independent work or noisy command batches,
  with scoped prompts and summaries. Batch related work and respect the runtime's concurrency
  capacity; short commands and small, understood tasks can run inline. Preserve the user's
  selected coordinator model and effort, and keep approvals, commits, pushes, and outward-facing
  prose with the coordinator.

## Non-negotiables

- Command blocks marked `bash` need Bash / Git Bash, not PowerShell.
- Never publish packages, deploy workers, or push to `main`. Merging to `main` is the deploy,
  and a push touching the root `CHANGELOG-laymans.md` fires a public Discord announcement.
- Another agent session may share this checkout: never `git stash`, never switch branches in
  place, stage only your own paths. Work in `.claude/worktrees/<name>` (already git-ignored).

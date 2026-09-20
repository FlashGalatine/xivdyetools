# Runtime and model routing

Read this once when using a xivdyetools skill, before executing its workflow. The skills are
written for any coding agent that loads `SKILL.md` folders (Claude Code, Codex, and others);
everything runtime-specific lives in this file. The skill's `collector`, `worker`, and
`verifier` names describe tasks, not tool arguments or model names.

| Role | Tier | Give it / return contract |
|---|---|---|
| `collector` | Smallest, cheapest model available | Fixed commands without verdicts: build/test/coverage logs, tracked-file inventories, locale/font sweeps, git/npm facts. Return exit status per command, counts, relevant `file:line` hits, and saved log paths; never the raw log. |
| `worker` | Mid-tier general model | One bounded review or writing task: a deploy unit against a checklist, one test file, a failing test plus its source, a draft table. Return the requested schema, normally ≤ 40 lines; save longer evidence to its assigned file. |
| `verifier` | Strongest reasoning model available | Judgment where a wrong answer changes what ships: confirm findings, Severity × Exposure, dead-code verdicts, test-versus-source regressions, published-package semver, sprint ordering, unfamiliar root causes. Return a verdict and the evidence that settles it. |

Select the model for the active runtime. These are workflow assignments, not claims of model
equivalence across vendors.

| Role | Claude Code | Codex | Any other runtime |
|---|---|---|---|
| `collector` | `haiku` | `gpt-5.6-luna` | Its smallest model that runs shell commands reliably |
| `worker` | `sonnet` | `gpt-5.6-terra` | Its default mid-tier model |
| `verifier` | `opus` | `gpt-5.6-sol` | Its strongest model; inline if the coordinator already is one |

## Delegate when it helps

Use independent agents for substantial parallel work or noisy evidence collection while the
coordinator does other useful work. A short command or a small, already-understood task can run
inline; redirect verbose output to a file and inspect a summary. Subagents consume tokens too:
smaller models and concise handoffs can reduce cost and coordinator context, but extra agents
do not guarantee fewer total tokens. The Claude Fable rule below retains its quota policy.
An instruction below to use a role/agent follows these inline, capability, and capacity rules;
it does not require a new agent for every step.

Batch related commands or candidate verdicts into one assignment. Give each agent only its
goal, paths, relevant checklist, constraints, and return schema. Do not copy the whole conversation
or every shared reference. Assign disjoint output/test files; keep dependent steps sequential.
Launch independent tasks up to the runtime's available capacity, then reuse agents or work in
waves. Never assume the whole monorepo fits into one concurrent batch.

## Runtime tools and coordinator rules

**Claude Code:** use `Agent` with `subagent_type: "general-purpose"` and an explicit `model`
from the Claude column. Avoid `subagent_type: "fork"` when choosing a cheaper model: it inherits
the session model. Send independent calls together where supported. On an Opus or Sonnet
coordinator, verifier work may run inline. **Fable coordinates:** delegate collector work to
Haiku, worker work to Sonnet even for one unit, and verifier work to Opus. Fable retains prompts,
collation, coordinator edits, final writing, and the responsibilities below.

**Codex:** use the available native collaboration tool. In a runtime exposing
`collaboration.spawn_agent`, pass `task_name`, a self-contained `message`, the Codex `model` ID,
and `fork_turns: "none"` (or a short supported history slice when necessary). A full-history
fork (`"all"`, including its default in this runtime) inherits the parent model and cannot
accept a model override. Call collaboration tools directly, not inside `functions.exec`.
If the exposed tool has a different schema, follow that schema rather than copying these
arguments. Use the selected model's default reasoning effort; increase it only for difficult
verification. Astra or Sol coordinators may do verifier work inline; Terra or Luna coordinators
delegate it to Sol when available. Do not change the user's coordinator model.

**Any other runtime:** use its native delegation mechanism and the tier column above. With no
delegation at all, run every role inline in the order the skill gives, keep verbose command
output in files rather than the conversation, and do the verifier pass as a separate, explicit
re-read of each `file:line` before filing anything.

If native delegation or the requested model is unavailable, do not invent a tool/model or
launch a separate CLI to simulate it. Continue inline when capable, or use an available suitable
model and disclose a material fallback. Mark unresolved verdicts as unverified. These instructions
do not install models, enable features, or override runtime tool/permission restrictions.

**Shared skills and shell:** `allowed-tools` frontmatter uses Claude Code's tool names because
Claude Code enforces the field; a runtime that does not support it ignores it and uses its
actual tools and permissions. Translate Read/Glob/Grep/Write/Edit to native file tools or shell/patch operations,
`Agent` to native delegation, and `Skill` to the skill loader. To hand off to another skill, use
the available skill loader or read its sibling `SKILL.md` and follow it with the stated inputs.
Anything a skill labels a *Claude example* (a `superpowers` skill, a slash command, a named tool)
is one runtime's shortcut, not a required plugin; follow the stated review/worktree procedure
with native tools instead. Follow applicable `AGENTS.md` instructions and read the workspace,
monorepo, and target unit's `CLAUDE.md` for shared project facts — the filename is historical,
the content applies to every agent; don't load every unit's instructions.

Command blocks marked `bash` require Bash/Git Bash; do not paste them into PowerShell. See
[traps/shell.md](traps/shell.md) for shell, temporary-directory, and resource-path handling.
Resolve relative references from the file containing them. A bare shared filename such as
`model-routing.md` or `units.md` in a skill means its sibling `../audit-shared/` directory.

## Never delegate

- **User approval when needed.** The coordinator owns the conversation and checks existing
  authorization before asking again; a skill does not expand permission to publish or deploy.
- **`git add` / `git commit` / any push.** The coordinator holds the approved path list;
  another session can share this checkout.
- **Applying edits inside an iterative fix loop.** One writer: agents diagnose and return
  exact replacement text; the coordinator applies it. Independent test-writing assignments
  can write their explicitly assigned, disjoint files.
- **Prose that ships outward**, including the root `CHANGELOG-laymans.md` entry whose merge
  fires the announcement webhook. Agents may collect facts or critique it.

## Verification-agent prompt contract

Give a verifier the candidate rows verbatim plus: "Open each `file:line`, confirm or reject
each claim on what the file actually says, return `| id | CONFIRMED / REJECTED | ≤ 2-line reason |`
and nothing else. Read-only, write no files." Include relevant exposure/release rules when
the verdict depends on them. Carry rejection reasons forward (audits: *Rejected suspicions*).

Routing checked 2026-09-06 against the available Codex tools and official
[subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents) and
[model catalog](https://developers.openai.com/api/docs/models). Use the current runtime's
advertised model IDs if availability changes.

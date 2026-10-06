# Runtime and model routing

Read this once when using a xivdyetools skill, before executing its workflow. The skills are
written for any coding agent that loads `SKILL.md` folders (Claude Code, Codex, and others);
everything runtime-specific lives in this file. The skill's `collector`, `worker`, and
`verifier` names describe tasks, not tool arguments or model names.

| Role | Tier | Effort | Give it / return contract |
|---|---|---|---|
| `collector` | Smallest, cheapest model available | Lowest: the work is mechanical | Fixed commands without verdicts: build/test/coverage logs, tracked-file inventories, locale/font sweeps, git/npm facts. Return exit status per command, counts, relevant `file:line` hits, and saved log paths; never the raw log. |
| `worker` | Mid-tier general model | Balanced, usually `medium` | One bounded review or writing task: a deploy unit against a checklist, one test file, a failing test plus its source, a draft table. Return the requested schema, normally ≤ 40 lines; save longer evidence to its assigned file. |
| `verifier` | Top-tier reasoning model | High: enough to settle a verdict, short of the maximum | Judgment where a wrong answer changes what ships: confirm findings, Severity × Exposure, dead-code verdicts, test-versus-source regressions, published-package semver, sprint ordering, unfamiliar root causes. Return a verdict and the evidence that settles it. |

Every delegated role runs at a set model **and** effort, never at whatever effort the coordinator's
session happens to use: Claude Code pins both in a project agent per role, and a Codex coordinator
passes both on every spawn. These are workflow assignments, not claims of model equivalence across
vendors, and an effort name does not mean the same amount of thinking on different models.

| Role | Claude Code agent: model · effort | Codex spawn: `model` · `reasoning_effort` to pass | Any other runtime |
|---|---|---|---|
| `collector` | `xivdye-collector`: `claude-haiku-4-5` · none | `gpt-6-luna` · `low` | Its smallest model that runs shell commands reliably, at its lowest effort |
| `worker` | `xivdye-worker`: `claude-sonnet-5-5` · `medium` | `gpt-6-sol` · `medium` | Its default mid-tier model at its balanced effort |
| `verifier` | `xivdye-verifier`: `claude-opus-5-5` · `high` | `gpt-6-sol` · `xhigh` | A top-tier reasoning model at high effort; inline if the coordinator already is one at that effort |

The Claude Code agents live in `xivdyetools/.claude/agents/<agent>.md`; change a level there and in
this table together. They name exact model IDs because a level suits one model, and an alias can
resolve to another (a standalone Claude Code CLI mapped `sonnet` to Sonnet 5). Why these levels
(checked 2026-09-28): Haiku 4.5 has no effort control (Claude Code drops the field).
Anthropic starts Sonnet 5.5 at `medium` for agentic coding and asks for at least `high` on
intelligence-sensitive work; Opus 5.5 defaults to `medium`, and `xhigh` / `max` are for measured
gains. OpenAI's model-selection guide pairs Luna at low with simple extraction, Sol at medium with
everyday coding, and Sol at extra high with thorough verification and careful review; GPT-6 has no
Terra, and Astra costs five times as much as Sol. Raise a role's level only after a run shows it
missing things.

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

**Claude Code:** use `Agent` with `subagent_type` set to the role's agent and no `model` argument
(except the two standing overrides under *Claude Code Workflow scripts* below).
The Agent tool has no effort argument, so the agent file is the only per-role effort control; its
`effort` beats the session's effort and `modelSettings`, and only a `CLAUDE_CODE_EFFORT_LEVEL`
environment variable overrides it. Do not use `general-purpose` or `fork` for role work: they run
at the session's effort (a fork also at its model). If a role agent is missing (a session opened
above the repo root without the junction in `README.md` § *Discovery*), use `general-purpose` with
the role's model alias (`haiku` / `sonnet` / `opus`) and report that it ran at the session's
effort. Send independent calls together where supported. An Opus or Sonnet coordinator may do
verifier work inline only while its session runs at `high` or above (current builds set
`CLAUDE_EFFORT` in Bash's environment); otherwise, or when unsure, delegate it. **Fable
coordinates:** delegate every role to its agent, worker work even for one unit. Fable retains
prompts, collation, coordinator edits, final writing, and the responsibilities below.

**Claude Code Workflow scripts (Ultracode):** every `agent()` call passes its role's agent as
`agentType`, for skill work and for any other task; this overrides the workflow reference's default
of omitting `model`, because a bare call runs at the session's model **and** effort. If a role
agent is missing, pass the role's `model` alias **and** its `effort` instead (`haiku`, `sonnet` +
`medium`, `opus` + `high`), never neither. `agent()` also takes `model` and `effort`, which the
`Agent` tool lacks: `model` swaps the model and keeps the agent file's prompt and effort, `effort`
replaces the file's effort, and Haiku ignores `effort`. Two overrides are standing. A worker task
too hard for Sonnet (a cross-unit refactor, an unfamiliar subsystem) runs as
`agentType: 'xivdye-worker', model: 'opus', effort: 'high'`. An escalated verdict (verifier votes
with no clear majority, a security-critical final call, a root cause the verifier missed) runs as
`agentType: 'xivdye-verifier', model: 'fable'`, Fable 5.1 at `high`, which is 2.5× Opus per token,
so use a handful per run at most; a Fable coordinator makes that call itself. With the `Agent` tool, the
same `model` override also keeps the file's effort, so the Opus worker runs at `medium` there and
the Fable verifier at `high`. Every spawn re-reads about 75k tokens of system prompt and project
instructions, so a single short command still runs inline (*Delegate when it helps*) except under a
Fable coordinator, which delegates every role.

**Codex:** use the available native collaboration tool. In a runtime exposing
`collaboration.spawn_agent`, pass `task_name`, a self-contained `message`, `fork_turns: "none"` (or
a short supported history slice when necessary), and the role's `model` **and** `reasoning_effort`
from the Codex column — always both. The table lists values to pass, not model defaults: a `model`
without `reasoning_effort` runs at the model's own default, whatever the parent or this table uses
(a `gpt-6-sol` spawned alone ran at `medium`, not a verifier's `xhigh`). Where the tool offers no
GPT-6 model, use the GPT-5.6 model it offers for the same tier at the same effort. A full-history
fork (`"all"`, including its default in this runtime) inherits the parent's model and effort and
cannot accept a model override. Call collaboration tools directly, not inside `functions.exec`. If
the exposed tool has a different schema, follow that schema rather than copying these arguments.
An Astra coordinator at `high` or above, or a Sol coordinator at `xhigh` or above, may do verifier
work inline; any other coordinator, or one unsure of its own effort, delegates it. Do not change
the user's coordinator model or effort.

**Any other runtime:** use its native delegation mechanism and the tier and effort columns above.
With no delegation at all, run every role inline in the order the skill gives, keep verbose command
output in files rather than the conversation, and do the verifier pass as a separate, explicit
re-read of each `file:line` before filing anything.

If native delegation, the requested model, or a way to set its effort is unavailable, do not
invent a tool/model or launch a separate CLI to simulate it. Continue inline when capable, or use
an available suitable model and disclose a material fallback. Mark unresolved verdicts as
unverified. These instructions do not install models, enable features, or override runtime
tool/permission restrictions.

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

Routing checked 2026-09-28 by running it: in Claude Code 2.1.284, each role agent's effort as seen
inside the agent (`printenv CLAUDE_EFFORT`), launched from a `max` session; in the Codex desktop
app's client (0.158), each spawned child's model and effort in its session record. Rechecked
2026-10-06 in Claude Code 2.1.286 from an `xhigh` Opus 5.5 session: each Workflow `agent()`
combination of `agentType`, `model` and `effort` above, plus both `Agent` tool `model` overrides,
by model ID and `printenv CLAUDE_EFFORT` inside the agent. Sources: the
[Claude Code subagent docs](https://code.claude.com/docs/en/sub-agents), Anthropic's per-model
effort guidance, and OpenAI's
[subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[model selection](https://learn.chatgpt.com/docs/model-selection) and
[model catalog](https://developers.openai.com/api/docs/models). If availability changes, use the
runtime's advertised model IDs and effort levels, and update the agent files with this table.

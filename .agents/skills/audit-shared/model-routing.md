# Runtime and model routing

Read this before executing a skill, authoring a workflow, or delegating an ad-hoc task or any step
of a remediation sprint in xivdyetools. It supplies the runtime details for the shared policy in
`AGENTS.md` and `CLAUDE.md` for Claude Code, Codex, and other coding agents. No skill executes the
sprinting stage (the planner only schedules it), so [*Remediation sprints*](#remediation-sprints)
below maps its steps to the same roles. The `collector`, `worker`, and `verifier` names describe
tasks, not tool arguments or model names. Difficult worker tasks and escalated verifier tasks
retain their role's permissions and return contract; they do not require new agent names.

| Role | Tier | Effort | Give it / return contract |
|---|---|---|---|
| `collector` | Smallest, cheapest model available | Lowest: the work is mechanical | Fixed commands without verdicts: build/test/coverage logs, tracked-file inventories, locale/font sweeps, git/npm facts. Return exit status per command, counts, relevant `file:line` hits, and saved log paths; never the raw log. |
| `worker` | Mid-tier general model | Balanced, usually `medium` | One bounded review or writing task: a deploy unit against a checklist, one test file, a failing test plus its source, a draft table. Return the requested schema, normally ≤ 40 lines; save longer evidence to its assigned file. |
| `verifier` | Strong reasoning model; escalate unresolved or critical final calls | High: enough to settle a verdict, short of the maximum | Judgment where a wrong answer changes what ships: confirm findings, Severity × Exposure, dead-code verdicts, test-versus-source regressions, published-package semver, sprint ordering, unfamiliar root causes. Return a verdict and the evidence that settles it. |

Every delegated role runs at a set model **and** effort, never at whatever effort the coordinator's
session happens to use: Claude Code uses its project agent defaults and the overrides below; a
Codex coordinator resolves the task's model and passes both settings on every spawn, checking for
custom-agent settings that take precedence. These are workflow assignments, not claims of model
equivalence across vendors, and an effort name does not mean the same amount of thinking on
different models.

| Role / task | Claude Code agent: model · effort | Codex baseline (2026-10-06): `model` · `reasoning_effort` | Any other runtime |
|---|---|---|---|
| `collector` | `xivdye-collector`: `claude-haiku-4-5` · none | `gpt-6-luna` · `low` | Its smallest model that runs shell commands reliably, at its lowest effort |
| `worker` | `xivdye-worker`: `claude-sonnet-5-5` · `medium` | `gpt-6.1-sol` · `medium` | Its default mid-tier model at its balanced effort |
| `worker` (difficult) | `xivdye-worker` + `model: 'opus'` · `high` via Workflow (`medium` via `Agent`) | `gpt-6.1-sol` · `high`; raise to `xhigh` when needed | A stronger model or higher effort for an unfamiliar subsystem, cross-unit refactor, or subtle concurrency |
| `verifier` (ordinary) | `xivdye-verifier`: `claude-opus-5-5` · `high` | `gpt-6.1-sol` · `xhigh` | A strong reasoning model at high effort; inline if the coordinator already meets that task's requirements |
| `verifier` (escalated) | `xivdye-verifier` + `model: 'fable'` · `high` | `gpt-6-astra` · `high` | Its strongest reasoning model for no clear verifier majority, a security-critical final call, or a root cause the ordinary verifier missed |

The Codex IDs are dated baselines, not permanent version pins. Resolve the latest available
compatible model in each assigned tier per run as described under *Codex* below; ordinary Sol
verification and required Astra escalation are separate assignments.

The Claude Code agents live in `xivdyetools/.claude/agents/<agent>.md`; change a level there and in
this table together. They name exact model IDs because a level suits one model, and an alias can
resolve to another (a standalone Claude Code CLI mapped `sonnet` to Sonnet 5). Why these levels
(checked 2026-09-28): Haiku 4.5 has no effort control (Claude Code drops the field).
Anthropic starts Sonnet 5.5 at `medium` for agentic coding and asks for at least `high` on
intelligence-sensitive work; Opus 5.5 defaults to `medium`, and `xhigh` / `max` are for measured
gains. OpenAI's model-selection guide pairs Luna at low with simple extraction, Sol at medium with
complex technical work, Sol at extra high with decisions built from conflicting evidence, and
Astra with demanding analysis. These project effort defaults preserve routine work on Luna/Sol
and reserve Astra for escalation; adjust effort when evidence shows it is needed.

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

## Remediation sprints

The roles cover the sprinting stage as well as the audits: executing the sprints a
`REMEDIATION_PLAN.md` schedules — fixing, testing, reviewing, gating and releasing. No skill loads
this file for that work, so `AGENTS.md` and `conventions.md` §8 point here and the coordinator
follows this table itself; the runtime sections below say how each runtime launches the role. A row names the role that does the step when it is
delegated; *Delegate when it helps* still decides whether a small step runs inline, and a Fable
coordinator delegates every role. *Red-first* means a new test fails before the fix; a *mutation
check* means undoing the fix turns that test red again.

| Sprint step | Role | Give it / return contract |
|---|---|---|
| Re-check each finding against the sprint's base branch before fixing (audits age; earlier sprints move code) | `worker`, one per sprint | The finding files and the unit. Return per ID: still present (yes / no / partly, at `file:line`), the fix, red-first tests, risk to consumers; plus a proposed file allowlist and the release work |
| Facts: local and published versions, dependents, CHANGELOG heads, `git status` / diff stats, CI check states | `collector` | A fixed command list. Return the values |
| Implement one finding group | `worker` | A file allowlist the coordinator assigns, disjoint from every other writer's; red-first tests and a mutation check. Return per ID: outcome, what a user now sees differently, the tests, changed files |
| First review lens on a group: regressions, a test that stays green when the fix is reverted, comment and doc drift | `worker` | Read-only; the group's report verbatim. Return findings with `file:line` and a fix |
| Parity harnesses (run the page's or package's own source against the fix); translation checks against the glossary | `worker` | Scratch-only writes. Return counts and mismatches |
| Docs drift after the fix (the unit's `CLAUDE.md`, living docs); a draft of the unit's technical `CHANGELOG.md` entry and version-table rows | `worker` | Docs edits in allowlisted files only; the changelog entry and version rows come back as exact text for the coordinator to apply. Return the edits made and the draft text |
| Gates: the unit gate, the root gates, bundle size, integration and e2e suites, font cmap comparisons | `collector` | Per command: exit status, pass/total, failing test names, saved log path |
| Verdict: is each finding FIXED and safe to ship; the semver bump and publish / merge order; a review finding the implementer disputes | `verifier` | Read-only; every group report and review finding. Return a verdict per ID and the evidence that settles it |

**Escalate to the `verifier`** wherever a wrong answer ships a defect that users or attackers reach:
authentication, sessions and tokens, signature and HMAC checks, secret redaction, rate limiting and
request guards, D1 migrations, a published package's exported API, and a unit whose merge is a
production deploy with no beta (`oauth`). There the verifier reviews the implementation as one of
the review lenses, not only the final verdict. Elsewhere one verifier pass per sprint, over every
group at once, is enough.

**One writer per file.** A sprint implementation with a coordinator-assigned allowlist is an
explicitly assigned, disjoint-files assignment (*Never delegate* names the test-writing case; this is
the same shape). When review or verifier findings come back, each allowlist still has exactly one
writer: a fix too large to hand back as replacement text goes to one new assignment on that same
allowlist, with the findings verbatim, never to a second agent on the same file; a small fix comes
back as exact replacement text for the coordinator to apply. Reviewers, verifiers and collectors
write nothing in the repo. The coordinator keeps the sprint's scope and order, the allowlists, the
finding `## Status` lines and the plan's and report's status entries, the version bumps and
changelog text, every git write and the PR, and outward prose (the root `CHANGELOG-laymans.md`
entry, PR bodies).

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
the Fable verifier at `high`. The 2026-10-06 Claude setup observed about 75k tokens of system prompt
and project instructions per spawn; that is an observation about that setup, not a fixed spawn
cost across clients or models. A single short command still runs inline (*Delegate when it helps*)
except under a Fable coordinator, which delegates every role.

**Codex — resolve versions:** use the task policy in `AGENTS.md` and the table above: Luna for
mechanical collection, Sol for workers and ordinary verification, Astra for escalated verdicts.
Unless the user pins a subagent model/version, resolve the latest available compatible model in
the assigned tier from the active runtime's advertised models before its first spawn. Validate
that it supports the assigned effort, record the resolved model and effort per task variant, and
keep that pair for the run. If implementing a resolver, the App Server's `model/list` supplies
available IDs, supported efforts, and optional upgrade metadata; an upgrade must stay in the
assigned tier. Pass an actual advertised ID, and do not invent a versionless `latest` alias.
An older available model in the same tier can be a disclosed fallback. An unavailable Astra
escalation follows the stricter rule below.

**Codex — native spawns:** use the available native collaboration tool. In a runtime exposing
`collaboration.spawn_agent`, pass `task_name`, a self-contained `message`, `fork_turns: "none"`
(or a short supported history slice when necessary), and the resolved `model` **and**
`reasoning_effort` — always both. If the schema exposes `agent_type`, use an available compatible
role definition or a native agent carrying the role's full contract. A model-only spawn uses
that model's default effort when no configured effort applies; defaults vary by model and client.
A full-history fork (`"all"`, including its default in this runtime) inherits the parent's model
and effort and cannot accept these overrides. Call collaboration tools directly, not inside
`functions.exec`. If the exposed tool has a different schema, follow that schema rather than
copying these arguments.

**Codex — custom agents:** optional TOML definitions live in `.codex/agents/` for the project or
`~/.codex/agents/` for the user. A file's `model` and `model_reasoning_effort` take precedence over
explicit spawn settings and `[agents]` defaults. For per-run version selection, prefer
instruction-only role templates that omit both fields, then pass the resolved pair explicitly.
If a file pins either setting, choose a definition whose effective settings match the task, or
use a native agent with the same role instructions. A verifier fixed at `high` does not run a
Sol `xhigh` review just because the spawn requests it; a worker fixed at `medium` similarly
cannot take the difficult-worker effort override. Preserve the verifier's read-only contract
and all coordinator-only responsibilities in either path.

**Codex — verification and escalation:** an Astra coordinator at `high` or above, or a Sol
coordinator at `xhigh` or above, may do ordinary verifier work inline; any other coordinator, or
one unsure of its own effort, delegates it. The Claude Fable escalation triggers — no clear
verifier majority, a security-critical final call, or a root cause the verifier missed — use
Astra at `high` or above in Codex. A capable Astra coordinator makes that final call inline;
a Sol coordinator delegates it to Astra even when it can perform ordinary verification itself.
If Astra or the required controls are unavailable, disclose the limitation and leave the
escalated verdict unverified. Do not count a Sol fallback as the completed Astra pass. Keep the
user's coordinator model and effort. The Claude Fable coordinator's delegate-every-role quota
rule remains specific to Claude; Codex uses *Delegate when it helps* above.

**Any other runtime:** use its native delegation mechanism and the tier and effort columns above.
With no delegation at all, run every role inline in the order the skill gives, keep verbose command
output in files rather than the conversation, and do the verifier pass as a separate, explicit
re-read of each `file:line` before filing anything.

If native delegation, the requested model, or a way to set its effort is unavailable, do not
invent a tool/model or launch a separate CLI to simulate it. Continue inline when capable, or use
an available suitable model and disclose a material fallback. Mark unresolved verdicts as
unverified; a required Codex Astra escalation still follows the stricter rule above. These
instructions do not install models, enable features, or override runtime tool/permission
restrictions.

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
  and sprint implementations can write their explicitly assigned, disjoint files (see
  *Remediation sprints* for how review rounds keep one writer per file).
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
[model catalog](https://developers.openai.com/api/docs/models).

The 2026-10-06 Codex refresh checked the advertised model/effort list and current official
documentation for version selection and custom-agent precedence; it was not a new child-spawn
probe. The 2026-09-28 Codex probe remains historical evidence. A future behavioral probe should
record each child's effective model and effort, including custom-agent precedence and Astra
escalation. Resolver guidance:
[App Server model discovery](https://learn.chatgpt.com/docs/app-server#list-models-modellist).
When changing a routing policy, update this reference and the entry-point summaries together.
When availability changes, resolve the runtime's advertised IDs and efforts per run; update any
deliberately pinned agent definitions and dated baselines together.

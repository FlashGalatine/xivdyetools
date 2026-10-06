# Runtime and model routing

Read this once when using a xivdyetools skill, before executing its workflow, and before
delegating any step of a remediation sprint. No skill executes that stage (the planner only
schedules it), so [*Remediation sprints*](#remediation-sprints) below maps its steps to the same
roles. The skills are written for any coding agent that loads `SKILL.md` folders (Claude Code,
Codex, and others); everything runtime-specific lives in this file. The `collector`, `worker`, and
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

**Claude Code:** use `Agent` with `subagent_type` set to the role's agent and no `model` argument.
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
app's client (0.158), each spawned child's model and effort in its session record. Sources: the
[Claude Code subagent docs](https://code.claude.com/docs/en/sub-agents), Anthropic's per-model
effort guidance, and OpenAI's
[subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[model selection](https://learn.chatgpt.com/docs/model-selection) and
[model catalog](https://developers.openai.com/api/docs/models). If availability changes, use the
runtime's advertised model IDs and effort levels, and update the agent files with this table.

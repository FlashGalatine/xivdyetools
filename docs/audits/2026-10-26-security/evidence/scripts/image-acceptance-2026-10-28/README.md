# Image-worker hosted acceptance preparation (2026-10-28)

This is reviewable **additional testing code**, not a product feature or an activation approval.
Preparation and the client are local programs. Neither starts Wrangler, deploys, creates cloud
resources, nor calls a cloud API. Remote startup below remains **HELD pending explicit human
authorization** of that temporary code/fixture upload and the account to use. The production
release and corrected bot manual still have their separate activation gates.

**Later session result:** the user explicitly authorized one temporary preview test. The exact
42-request driver stopped after three matching responses and a fourth HTTP 503, with session-level
CPU-limit diagnostics. The proxy is stopped; 38 entries were not dispatched. See the
[hosted attempt](../../remediation-image-hosted-preview-2026-10-28.md). The original preparation
description below remains procedural history. Further hosted execution remains held; do not reuse
the failed session, spend its reserved budget, or treat this exception as production approval.

The subsequent [local CPU investigation](../../remediation-image-cpu-profile-2026-10-28.md)
identifies crop/resize hotspots but leaves the effective numeric legacy-preview CPU budget
unverified. Establish that applicable budget before proposing another hosted test; changing
`limits.cpu_ms` in this configuration does not establish enforcement by the inspected preview path.

## Scope and controls

`prepare-canary.mjs` requires an explicit source checkout, `--account-id` of exactly 32 lowercase
hex digits, and a new ignored directory inside the checkout. Generated config pins `account_id`;
provenance records the same `accountId`, and the driver checks the config's account/name identity.
It bundles the actual `apps/image-worker/src/worker.ts`, its unchanged product imports, and the
retained `vendor/photon/photon-owned.wasm`; it asserts one WASM resolution and one product
initializer. `provenance.json` records source/dependency and output hashes and checks sources did
not change during preparation. The client rechecks those hashes before sending anything.

Generated config uses only `xivdyetools-image-acceptance-20261028`, compatibility date
`2024-12-01` and `enable_request_signal`, with `workers_dev: false`, `preview_urls: false`,
observability disabled, no routes, no environments, no resources or production bindings.
No Dynamic Workers, storage, paid feature, or production service binding is introduced.
The name is unique relative to the product's two configured names; account-wide name vacancy
must be confirmed before authorizing a hosted session. Rerunning preparation never overwrites a
session. The generated directory is not a published target or workflow entry.

Each preparation creates a random 32-byte token in ignored `token.txt` and `.dev.vars`, and a
fixed deadline 15 minutes after preparation. Tokens are neither embedded in the bundle nor printed.
The wrapper requires the token, rejects an absent/mismatched/expired deadline, and caps authenticated
attempts at 128 per isolate. The client reserves at most 128 requests across invocations in a local
ledger and holds an exclusive lock. A killed client leaves its lock: use a fresh session.
Without storage, the wrapper counter cannot be global across isolate restarts; the fixed deadline
survives those restarts. Do not use a second client or bypass the driver budget.

Only `POST /acceptance/thumbnail` and `POST /acceptance/extract[?maxDimension=N]` are accepted.
The wrapper leases one fixture, reads at most 5 MiB + 1 byte, and retains its lease until the real
product dispatch settles, including cancellation/failure. All outbound `globalThis.fetch` calls
are denied except an exact GET of `https://cdn.discordapp.com/acceptance-fixture` while a fixture
is active. That GET returns the current uploaded fixture; it never resolves Discord or reads user
data. No reference to the original network fetch is retained. Use benign local test fixtures only.

The candidate request uses `https://image-worker.internal/thumbnail` or `/extract` with the
original incoming signal and the product's expected body/headers. Product admission, 5 MiB cap,
dimension checks, processors, output dimensions, statuses and body bytes remain active. The raw
response body is forwarded without re-encoding. Only boot identity and read-only capacity of the
already initialized Photon singleton are added as response headers; there is no second initializer,
processor replacement, GC forcing, memory limit override, or hidden artifact substitution.
Wrapper failures have generic bodies. Product error bodies are preserved for baseline comparison.

Wrapper fixture retention, stream copies and request construction add conservative allocations;
this is not the exact production JS allocation profile. A stable WASM capacity is not total isolate
memory, a continuous maximum, or proof of a platform memory limit. The wrapper lease does not
bound unread response bodies or requests in other isolates. Boot changes invalidate a warm client
sequence; the client records that failure. No peak-memory guarantee is asserted.

## Exact proposed workload

The separately reviewed proposal is 42 sequential requests: three identical valid-format rounds,
24 extraction and 18 thumbnail requests, with sequence SHA256
`e84a0b3d62bf4bbcbb3df0e00a8eecb71ea60be6898e7f11367b094fcc196eb0`.
Its [normalized receipt](../../remediation-image-readiness-sequence-2026-10-28.json) records input
and expected-output hashes and provenance. The executable sequence is in the ignored readiness
folder `canary/approved-sequence.json`; it does not authorize hosted execution. Use that exact
reviewed file for a separately approved hosted run, not the tiny local example below.

One local plain and one observed run pass all 84 responses. The observed sum reaches
146,092,141 bytes despite stable 107.25 MiB WASM. This is not a Cloudflare accounting formula or
continuous peak, and the proposal is not a production-headroom acceptance. Stop and retain the
hold if suitable hosted enforcement evidence remains unavailable.

## Local preparation and review

Run the following in **PowerShell** from the assigned checkout. Choose a new session folder on
each run. Preparation is deliberately short-lived: finish review first, then regenerate immediately
before an approved run. Paths below use the currently assigned worktree explicitly.

```powershell
$canaryRoot = 'C:/dev/XIVProjects/xivdyetools/.claude/worktrees/release-image-readiness-20261028'
$canaryScripts = "$canaryRoot/docs/audits/2026-10-26-security/evidence/scripts/image-acceptance-2026-10-28"
$canarySession = "$canaryRoot/.superpowers/sdd/2026-10-28-image-release-readiness/canary/review-01"
$canaryAccountId = '<32-hex-account-id>' # Replace with the explicitly approved account ID.
$env:CLOUDFLARE_ACCOUNT_ID = $canaryAccountId
Set-Location -LiteralPath $canaryRoot
node "$canaryScripts/prepare-canary.mjs" "--source-root=$canaryRoot" "--output-dir=$canarySession" "--account-id=$canaryAccountId"
Get-Content -LiteralPath "$canarySession/wrangler.json"
Get-Content -LiteralPath "$canarySession/provenance.json"
```

Never print `token.txt` or `.dev.vars`. Windows file mode bits do not establish Windows ACLs;
these files rely on the existing private checkout permissions and Git ignore rules.

Before any Wrangler dry-run or hosted startup, run this read-only account preflight. Confirm that
`whoami` succeeds and lists the exact pinned account as accessible to the current CLI identity.
Confirm its account-wide canary name is vacant using read-only account evidence. If the account
differs, is inaccessible, or cannot be verified, **STOP**; do not log in, upgrade a plan, change policy,
create credentials, or select another account automatically. Keep identity output private.

```powershell
$canaryConfig = Get-Content -Raw -LiteralPath "$canarySession/wrangler.json" | ConvertFrom-Json
if ($canaryConfig.account_id -cne $canaryAccountId) { throw 'Pinned account mismatch; stop.' }
$env:CLOUDFLARE_ACCOUNT_ID = $canaryConfig.account_id
$env:WRANGLER_SEND_METRICS = 'false'
pnpm --filter xivdyetools-image-worker exec wrangler whoami
if ($LASTEXITCODE -ne 0) { throw 'Account preflight failed; stop.' }
```

`CLOUDFLARE_ACCOUNT_ID` must equal generated `account_id` in every terminal used below. Verify
the account listing manually before continuing; successful authentication alone is insufficient.

A local bundle dry-run (documented only; no upload, no activation):

```powershell
$env:WRANGLER_SEND_METRICS = 'false'
$env:CLOUDFLARE_ACCOUNT_ID = $canaryAccountId
pnpm --filter xivdyetools-image-worker exec wrangler deploy --dry-run --config "$canarySession/wrangler.json" --outdir "$canarySession/dry-run"
```

Local proxy and driver, in separate terminals with the same path variables:

```powershell
$env:WRANGLER_SEND_METRICS = 'false'
$env:CLOUDFLARE_ACCOUNT_ID = $canaryAccountId
pnpm --filter xivdyetools-image-worker exec wrangler dev --local --config "$canarySession/wrangler.json" --ip 127.0.0.1 --port 8787 --inspector-port 0 --log-level error
```

```powershell
node "$canaryScripts/run-canary.mjs" "--session=$canarySession" --proxy=http://127.0.0.1:8787 "--sequence=$canaryRoot/.superpowers/sdd/2026-10-28-image-release-readiness/canary/tiny-sequence.json"
```

The ignored `canary/local-controls.mjs` is the bounded local safety-check harness for this review.
It starts only local Miniflare with network egress denied and telemetry disabled. Its local inspector
checks outbound denial and advances the clock for expiry; no debug route is added to the wrapper.
It uses the existing final `small.png` fixture and established output hashes on both routes, then
checks the driver's loopback receipts. It also checks authentication, busy admission and budget.
Run only after the coordinator's full serial gate completes; it is not the image matrix:

```powershell
node "$canaryRoot/.superpowers/sdd/2026-10-28-image-release-readiness/canary/local-controls.mjs" "$canarySession"
```

## Explicit sequence format

The JSON file is an array of 1–128 explicit requests. Fixture paths resolve relative to that JSON.
Each row requires `fixture`, `route` (`thumbnail`/`extract`), `inputSHA256`, `outputSHA256`, `status`,
and `responseBytes`; successful responses additionally require `width` and `height`.
`maxDimension` is optional for extraction. Supply actual lowercase 64-digit hashes, not placeholders.
The safety harness writes `tiny-sequence.json` from existing `candidate-runtime/final` fixture and
response receipts. A broader hosted sequence must be explicitly assembled from reviewed finite
final fixture/result manifests, preserving their hashes and extraction size options.

The driver accepts only a bare HTTP loopback proxy origin with explicit port, forbids redirects,
serializes requests, checks all hashes/lengths/statuses/dimensions and boot identity, bounds response
reads, and has a per-request timeout of at most 60 seconds within the session deadline. It saves
only numeric/hash receipts and boot IDs under the ignored session folder, never images or tokens.
No whole-matrix, concurrency, or service-binding behavior claim follows from its sequential checks.

## Remote command — HELD for any further session

After approval, stop the local proxy, prepare a fresh named session with the approved account ID,
repeat the read-only account preflight, verify its hashes/config, and
start this command manually. Wrangler uploads code to a temporary hosted preview environment;
this is a network write even though no production deployment is performed. `.dev.vars` beside the
generated config supplies the session token/deadline to development only. Do not add a route,
turn on `workers_dev`/preview URLs, or run `wrangler deploy` to work around a preview failure.

```powershell
$env:WRANGLER_SEND_METRICS = 'false'
$env:CLOUDFLARE_ACCOUNT_ID = $canaryAccountId
pnpm --filter xivdyetools-image-worker exec wrangler dev --remote --config "$canarySession/wrangler.json" --ip 127.0.0.1 --port 8787 --inspector-port 0 --log-level error
```

Run the same driver against `http://127.0.0.1:8787` only. Stop Wrangler immediately after the
finite sequence, or at the deadline; stop it on any unexpected public access or configuration
behavior. Keep generated artifacts immutable during remote dev, which otherwise reuploads edits.
The 15-minute wrapper deadline does not stop Wrangler itself. No active hosted target exists until
that separately authorized command starts.

[Cloudflare local development](https://developers.cloudflare.com/workers/local-development/)
states that `--remote` runs code on Cloudflare and uploads it to a temporary preview environment;
it recommends remote testing for network-specific behavior. This supports a hosted experiment
when local evidence cannot settle platform enforcement. It does not document preview telemetry or
all limits as identical to production. [Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
defines `dev --remote` as execution in a Cloudflare preview environment.
[Platform limits](https://developers.cloudflare.com/workers/platform/limits/)
describes the production memory limit and resource-limit failures. None of these sources establishes
that capacity headers, a successful preview response, or local inspector aggregate counters close
this release's aggregate-memory/platform gate. That gate remains open until the coordinator can
name and verify suitable hosted evidence; a canary may remain insufficient.

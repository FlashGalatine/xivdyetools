# Regenerating acquisition data

`apps/api-worker/scripts/build-acquisition.ts` is a manual maintenance tool. Normal builds and API requests do not run it. Source-selection rules live in `scripts/acquisition/`; unknown acquisition evidence remains blank. [XIVAPI translation priority](../reference/ffxiv-terminology.md) applies to supplied game-data names, while acquisition wording and vendor selection remain curated policy.

## First schema enrollment

Historical metadata recorded a Teamcraft commit and game version, but lacked a schema. Such legacy inputs fail `--pinned` before HTTP until an explicit canonical schema is supplied. Choose a verified `exdschema@2:rev:<40 lowercase hex digits>` for the recorded game version. This verifies a new regeneration; it does not retroactively prove which schema created historical data. The currently committed metadata has been enrolled after a complete unchanged-data regeneration and offline replay; the schema field describes that verified regeneration.

From the repository root, use separate temporary output and cache directories. Replace the placeholders with real paths and a verified schema revision:

```powershell
pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts --pinned --schema exdschema@2:rev:<40hex> --cache-dir <cache-dir> --out-dir <candidate-dir> --check-unchanged
```

For legacy metadata, acquisition and facewear bytes must match the committed source files exactly before any output is adopted. Candidate metadata adds `xivapiSchema`, preserves the recorded game/Teamcraft pins and generation date, and retains generated counts. Review the candidate files and provenance before committing metadata. Never select today's `latest` as a substitute for a missing historical pin.

## Offline replay

Replay the captured immutable inputs with network disabled:

```powershell
pnpm exec tsx apps/api-worker/scripts/build-acquisition.ts --pinned --schema exdschema@2:rev:<40hex> --cache-dir <cache-dir> --out-dir <replay-dir> --offline --check-unchanged
```

Once adopted metadata records the schema, omit `--schema`; a supplied override must equal the recorded value. Offline mode requires both immutable pins and a cache directory. The cache key is the SHA256 of the full request URL, including game/schema selectors, cursor, fields and row selection. Each envelope holds that URL and raw JSON response text. Every replay revalidates the envelope, response pins and basic payload shape. Cache misses, corruption or mismatched provenance fail; there is no live fallback. Cache files are written atomically. If a run still reports a malformed or invalid cache envelope, delete the file it names and rerun online to re-download it. Caches are local maintenance artifacts, not runtime caches or committed game data.

Mutable game/schema and Teamcraft-head discovery are never cached. A normal live run without `--pinned` intentionally resolves current upstream inputs and may refresh data; use it only for a separately intended data update. With complete recorded pins, `--pinned` retains the existing rule-change workflow. Add `--check-unchanged` to require identical acquisition and facewear outputs; the guard is mandatory for legacy schema enrollment.

## Failure and adoption boundary

- Every sheet/search response must match the fixed canonical pair, including cursor pages and final review requests. Missing or conflicting metadata fails the run.
- Each HTTP attempt has a 30-second header/body deadline and a 64 MiB body ceiling. Retryable server errors have at most three attempts. XIVAPI 503 and HTTP 429 stop clearly for a later manual retry.
- Missing/incomplete payloads and explicitly unsupported pagination fail. Existing acquisition, facewear and metadata files remain unchanged on upstream, validation or review failures.
- All upstream review requests finish before output writes begin. Filesystem writes themselves are sequential, not a transactional multi-file operation; use temporary candidate outputs and inspect them before adoption.
- `--fixture IDS` continues to capture normalized test inputs; it cannot be combined with offline mode or an output-directory override. Unknown, repeated or valueless CLI options fail before network access.

The schema-pinning change must preserve source-selection rules, direct Poetics purchase routes, translation coverage, stable IDs and deliberately empty acquisition lines. A detected data difference needs its own reviewed update; do not weaken the replay guard to get a green run.

## What a table refresh can trip

The web app's Glamour list has an Abridged form that keeps one source per piece (rules in `apps/web-app/src/shared/glamour-abridged.ts`). `apps/web-app/src/shared/__tests__/glamour-abridged.test.ts` reads `apps/api-worker/src/chara/data/acquisition.en.json` and runs every line through those rules. CI's always-run step runs it even on an api-worker-only push, so a refresh fails in its own pull request instead of on the next web-app one.

What it checks:

- The table still has more than 24,000 lines, and every line abridges to something non-empty.
- Invariants over the whole table: no priced bracket survives unless it is Gil, a multi-part result holds no craft or priced vendor, and every result part came from its input line.
- **The pinned drops.** Only the instance rule's drops are pinned: a line with two or more parts that Abridged shortens to untouched parts, none of them a craft or a priced vendor, is listed in `glamour-abridged-drops.json` beside the test with its result, and the computed map must equal the file. A new, removed or reworded line of that kind fails it, and so does a rule change that alters one of those results. Lines cut down to a craft or a vendor are not pinned, and those are most of the drops: a new one, or a rule change that alters one, fails only if it breaks an invariant above or one of the test's worked examples.

If it fails:

1. Read the new or changed line against the rules in `glamour-abridged.ts`: lowest-difficulty instance, else craft, else Gil vendor, else other vendor without its price, else the line as written.
2. If the line has a form the rules do not know (a new kind of non-instance such as a new coffer, quest or program, or a new map dungeon), teach the rules in `glamour-abridged.ts` first. The non-instance lists and the map-dungeon set are there. Add a case to the test's examples.
3. Then update `glamour-abridged-drops.json` to the new result (the test's diff shows the entries) once you agree with each one.

Do not loosen the invariants or edit the JSON alone to get a green run.

# FINDING-049: publish job grants id-token: write to every step, including pnpm install, turbo build and vitest runs of dev-tree code
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** CI + repo settings (publish-packages.yml, npm trusted publisher for @xivdyetools/*) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-269

## Location
- `.github/workflows/publish-packages.yml:102` — publish job grants id-token: write to every step, including pnpm install, turbo build and vitest runs of dev-tree code

## Evidence
- publish-packages.yml:101-104 `environment: production` / `permissions: contents: read, id-token: write` on job `publish`; :123 `pnpm install --frozen-lockfile`; :133 `pnpm turbo run build $FILTER_ARGS`; :143 `pnpm turbo run test $FILTER_ARGS`; :196 `pnpm --filter "$pkg" publish --provenance --access public --no-git-checks`.
- Reach: A maintainer dispatches "Publish Packages to npm" on main. Every step of job `publish` then has ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN, so a compromised devDependency running during install (:123), the tsup/tsc build (:125-133) or the vitest run (:135-143) could mint the npm OIDC token for this workflow and environment.
- Lines 102-104 grant `id-token: write` at job level, and the same job runs `pnpm install --frozen-lockfile` (:123), `turbo run build` with `--filter=pkg...` (:133) and `turbo run test` (:143) before `pnpm publish --provenance` (:196). That lets build- or test-time code publish arbitrary versions of any @xivdyetools package that trusts this workflow. The precondition is a separate supply-chain compromise, which allowBuilds (pnpm-workspace.yaml:50-53, every install script rejected), minimumReleaseAge 1440 (:59), the frozen lockfile and the main-only `production` environment (:101) all reduce, so this is defense-in-depth with no direct… Preconditions: A malicious or compromised devDependency (tsup, esbuild, vitest, a plugin, or a transitive dependency) that is at least 24 hours old (minimumReleaseAge) gets into the frozen lockfile and executes at build or test time. A maintainer then dispatches the publish workflow from main.
- Live state the repo cannot show: The npm trusted-publisher config (workflow publish-packages.yml plus environment `production`) and the `production` environment's branch policy and reviewers live on npmjs.com and in GitHub settings. The repo says main-only (2026-10-03 report :118), but that was not re-read here.

## Fix
- Split the work into two jobs. A `build` job with no id-token builds, tests and runs `pnpm pack` to tarballs, then uploads them as an artifact. A minimal `publish` job with `environment: production` and `id-token: write` downloads them and publishes them with no install or build. This does not stop a build-time compromise from tampering the tarballs, but it removes that code's ability to mint a publish credential for…

## Status
OPEN

# Current secret-hit and PII cross-sweep review

**Scope:** manual review of all **172** redacted entries in this audit's `evidence/potential-secrets.txt`. Each recorded file and current exact line was read; no token-like value is reproduced here.

## Secret-pattern classification

| classification | count | confirmed context / disposition |
|---|---:|---|
| Test fixtures, assertions, and test helpers | 141 | Synthetic credential-shaped inputs or expected redaction/signing behavior; no plausible live credential. |
| Documentation, historical audit evidence, and reproductions | 20 | Explanatory examples, prior findings, or redaction repro material; no credential value. |
| Operational scripts | 7 | Environment-variable references, placeholders, or parser token terminology; no committed credential. |
| CI configuration | 2 | Secret-name/exemption documentation or an expression that only tests secret presence; no value committed. |
| Production source | 2 | `apps/oauth/src/handlers/xivauth.ts:35` is an OAuth token-endpoint constant; `apps/web-app/src/services/auth-service.ts:83` is a browser storage-key identifier. Neither is a credential. |
| **Plausible live credential** | **0** | No safe suspected entry to list. |

The current inventory's 172 referenced lines all exist in the checked tracked source tree. Configuration hits include only references such as `apps/discord-worker/scripts/upload-emojis.ts:20,102`, `apps/discord-worker/scripts/register-commands.ts:51-52`, `apps/moderation-worker/scripts/register-commands.ts:131-132`, `.github/workflows/ci.yml:106`, and `.github/workflows/deploy-discord-worker-beta.yml:58`; none contains a committed credential.

## PII source-to-sink reconciliation

- Read the current inventories: 929 candidate sinks and 1,854 candidate sources. Targeted intersections covered logs, analytics writes, and storage calls for persistent IDs, names, email, URL/query values, bodies, option values, guild/channel IDs, user agents, and IPs.
- No additional high-signal PII crossing into a prohibited log, analytics, or storage sink was established. The known OG crawler URL/User-Agent log was excluded because the OG review owns it.
- `apps/discord-worker/src/index.ts:800,845` logs a Discord `userId`, but this is a policy-listed pseudonymous identifier for command preferences, rate-limiting, and usage; it corrects the Discord review's blanket identity-log wording and is not a vulnerability.
- Targeted production-log review found no confirmed username, guild/channel ID, option value, or free-text sink. Discord error response bodies at `apps/discord-worker/src/utils/discord-api.ts:268-270,313-315` were not reported because the reviewed path does not establish user-supplied text in those responses.

## Controls, coverage, and limits

- The Discord analytics schema uses categorical/bucket fields; web-browser console calls are not a remote production logging sink.
- Gitleaks was unavailable. This is a manual current-tree pattern review, not a full-history scan; no local `.dev.vars`/`.npmrc`, untracked application configuration, production probe, install, or source edit was inspected/performed.

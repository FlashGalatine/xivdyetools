# FINDING-048: Resolve-API response adopted without per-field shape validation (hardening only)
**Severity:** INFO · **Exposure:** INTERNAL · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-20

## Location
- `apps/web-app/src/services/chara-resolve-service.ts:226` — Resolve-API response adopted without per-field shape validation (hardening only)

## Evidence
- chara-resolve-service.ts:226-230 `items: { ...outOfRange, ...envelope.data.items }, glasses: envelope.data.glasses ?? null`; glamour-block.ts:1001 `tile.style.backgroundImage = `url("${charaIconUrl(item.iconId)}")``; xivapi.ts:179 `if (typeof id === 'number' && Number.isFinite(id) && id > 0) return id;`; xivapi.ts:243 `rowId: raw.row_id,`
- Reach: Only first-party api-worker's POST /v1/chara/resolve answer (or its upstream XIVAPI rows / its own KV cache) can supply the unvalidated fields; no browser user or internet client controls that body. A malformed iconId/itemId/name would then flow into glamour-block.ts:1001/1178/1328 style.backgroundImage, item-links.ts garlandToolsUrl/teamcraftUrl, and name rendering.
- chara-resolve-service.ts:216-230 checks only success===true and that data.items is a non-null object, then spreads items/glasses/version into the session cache unchecked, unlike the field-by-field inspection-protocol validation. Server side, iconIdOf (api-worker/src/chara/xivapi.ts:175-182) admits only finite positive numbers, while rowId (xivapi.ts:243, raw.row_id) is TS-typed only, so a bad value needs XIVAPI or api-worker itself to misbehave. Sinks are bounded: CSSOM single-property assignment, fixed https:// prefixes on link builders (no scheme change), no innerHTML of resolved data in glamour-block (only a static icon at :588)… Preconditions: api-worker (first-party), its chara KV cache, or upstream XIVAPI must emit a non-number iconId/itemId or a hostile name string; iconId is already filtered server-side, itemId (row_id) is not runtime-checked server-side but comes from XIVAPI's fixed base.
- Live state the repo cannot show: None for the verdict; would only escalate if the deployed api-worker or its KV cache were compromised.

## Fix
- Validate the envelope like chara-inspection-protocol does: per slot accept null or {itemId: positive int, iconId: positive int|null, names: strings}, same for glasses; drop anything else to null.
- Optionally also assert Number.isInteger(raw.row_id) in api-worker parseItemRow.

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; local full-repository verification and affected CI/beta pass; prerequisite publication and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md).

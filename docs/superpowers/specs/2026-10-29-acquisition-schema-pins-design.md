# Acquisition generation schema pins

**Status:** implemented and verified; awaiting PR integration. Approved scope from the user's instruction to proceed with the [#322 recommendation](https://github.com/FlashGalatine/xivdyetools/pull/372). [Verification receipt](../../research/2026-10-29-acquisition-schema-pins/README.md).

The acquisition generator must use one canonical game version and one canonical XIVAPI schema revision throughout a run, including search cursors, row batches and the final review requests. Validate response provenance before using or caching it. Record the pair in generated metadata. Explicit replay never falls back to moving selectors or a live fetch when offline.

Approaches considered: keep the current version-only requests (does not reproduce a schema); capture both pins while retaining live-only generation (cannot prove an offline replay); capture both with an optional exact-request cache (selected to satisfy the approved replay acceptance criteria). Keep the helper private to maintenance scripts and avoid runtime changes or dependencies.

Preserve the committed acquisition table, facewear mapping, game version, Teamcraft commit, curated rules and deliberately blank lines. A legacy schema enrollment must reproduce the committed data bytes before adoption; subsequent rule changes retain the existing pinned-input workflow, with an optional unchanged-data check. Existing metadata lacks schema provenance: require an explicit canonical schema for its first verified regeneration, rather than retroactively inventing provenance. Complete all upstream review work before writing outputs. Filesystem write failures are outside this upstream-failure guarantee.

An optional cache directory stores immutable request/response pairs under full-URL identities, including canonical pins. Offline mode requires complete explicit pins and a cache directory; missing, malformed or mismatched cache entries fail. Use finite request/body limits; retain bounded retries for server failures and fail 429/503 clearly. Mutable discovery is separate from immutable replay.

The user also ruled that XIVAPI is authoritative for game-data translations it supplies. Record that rule in the living maintainer guide. Global data gaps retain regional sources. Name/color data adoption and replacement of the older name-fetch script remain separate work.

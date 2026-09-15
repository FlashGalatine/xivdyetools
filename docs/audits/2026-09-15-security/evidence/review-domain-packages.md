# Domain package review
**Scope:** `core`, `svg`, `bot-logic`, `types`, `test-utils`; tracked source only at `0332fcc5`.
## Candidates
No candidate verified.
## Positive controls
- Core `.chara` parsing (`services/chara/chara-parser.ts`) parses only JSON, validates a sparse known model, and is paired with caller byte caps; dye initialization deep-clones without `__proto__`/`constructor`/`prototype` keys.
- Core lookup tables use own-property checks; public algorithm inputs are bounded/normalized by consumers, while the bundled data has no runtime fetch or mutable user storage.
- SVG centralizes XML escaping in `svg/src/base.ts:29` for text and attributes; numeric helper output is used for geometry, so attacker text cannot form markup/attributes or URLs.
- Bot logic routes user echo through shared sanitizers/Discord markdown handling and normalized dye input; it neither persists input nor fetches caller-controlled URLs.
- Types are declarations/validators rather than storage or sinks; test-utils is workspace-private mocks/factories only, with JSON parsing confined to test-memory KV/R2 emulation and no deploy/runtime artifact.
## Rejected suspicions
- Prototype pollution via chara/dye/locale maps, SVG/XML injection, unbounded SVG link attributes, consumer-reachable algorithmic DoS, type-level PII disclosure, and test-helper production secret paths were not reachable.
## Coverage and limits
- Meaningfully inspected 49 production TS files: core parser/resolver/dye/localization/API/input utilities; all SVG emitters plus base/frame/icons; bot-logic commands/input/markdown/i18n; public type entrypoints; all test-utils source. Read five package CLAUDE files. No tests/probes/source edits; caller-side body limits and renderer runtime behavior were not exercised.

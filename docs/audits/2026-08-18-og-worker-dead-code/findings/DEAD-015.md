# [DEAD-015]: `generateSwatchOG` is `async` "for call-site stability" with an eslint-disable, but nothing in it awaits and its only caller is one line away

## Category
Legacy Code

## Location
- `src/services/svg/swatch.ts:43-48`
- `src/index.ts:520` (`await generateSwatchOG(...)`)

## Evidence
The `async` survived from the v1 card, which awaited `getCharacterColorFromSheet` (DEAD-002). The 15E body is fully synchronous; the file carries an `// eslint-disable-next-line @typescript-eslint/require-await` to keep the lint quiet — and this worker has no lint script anyway (CLAUDE.md: "There is no `lint` script"). "Call-site stability" protects one `await` in a file the same commit can edit. CLAUDE.md still describes it as "`generateSwatchOG()` — async, may consult color sheets".

## Recommendation
**REMOVE** the `async` + the eslint comment; drop the `await` in index.ts; make the swatch tests' `await` optional (they still pass with a plain value). Update the CLAUDE.md file-map line.

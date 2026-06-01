# DEAD-108: Candidate unused devDependencies

## Category
Unused Dependency

## Location
- File(s): `apps/web-app/package.json` (`devDependencies`)
- Symbol(s): `@testing-library/dom`, `@testing-library/user-event`, `@xivdyetools/test-utils`

## Evidence
None of these three packages is imported anywhere in `src/` or `e2e/` (grep across the full corpus returned zero `import`
statements):
```
@testing-library/dom        : 0 imports
@testing-library/user-event : 0 imports
@xivdyetools/test-utils      : 0 imports
```
The unit tests use the local helpers in `src/__tests__/component-utils.ts` + `msw` for network mocking, not `@testing-library`.
`@xivdyetools/test-utils` (CF Workers mocks/factories) is a workspace devDep that this app does not consume.

## Why It Exists
Likely added in anticipation of a testing-library-based component-test approach that the project did not adopt
(`component-utils.ts` fills that role instead), and the workspace `test-utils` was added by convention.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — zero imports, but confirm before editing package.json |
| **Blast Radius** | LOW — devDependencies only; no runtime impact |
| **Reversibility** | EASY — re-add to package.json |
| **Hidden Consumers** | A vitest setup file or transitive re-export could pull them — verify with a build + `pnpm why` |

## Recommendation
**REMOVE** — after verification

### Rationale
- Trims three unused devDependencies; smaller install graph.

### If Removing
1. `pnpm --filter xivdyetools-web-app why @testing-library/dom @testing-library/user-event @xivdyetools/test-utils`.
2. Remove the three from `devDependencies`; `pnpm install`.
3. `pnpm --filter xivdyetools-web-app run test && run build` to confirm nothing breaks.

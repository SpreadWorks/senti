# Tests for 165-fix-datasource-match-monorepo

## What was tested and why
- `match(relPath)` monorepo nested-path regression behavior for affected preset DataSources.
- Goal: ensure nested paths like `apps/backend/src/...` match when equivalent root-level paths match.
- Goal: reject look-alike non-target segments (e.g. `ControllerX` vs `Controller`).

## Coverage audit (`match(relPath)` presets)
- Updated in this spec:
  - `cakephp2`: `config`, `email`, `libs`, `tests`, `views`
  - `laravel`: `commands`, `config`, `controllers`, `models`, `routes`, `tables`
  - `nextjs`: `components`, `routes`
  - `symfony`: `commands`, `config`, `controllers`, `entities`, `routes`, `tables`
- Verified unchanged (already monorepo-safe or intentionally non-path-specific):
  - `base/package`
  - `cakephp2/commands`, `cakephp2/controllers`, `cakephp2/models`
  - `cli/modules`
  - `drizzle/schema`
  - `edge/runtime`
  - `github-actions/pipelines`
  - `graphql/schema`
  - `hono/middleware`
  - `r2/storage`
  - `webapp/commands`, `webapp/controllers`, `webapp/models`, `webapp/routes` (`match()` always `false`)
  - `workers/bindings`

## Test locations
- Formal tests (`npm test` target):
  - `tests/unit/presets/monorepo-match-regression.test.js`
- Spec artifact documentation:
  - `specs/165-fix-datasource-match-monorepo/tests/README.md` (this file)

## How to run
- Single test file:
  - `node --test tests/unit/presets/monorepo-match-regression.test.js`
- Unit suite:
  - `npm run test:unit`
- Full suite:
  - `npm test`

## Expected results
- Before implementation: new regression test fails for nested paths currently checked with root-anchored matching.
- After implementation: regression test passes, root-level behavior remains unchanged, and look-alike paths are rejected.

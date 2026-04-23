# Tests for spec 221 (persist-user-approval)

Tests live in the formal `tests/` tree because they verify public CLI / module
contracts (`spec render`, schema, `flow set approval`) — any future regression
of these behaviors is a bug regardless of which spec introduced them.

## Test files

- `tests/unit/spec/render-user-approval.test.js` — verifies the renderer derives
  `## User Confirmation` from `spec.user_approval` (R1, R2, R3, idempotency AC).
- `tests/unit/spec/spec-user-approval-schema.test.js` — verifies the spec.json
  schema accepts an optional `user_approval` object and rejects unknown
  sub-properties / wrong types (R4, AC for unknown sub-property rejection).
- `tests/unit/flow/set-approval.test.js` — verifies the `sdd-forge flow set
  approval` CLI updates `spec.json.user_approval`, auto-fills `confirmed_at`,
  honors `--notes` / `--confirmed-at`, errors with no active flow, and errors
  when `--approved` is omitted (R5, R7, related ACs).

## How to run

```bash
node tests/run.js \
  tests/unit/spec/render-user-approval.test.js \
  tests/unit/spec/spec-user-approval-schema.test.js \
  tests/unit/flow/set-approval.test.js
```

Or run the full unit + integration suite:

```bash
npm test
```

## Expected results

All tests should PASS once the spec 221 implementation lands. Before
implementation, all 9 newly added tests fail (test-first).

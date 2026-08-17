# Tests for spec 225 — auto-check omnibus fix

## What was tested

### R1 — G_KEYWORDS 縮減
- `tests/unit/flow/auto-check-static.test.js` (formal tests)
- Retained 9 keywords hit: `password`, `credential`, `secret`, `token`, `authentication`, `npm publish`, `破壊的`, `パスワード`, `認証情報`
- Removed 14 keywords do NOT hit: `security`, `auth`, `migration`, `migrate`, `delete`, `drop`, `destructive`, `release`, `認証`, `トークン`, `資格情報`, `マイグレーション`, `削除`, `リリース`
- False positive demonstrations: `author` / `deleted line` / `migration guide` are now benign
- H_KEYWORDS and I_INVERSIONS regression (unchanged)
- Composite eligible verdict

### R2 — fetch-issue helper
- `tests/unit/flow/fetch-issue.test.js` (formal tests)
- `strict: true`: returns shape on success, throws on gh non-zero / parse error / missing binary
- `strict: false`: returns shape on success, returns null on failure, emits exactly 1 line of stderr warning
- Coverage via PATH-based fake `gh` shell script

### R3 — get-issue refactor
- Existing `get-issue` tests (if any) and envelope behavior regression via e2e flow tests
- No dedicated new file (R3 is pure refactor; external contract unchanged)

### R4, R5, R6 — md language handler and generic pipeline
- `tests/unit/docs/lang-md.test.js` (formal tests)
- minify: HTML comment removal (single/multi-line), image → alt, horizontal rule removal, blank line collapse (3+ → 1 blank), trailing whitespace, `<details>` preservation, realistic fragment
- truncate: default 20_000 chars + `\n... (truncated)` suffix, explicit max, boundary handling
- lang-factory dispatch: `any.md` resolves to md handler
- `preserveBlankLines === true` is exported
- Generic pipeline: md respects preserveBlankLines (blank lines kept); js still loses blanks (regression)

### R10 — resolve-auto-check-input Issue body incorporation
- `tests/unit/flow/resolve-auto-check-input.test.js` (formal tests, additive)
- Preparing mode with `state.issueBody` → body in AI input
- Active mode with `specs/<spec>/issue.md` → file content in AI input
- Active mode without issue.md → fallback to `Issue #<n>` literal
- Preparing mode without issueBody → fallback
- Empty issueBody treated as absent

### R7 / R8 / R9 / R10 end-to-end — init → prepare → auto-check
- `tests/e2e/issue-body-flow.test.js` (formal tests)
- Success path: gh stub outputs JSON, preparing state gets issueBody, prepare creates issue.md, auto-check prompt includes body (captured via stub agent)
- Failure path: gh stub exits non-zero, init completes without issueBody, prepare does not create issue.md, auto-check still completes (silent fallback to request + `Issue #<n>`)

## Where tests live

- Formal tests: `tests/unit/flow/`, `tests/unit/docs/`, `tests/e2e/`
- Rationale: all behaviors are public API / CLI contract and should break the build on regression regardless of this spec

## How to run

```bash
# All project tests
npm test

# Just the new / touched files
node --test tests/unit/flow/auto-check-static.test.js \
  tests/unit/flow/fetch-issue.test.js \
  tests/unit/docs/lang-md.test.js \
  tests/unit/flow/resolve-auto-check-input.test.js \
  tests/e2e/issue-body-flow.test.js
```

## Expected results

Before implementation: all new tests FAIL (modules / behaviors do not yet exist).
After implementation: all tests PASS. Existing `auto-check-static.test.js` content was replaced per `authorized_test_modifications` in spec.json because R1 deliberately changes which keywords hit.

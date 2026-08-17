# Tests: spec 156 — gate draft format detection pattern relaxation

## What was tested and why

`checkDraftText()` in `src/flow/lib/run-gate.js` currently only accepts colon format
(`**開発種別:** ...`, `**目的:** ...`) for the development type and goal fields.
These tests verify that the fix extends detection to also accept `## heading format`.

## Test location

`specs/156-fix-gate-draft-format-pattern/tests/check-draft-text.test.js`

Placed in spec-local tests (not `tests/`) because these tests verify this spec's specific
regression fix. A future intentional pattern change may make heading-format behavior differ,
and a FAIL in that context would not necessarily indicate a bug.

## How to run

```bash
node --test specs/156-fix-gate-draft-format-pattern/tests/check-draft-text.test.js
```

## Expected results (after implementation)

All 11 tests should PASS:

- Tests 1–2: colon format (existing) → PASS ✓
- Tests 3–4: `## 開発種別` / `## Development Type` heading format → PASS ✓ (requires fix)
- Tests 5–6: colon format goal (existing) → PASS ✓
- Tests 7–8: `## 目的` / `## Goal` heading format → PASS ✓ (requires fix)
- Test 9: both fields in heading format → PASS ✓ (requires fix)
- Tests 10–11: missing fields → FAIL as expected ✓

## Before implementation (initial state)

Tests 3, 4, 7, 8, 9 FAIL — heading format not accepted by current regex.

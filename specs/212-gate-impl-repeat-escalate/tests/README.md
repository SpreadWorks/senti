# Spec 212 — Tests

## Coverage

`tests/unit/flow/gate-repeat-escalate.test.js` covers all spec 212 acceptance criteria and requirements.

### Test groups

| Group | REQs | What it verifies |
|---|---|---|
| `normalizeReason` | REQ-6 | Reason-string normalization: trim, whitespace collapse, lowercase. Includes the AC-6 case `"  Foo Bar  "` vs `"foo   bar"` (equal) and `"foo bar"` vs `"foo baz"` (different). |
| `buildFailedEvaluations` | REQ-4 | Extracts only FAIL evaluations as `{ guardrail_id, reason }` pairs. |
| `findPreviousFailedEvaluations` | REQ-1, REQ-5 | Returns the most recent same-phase FAIL entry's `failedEvaluations`; ignores other phases and legacy entries without the field. |
| `assertNoRepeatedFail` | REQ-1, REQ-5, REQ-6 | Throws `ESCALATE_REPEATED_FAIL` on any pair match (1-of-N); no-throw on guardrail mismatch / reason mismatch / phase mismatch / missing prior field / no current FAIL. Envelope `err.data` shape (`phase`, `matched`) is asserted per REQ-3. |
| `appendIssueLogFromGateResult` | REQ-4 | Written `issue-log.json` entry includes both `failedEvaluations` (new) and flat `reason` (legacy). |

### Why REQ-2 (retry-counter non-consumption) has no dedicated test

The retry counter is incremented via `updateGateRetryCounter`, which is wired as a CLI-level post-hook that only runs on a *successful* command return. `assertNoRepeatedFail` throws from within `execute()` before return, which structurally prevents the post-hook from firing. The existing `tests/unit/flow/gate-retry-counter.test.js` suite already verifies that the counter is updated only via this post-hook path. No additional test is needed.

## How to run

```bash
# Run just this spec's tests
node --test tests/unit/flow/gate-repeat-escalate.test.js

# Or the full unit suite
npm test
```

## Expected results

All tests in `gate-repeat-escalate.test.js` should pass after implementation.

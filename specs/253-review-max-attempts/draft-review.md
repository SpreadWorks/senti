# Draft Review Results

8 issue(s) detected.

### 1. I’ll verify the draft’s claims against the actual review/gate code paths so the feedback is grounded in current behavior, not just the provided summary.The expected `src/` path is not at the current directory root, so I’m locating the repository layout inside this worktree before checking the cited files.This `.tmp` directory is empty, so I can’t independently inspect the source files from here without leaving the declared worktree boundary. I’ll base the review on the supplied codebase context and the draft’s internal consistency.### 1. Recovery CLI is scope creep and conflicts with project policy
**QA:** Q8  
**Issue:** The issue asks to enforce review `maxAttempts`, persist counts, fail on exhaustion, and reset on PASS. Q8 adds a new generalized `set retry-counter` CLI plus a backward-compatible alias, which is outside scope and conflicts with the repo’s alpha policy against backward compatibility code.  
**Suggestion:** Narrow Q8 to the minimum recovery expectation: either explicitly mark reset CLI as out of scope, or add only a review reset command if the issue owner requires it. Remove the alias/backward-compatibility requirement.

### 2. 2. Persistence test plan uses a non-mutating helper
**QA:** Q9  
**Issue:** The proposed E2E step says to call `checkReviewRetryBelowMax` five times and then expect `flow.json` to contain count `5`. A check helper should only read and return fail/null; it should not append metrics. This test would either fail or encourage the wrong implementation.  
**Suggestion:** Simulate failed reviews through `updateReviewRetryCounter`, the registry post hook, or direct `appendMetric`, then reload `flow.json` and assert `countReviewRetry === 5`.

### 3. 3. `--phase impl` rejection is asserted too early
**QA:** Q1  
**Issue:** The issue wording says `flow run review --phase <p>` and references phase-resolved `maxAttempts`. Q1 keeps `--phase impl` invalid and maps omitted `--phase` to `impl`, but this is a design decision, not clearly derived from the request. The “avoid breaking change” rationale is also weak given the repo’s alpha policy.  
**Suggestion:** Add an explicit QA entry asking whether `impl` must be accepted as a CLI phase. If rejected, justify it as preserving current command semantics, not backward compatibility.

### 4. 4. Task-scope exclusion is not fully proven
**QA:** Q2  
**Issue:** Q2 says no task-scope invocation path exists, but also says direct CLI execution ignores `currentTaskId`. That does not prove `currentTaskId` is absent; it proves the command currently does not branch on it. This affects claims like `taskId: null` and flow-scope-only max resolution.  
**Suggestion:** Reframe the answer: “`flow run review` always resolves review maxAttempts from FLOW_DEFINITION regardless of `currentTaskId`.” Add a test with `currentTaskId` set to ensure task maxAttempts are not accidentally used.

### 5. 5. Storage choice may not satisfy the issue literally
**QA:** Q3  
**Issue:** The issue explicitly says “Record review attempt counts in flow.json (e.g. `state.reviewAttempts`)”. Q3 stores only append-only metric events in `state.metrics` and reconstructs the count. That may be acceptable, but the QA treats it as settled without addressing the tradeoff against a direct `state.reviewAttempts` read model.  
**Suggestion:** Add a clear decision point: either confirm `state.metrics` is the intended persisted representation “equivalent to `state.reviewAttempts`”, or specify a materialized `state.reviewAttempts` shape if downstream consumers need direct counts.

### 6. 6. `taskId: null` in metric examples is unsupported
**QA:** Q3  
**Issue:** The examples hard-code `"taskId": null`, while the draft also discusses possible current task state. If `appendMetric` auto-populates taskId from flow state, review metrics could unintentionally become task-scoped.  
**Suggestion:** Specify whether review retry metrics must force `taskId: null`, or whether `countReviewRetry` ignores `taskId`. Add a test covering active-task state.

### 7. 7. Dry-run behavior is missing
**QA:** NEW  
**Issue:** `RunReviewCommand.execute` reads `ctx.dryRun`, but none of the QA entries define whether exhausted review attempts should block `--dry-run`, whether dry-run should mutate counters, or whether it should bypass the max check to show the command that would run.  
**Suggestion:** Add a QA entry defining dry-run semantics explicitly. Recommended: dry-run should not mutate counters; decide whether max exhaustion still returns `REVIEW_MAX_ATTEMPTS_EXCEEDED` or only reports the planned command.

### 8. 8. Post-hook failure handling may silently disable enforcement
**QA:** Q7  
**Issue:** Q7 catches `updateReviewRetryCounter` errors and only writes to stderr. If persistence fails, the review command can still appear successful while the retry budget is not recorded, weakening enforcement.  
**Suggestion:** Clarify whether counter persistence failure is intentionally non-fatal because it mirrors gate behavior. If enforcement is mandatory, make post-hook failures fail the command or add a separate invariant/test proving failed counter updates are surfaced.

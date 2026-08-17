# Draft Review Results

10 issue(s) detected.

### 1. 1. Redundant Enforcement Entries
**QA:** Q5, Q17  
**Issue:** Both entries cover the same “test execution only in test-execute” enforcement concern, but differ on static check scope: Q5 limits checks to known non-test files, while Q17 checks most of `src/flow/`.  
**Suggestion:** Merge into one QA entry and choose one enforcement scope. If broad scanning is intended, define the allowlist precisely and mention how false positives are handled.

### 2. 2. Redundant Header Coverage Entries
**QA:** Q6, Q13  
**Issue:** Both define missing-header and header-lie FAIL behavior. Q13 is mostly an implementation restatement of Q6.  
**Suggestion:** Merge them into one entry that covers semantics, verdict integration, retry/fix behavior, and prompt changes.

### 3. 3. Unsupported Flow Control for test-result-review Failure
**QA:** Q3  
**Issue:** The answer claims `test-result-review` FAIL is written with `status=done`, then the skill rewinds to `implement`. That is a major flow behavior decision, but the evidence does not show this is supported by the existing engine or requested by the issue. It also conflates “invalid executor report” with “implementation needs changes.”  
**Suggestion:** Split the cases: executor/report hallucination should probably rerun `test-execute` or `test-result-review`; real requirement failure should route through `gate-impl` and rewind `implement`. Add evidence from `set-step.js`, `gate-step.js`, or skill dispatcher behavior.

### 4. 4. Ambiguous Responsibility: “No Judgment” vs pass/fail Summary
**QA:** Q2, Q4  
**Issue:** Q2 says `test-execute` performs no judgment, but Q4 defines `test-execute-result.json.summary[].result` as `pass|fail` per requirement. That is still a judgment unless clearly defined as raw observed test outcome.  
**Suggestion:** Clarify that `test-execute` maps observed test results to requirement IDs, while `gate-impl` alone decides whether the implementation satisfies the spec. Or move requirement-level pass/fail derivation to `test-result-review`.

### 5. 5. Artifact Schema Is Over-Specified Without Evidence
**QA:** Q4  
**Issue:** The answer invents exact paths, JSON fields, and `raw_output_lines` requirements from limited evidence. The issue mentions a result schema, but the draft does not show that these exact fields are required.  
**Suggestion:** Reframe as a proposed minimum contract and explicitly mark fields that come from the issue versus fields introduced by this spec. Include how schema validation is implemented.

### 6. 6. Missing Coverage for Actual Agent Output Parsing
**QA:** NEW  
**Issue:** The draft says AI agents create result files, but does not cover how the command verifies that the agent actually wrote valid JSON, where malformed stdout/stderr is captured, or how partial files are handled.  
**Suggestion:** Add a QA entry for agent output parsing and artifact validation: required files, atomic write behavior, malformed JSON handling, and whether failure marks the step error or FAIL.

### 7. 7. Freshness Policy Relies Too Heavily on Step Status
**QA:** Q12  
**Issue:** The answer rejects artifact metadata and says downstream trusts `status=done`. That may miss stale files after manual edits, interrupted runs, branch changes, or copied specs.  
**Suggestion:** Add minimal freshness metadata such as spec id, spec file hash or flow id, command, started_at/completed_at, and worktree path. If intentionally omitted, explain why the risk is acceptable.

### 8. 8. Missing Coverage for Report and Finalize Compatibility
**QA:** Q9, Q16  
**Issue:** Q9 moves retro into mainline and Q16 mentions report updates, but no QA entry covers compatibility of `finalize`, `report`, and existing flow states after retro is no longer a finalize hook.  
**Suggestion:** Add a QA entry covering migration behavior for in-progress flows, report generation when `retro.json` is missing, and finalize preconditions after the step order change.

### 9. 9. test-result-review Raw Output Check May Be Unrealistic
**QA:** Q11  
**Issue:** The issue’s check says reported requirement IDs should appear in raw output, but many runners do not print file headers or requirement IDs. The answer falls back to reading test headers, which is no longer strictly “raw output” verification.  
**Suggestion:** Define exactly what counts as acceptable evidence: raw runner output only, raw output plus test file excerpts, or executor-produced evidence ranges. Update the reviewer contract accordingly.

### 10. 10. Scope Split Decision Is Too Broad
**QA:** Q1  
**Issue:** Q1 approves a large combined spec, but does not identify concrete risk controls for the many coupled changes: new steps, agent execution, schema, retro mainline, review FAIL changes, dispatcher/report/metrics updates.  
**Suggestion:** Keep the one-spec decision if desired, but add acceptance boundaries and rollback checkpoints, or define implementation slices inside the spec.

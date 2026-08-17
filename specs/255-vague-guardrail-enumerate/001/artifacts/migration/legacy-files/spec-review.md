# Spec Review Results

## Proposals

### 1. I’ll inspect the gate implementation, prompt templates, and nearby tests/config references to find places the spec may have missed. Since this is a review-only request, I’m not changing files.The first broad search hit a path issue, so I’m narrowing the scan to files that exist in this worktree and then I’ll read the relevant implementation sections directly.This `.tmp` worktree directory appears to contain only agent metadata, not the repository source tree. I’ll inspect the worktree layout without leaving the allowed path, then base proposals on any available local spec/agent context plus the codebase file list in the prompt if the source is absent.The git root is the parent worktree directory, so I’ll read from there and keep the review read-only. The `.tmp` directory is just the tool scratch area.I’ve found the current gate shape and the parser/call sites. Next I’m checking prompt templates and render/schema helpers, because omissions often come from generated artifacts or prompt consumers rather than the central parser.### 1. Clarify `buildGuardrailPrompt` Wrapper Fate
**File:** `src/flow/lib/run-gate.js`  
**Issue:** The spec renames `buildGuardrailPromptFromFiltered` but does not say whether the public `buildGuardrailPrompt` wrapper stays. Existing tests use that wrapper to verify phase filtering, while `buildGuardrailArticleEvalPrompt` is the pre-filtered builder and cannot replace those assertions directly.  
**Suggestion:** Add a requirement that `buildGuardrailPrompt` either remains and delegates to `buildGuardrailArticleEvalPrompt`, or is explicitly removed with phase-filtering tests moved to `filterByPhase` plus the new builder.

### 2. 2. Fix Prompt Ordering Contradiction
**File:** `src/lib/prompt-builder.js`  
**Issue:** The Scope section says textual prompt order is `rules → fmt fallback → previously-passed → diff-scope → articles → content`, but R6 says rules are systemPrompt, JSON schema/fmt fallback are separate payloads, and only `PromptBuilder.add()` sections are ordered in userPrompt.  
**Suggestion:** Normalize the spec to R6’s model: assert `systemPrompt` contains rules, `jsonSchema` and `fmtFallback` are payload fields, and userPrompt section order is only `previously-passed → diff-scope → articles → content`.

### 3. 3. Issue-Log Persistence Wording Is Wrong
**File:** `src/flow/lib/run-gate.js`  
**Issue:** R9 says `appendIssueLogFromGateResult` persists `r.detail` into both `entry.reason` and `failedEvaluations[].reason`. Current code builds `entry.reason` from `artifacts.reasons`, but `failedEvaluations[]` comes from `buildFailedEvaluations(result.artifacts.evaluations)`.  
**Suggestion:** Either update `buildFailedEvaluations` to emit one row per violation if that is intended, or correct R9 to say `failedEvaluations[].reason` uses the parser-derived FAIL `evaluation.reason`, not `r.detail`.

### 4. 4. Schema-Error Issue Logs May Be Hidden From Retry History
**File:** `src/flow/lib/run-gate.js`  
**Issue:** R5 says schema errors should append via `appendIssueLogFromGateError`, whose trigger is `gate onError hook (auto)`. `formatRetryHistory()` currently excludes that trigger, so retry exhaustion history may omit the schema-error attempts even though they consume `gateRetry`.  
**Suggestion:** Specify a distinct issue-log trigger for caught `EVALUATION_SCHEMA_ERROR`, or update `isRetryHistoryGateEntry()` so these parser-failure entries are included in retry history.

### 5. 5. Schema-Error Entries Need Phase/Git-State Rules
**File:** `src/flow/lib/run-gate.js`  
**Issue:** For inferred phases, `ctx.phase` can be unset while the local `phase` variable is correct. R5 says to append issue logs and increment retry manually, but does not require passing `{...ctx, phase}` or recording `gitState`. Also, without `headSha`/`worktreeHash`, schema-error retries will not participate in the no-progress guard.  
**Suggestion:** Add an implementation requirement for a shared helper like `failEvaluationSchemaError(ctx, phase, err)` that appends the metric using the explicit phase, writes issue-log with explicit phase, and records git state for tracked phases when available.

### 6. 6. Parser Extra-Key Rejection Omits Root Object
**File:** `src/flow/lib/run-gate.js`  
**Issue:** R19 requires parser-side extra-key rejection for evaluation entries and violation entries because provider schema enforcement is unreliable, but it does not require rejecting unknown top-level keys next to `evaluations`. The schema has `additionalProperties: false` at root, so parser behavior would be weaker than the stated provider-enforcement rationale.  
**Suggestion:** Extend R19 to say both parsers reject top-level keys other than `evaluations`.

### 7. 7. Test Migration Misses Helper/Fixture Contract
**File:** `tests/helpers/stub-agent.js`  
**Issue:** The spec adds mocked-agent tests for article violations, but the shared stub helper documentation and default response only describe old `{guardrail_id,result,reason}` evaluation responses. New article-path mocked tests may accidentally reuse old-shape fixtures and fail for the wrong reason.  
**Suggestion:** Add a test/helper requirement to provide separate stub response builders for requirement evaluation and article evaluation, with article FAIL fixtures using `violations[]`.

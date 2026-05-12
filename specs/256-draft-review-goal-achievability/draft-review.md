# Draft Review Results

11 issue(s) detected.

### 1. 1. T1 single-task schema split repeats prior anti-pattern
**QA:** Q3
**Issue:** T1 introduces qa[] `id` / `status` lifecycle and validation as a standalone task before any consumer (T2 routing, T4/T5 stages) is wired. The memo `task_decomposition_history.md` explicitly flags this "schema 先行、運用未配線" pattern as a recurring regression on issues 196/199/208/215/226. Without a consumer in the same task, T1 ends in a state where `id` / `status` are validated but no step transitions them, making it indistinguishable from the failure mode that history is warning about.
**Suggestion:** Either fold T1 into T4/T5 (schema lands together with the first stage that drives the lifecycle), or rephrase T1 to require at least one transition path (e.g., draft creates pending, gate-draft rejects pending) shipped together so the schema is observably exercised at task boundary.

### 2. 2. reopen-draft has chicken-and-egg with old draft.json
**QA:** Q12
**Issue:** Q12 says active flows with old-schema draft.json must run `reopen-draft` to regenerate qa[] with id/status, but Q6 redefines reopen-draft to reset `review-draft-questions` / `review-draft-coverage` and treat existing artifacts as stale via issue-log events. If the existing draft.json itself lacks id/status, the recovery path's prerequisites (schema validation, status reset) can't run on it without a special pre-migration carve-out. The error message proposed (`run reopen-draft to regenerate`) doesn't match what reopen-draft now does.
**Suggestion:** Add an explicit clause: when reopen-draft reads a draft.json with no `id`/`status`, it discards qa[] entries (writing them to issue-log under `draft.legacyDiscarded` for inspection) instead of treating them as stale-tracked entries, then regenerates from scratch. Or move legacy detection into draft step itself (skipping reopen-draft entry path) and document which step the user should run first.

### 3. 3. "Q<N> by qa[] order" id resolution is fragile
**QA:** Q11
**Issue:** Stage 1 / Stage 2 produce Markdown reports identifying targets by `Q<N>`, then remediation resolves `Q<N>` into qa.id "by current qa[] order at that time". If remediation itself adds/drops entries (Stage 1 allows `add` and `drop`), array indices shift mid-loop, so the second finding's `Q3` may resolve to a different entry than the report intended. This is a silent corruption risk, not a schema error.
**Suggestion:** Require the review markdown to emit `qa.id` directly (already the preferred form per Q11) and forbid bare `Q<N>` references in reports targeting existing entries. Reserve `Q<N>` only for `target=NEW` (where it is meaningless anyway). Have run-review fail-fast on a `Q<N>` reference to existing entries.

### 4. 4. Ambiguity detection responsibility is split three ways with overlap
**QA:** Q5, Q9, Q17
**Issue:** Q5 puts ambiguity clarification in draft interaction (closed-choice loop). Q9 says Stage 2 ignores ambiguity wording itself but FAILs on user-judgment gaps caused by ambiguity. Q17 says gate-draft detects "residual ambiguous wording" structurally. The boundary between "Stage 2 detects judgment-gap-from-ambiguity" and "gate-draft detects residual ambiguous wording" is not concretely separated — the same `適切に` answer could plausibly trigger either, and there is no rule for which fires first or how a Stage-2 PASS+gate-draft FAIL is supposed to be remediated (Stage 2 won't add a question for it, so the loop has no driver).
**Suggestion:** Define a precise differentiator: e.g., gate-draft only inspects the answer string for a fixed banned-token list (`適切に`, `必要なら`, etc.) and never inspects semantics; Stage 2 only triggers on cross-answer logical gaps. Add a Q clarifying what happens on gate-draft FAIL when Stage 2 already passed (re-enter draft? skip Stage 2 on retry?).

### 5. 5. Stage 1 evaluation prompt and PASS heuristic underspecified
**QA:** Q7, NEW
**Issue:** Q7 lists 7 observation categories and a PASS rule ("applicable category has pending/approved question OR AI can decide from evidence"), but the actual mechanism by which Stage 1 decides "applicable category" or "AI can decide from evidence" is left to the LLM with no prompt-level scaffolding. Without that, Stage 1 will be inconsistent across runs and may oscillate between FAIL and PASS on identical drafts.
**Suggestion:** Add a QA defining the Stage 1 prompt schema: how it must enumerate per-category applicability (yes/no/justification), how it must cite issue/code evidence when claiming "AI can decide", and what minimum fields the JSON/Markdown finding must include. Mirror the pattern Q18 uses for auto-check goal extraction.

### 6. 6. operator interaction loop interaction with auto mode unclear
**QA:** Q15, NEW
**Issue:** Q15 puts the approved-question Q&A and closed-choice clarification inside `review-draft-questions` operator instructions, not as a flow step. But the flow normally uses auto/manual eligibility for retry caps, and auto-check (Q8) controls whether the flow runs in auto. Whether closed-choice user prompts can run while flow eligibility=auto, and what happens when the user is unavailable mid-loop, is undefined. There's also no spec for how the partial state (some approved still unanswered) is detected on resume.
**Suggestion:** Add a QA covering: (a) does autoApprove eligibility forbid `review-draft-questions` from prompting the user, or does it always demote to manual upon entering Stage 1? (b) resume contract — on flow re-entry, which approved entries get re-asked vs treated as pending user response.

### 7. 7. dropped entries duplicate drop reason in two fields
**QA:** Q14
**Issue:** For `status=dropped`, Q14 specifies both `droppedReason` (required) and `answer = 空文字 OR user-stated skip reason` and `evidence = drop 判断の根拠`. Three fields all carrying drop justification creates ambiguity about which one consumers (gate, prompt rendering) must read, and invites drift between them.
**Suggestion:** Make `answer` and `evidence` strictly empty on dropped entries; put all drop justification in `droppedReason` only. Or eliminate `droppedReason` and reuse `answer`+`evidence` with status discriminator. Don't keep both.

### 8. 8. reopen scope from later phases (test/approval) not specified
**QA:** Q6
**Issue:** Q6 covers spec-phase-forward reopen (resets review-draft-questions through review-test) and explicitly defers `impl 以降` to "現行どおり done task 前提". But the redesign's whole motivation is that user judgment may surface late; Issue #321 mentions phase-aware rollback. There's no rule for what happens when, during test or approval phase, the user realizes a draft-level user-judgment gap. The current `done task required` constraint would block reopen-draft entirely.
**Suggestion:** Add a QA specifying behavior when reopen-draft is invoked from test/review-test/approval phase: either reject with a clear error (and require flow restart), or drop the done-task precondition and define the cascade (does it invalidate done tasks? rebuild plan?). Don't leave it as "現行どおり" because current behavior contradicts Issue #321's motivation.

### 9. 9. T6 separates auto-check from gate-draft but auto-check goal hard gate location is unclear
**QA:** Q3, Q8
**Issue:** T6 says "auto-check の temporary goal hard gate と gate-draft の residual QA quality guardrail を分離する". Q8 describes the auto-check side. But where does the goal hard gate physically live — inside `run-auto-check.js` evaluating the LLM JSON, or in `resolve-auto-check-input.js`? And is it new code or an existing field? Q3's T6 reads as if both halves are touched, but the gate-draft side change (removing the goal check from gate-draft) isn't clearly stated anywhere.
**Suggestion:** Spell out in Q8 (or a new QA) which file owns the hard gate, what condition expression rejects autoApprove, and whether `gate-draft` previously contained any goal logic that needs to be removed. Confirm with codebase rather than assume.

### 10. 10. T7 conflates spec prompt rules with reopen integration
**QA:** Q3
**Issue:** T7 bundles five spec-prompt instructions plus "phase-aware reopen-draft and stale marker integration". The reopen integration is already T-? — Q6 is the source of truth for reopen behavior, but T7 implies more code changes. It's unclear if T7 is just spec.md prompt edits or also `run-reopen-draft.js` work that already lives implicitly in another task.
**Suggestion:** Split T7 into "spec prompt rules" and "reopen-draft phase-aware integration", or fold the reopen integration into a single owner task. Confirm one task owns each file.

### 11. 11. Test plan does not cover qa[] lifecycle transitions
**QA:** Q13
**Issue:** Q13 lists schema validation, retry maxAttempts, finding normalization/dedupe, reopen reset. It does not cover the actual status transitions (`pending → approved`, `approved → answered`, `pending → dropped`, Stage 2 cannot mutate `answered`) that are the core invariant of the redesign. These are deterministic and should be unit-testable without AI.
**Suggestion:** Add to Q13: deterministic tests for status transitions including illegal transitions (e.g., Stage 2 attempting to update `answered` should reject; `answered` with empty `evidence` should fail validation; gate-draft fails when any pending/approved remains).

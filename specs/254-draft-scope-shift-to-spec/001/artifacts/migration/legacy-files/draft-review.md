# Draft Review Results

10 issue(s) detected.

### 1. 1. Over-narrows “flow / prompt” Without Enough Support
**QA:** Q2  
**Issue:** The answer equates “flow” with `src/flow/prompts/plan/spec.md` and excludes CLI/skill workflow changes. Issue #318 explicitly says “flow / prompt”, so this may miss updates to the flow skill, get-prompt surface, review flow, or approval-step conventions.  
**Suggestion:** Rework Q2 to compare concrete implementation surfaces: `spec.md`, `src/templates/skills/sdd-forge.flow/SKILL.md`, flow command prompts, and CLI runtime. State which must change and why.

### 2. 2. Disabling Guardrails May Exceed The Requested “Relax / Carve-out”
**QA:** Q3, Q4  
**Issue:** Q3 chooses full `phase=[]` disable for `draft-scope-boundary`, and Q4 also disables `spec-synthesize-not-copy`. The issue asks to relax one guardrail and add a carve-out to the other, not necessarily remove review-time enforcement.  
**Suggestion:** Add a QA entry comparing alternatives: wording relaxation, phase narrowing, reviewer prompt rewrite, all-violations reporting, passing draft context to spec gate, and full disable. Justify why full disable is necessary for each guardrail separately.

### 3. 3. Missing Option: Give Spec Gate The Draft Context
**QA:** Q4 / NEW  
**Issue:** Q4 says spec gate cannot verify “not copied from draft” because reviewer only receives `spec.json`, then jumps to disabling the guardrail. It does not examine whether `executeSpec` / guardrail prompt construction should include `draft.json` for this specific review.  
**Suggestion:** Add NEW QA: “Should spec gate receive draft.json as comparison context instead of disabling `spec-synthesize-not-copy`?” Answer with cost, prompt size, schema impact, and false-positive risk.

### 4. 4. `[VERIFY]` Entries Could Bloat Or Distort `overview.decisions`
**QA:** Q5, Q12  
**Issue:** Recording every verified draft policy in `spec.json.overview.decisions[].text` may overload a field intended for decisions/rationale. The schema has `text max 500`, which may be too small for source comparison evidence, and many `[VERIFY]` entries could degrade spec readability.  
**Suggestion:** Clarify whether only mismatches/corrections must be recorded, or whether full verification belongs in `evidence`, review artifacts, or a dedicated section if schema changes are acceptable during alpha.

### 5. 5. Unsupported AutoApprove Behavior Assumption
**QA:** Q5, Q7  
**Issue:** The answer treats autoApprove as “auto-select [1]” for draft policy corrections. That may be dangerous because the issue specifically asks for user confirmation when draft policy changes. Auto-approval may undermine that requirement unless explicitly accepted.  
**Suggestion:** Add a QA entry asking whether draft-policy correction confirmation is a hard stop even under autoApprove, or whether autoApprove may accept the default. Require issue/user evidence for the chosen behavior.

### 6. 6. Trigger Conditions Miss Source-Conflict Nuance
**QA:** Q6  
**Issue:** Trigger conditions focus on replacing approaches, rejecting requirements, or adding new requirements. The issue’s key case is “draft policy conflicts with source code”; Q6 does not clearly distinguish source-backed correction from ordinary spec refinement.  
**Suggestion:** Make “source contradiction or lack of source support for a draft implementation claim” an explicit trigger, with examples for file/function/data-structure claims.

### 7. 7. Test Strategy Under-Covers Prompt Propagation
**QA:** Q8, Q11  
**Issue:** Tests cover loader semantics, preset values, and spec prompt text, but not whether updated templates/skills receive the prompt or confirmation guidance after `sdd-forge upgrade`. Q11 says upgrade is needed, but Q8 does not test generated skill/output consistency.  
**Suggestion:** Add verification for generated `.agents/skills` / `.claude/skills` changes or a fixture asserting upgrade propagates the changed prompt/skill content.

### 8. 8. Board Hash / Follow-up Claims Are Too Specific Without Evidence
**QA:** Q3, Q13  
**Issue:** References like “experimental/workflow.js board hash c49c” and the “連続 5 回 fail” threshold appear as decisions, but the evidence shown does not establish them. They may be invented policy rather than issue-derived scope.  
**Suggestion:** Either cite the actual board entry and rationale, or downgrade these to proposed follow-up handling that requires confirmation.

### 9. 9. Redundant Scope Boundary Entries
**QA:** Q1, Q10, Q13  
**Issue:** These three entries all state that structural repeated-fail/reason-matching fixes and related guardrails are out of scope. The repetition adds bulk without much new spec-driving value.  
**Suggestion:** Merge them into one scope-control QA covering excluded structural fixes, related guardrails, and follow-up recording.

### 10. 10. Missing Backward Removal / Lifecycle Question
**QA:** NEW  
**Issue:** If `phase=[]` is introduced as “disabled but retained”, the draft does not ask whether disabled guardrails should remain in `guardrail.json` at all. Project policy says alpha code should not keep deprecated paths unnecessarily.  
**Suggestion:** Add QA: “Should disabled guardrails be retained with `phase=[]` or removed entirely?” Address lifecycle value, alpha policy, tests, and discoverability.

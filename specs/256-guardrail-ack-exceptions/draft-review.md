# Draft Review Results

6 issue(s) detected.

### 1. I’ll check the local flow/spec artifacts and relevant source paths so the review can flag unsupported or missing QA coverage against the actual issue, not just the draft text.The first search did not return anything, so I’m checking the worktree layout before drawing conclusions about missing artifacts.I found the local spec folder for issue 314 and an existing draft-review artifact. I’ll read the issue plus the relevant source/guardrail snippets to avoid repeating stale or already-invalid review points.### 1. Historical Collision Fixtures Are Ambiguous
**QA:** Q5, Q8  
**Issue:** Q7 requires direct `guardrail_id` matches in `constraints / clarifications / alternatives_considered`, but Q8 admits 235 and 229 do not have usable matches there. This conflicts with Q5’s framing that all four Issue #314 collision cases are mandatory regression targets.  
**Suggestion:** Clarify that 228 is the only direct existing fixture, add synthetic fixtures mirroring 235/229 with explicit IDs, and add negative tests proving approval notes / issue-log mentions are not scanned.

### 2. 2. Failure Mode Contract Is Too Loose
**QA:** Q4  
**Issue:** “debug/warn レベルのメッセージまたは test-visible return metadata” leaves observable behavior undecided. It also treats missing `state.spec` as skippable in phases where current commands already require an active flow/spec.  
**Suggestion:** Define exact behavior per caller: which missing/malformed spec cases remain fatal, which optional injection failures only warn and omit the section, and what concrete warning/return surface tests assert.

### 3. 3. `design_principles` Exclusion Needs Explicit Verification
**QA:** Q6, Q14  
**Issue:** Issue #314 lists `design_principles` among existing rationale fields, while the draft excludes it based on Fix Policy. That decision is plausible, but the QA does not require tests or author guidance making the exclusion visible.  
**Suggestion:** Add a test and documentation expectation that `design_principles` is intentionally not scanned, or revise the answer to include it consistently.

### 4. 4. Prompt Growth Bounds Are Not Spec-Verifiable
**QA:** Q10  
**Issue:** The answer requires deterministic caps but deliberately avoids concrete values. Tests that only assert “some cap exists” could pass with impractically large limits, weakening the bounded-resource concern.  
**Suggestion:** Specify internal default caps or acceptable maximum ranges, and assert rendered prompt length / entry count / per-entry truncation against those limits.

### 5. 5. Integration API Is Underspecified
**QA:** Q3, Q11, Q12  
**Issue:** The draft decides phases, helper ownership, and rendering format, but does not define how existing exported functions such as `checkGuardrail` and `buildGuardrailArticleEvalPrompt` receive matched rationale without breaking existing callers/tests.  
**Suggestion:** Add a QA entry defining the public helper/caller contract, preferably an optional parameter object with default empty rationale, and list the call sites that must pass parent spec context.

### 6. 6. Exception Semantics May Exceed The Issue
**QA:** Q13  
**Issue:** Issue #314 asks for a common acknowledgment clause and notes rationale-quality abuse as a possible separate guardrail. Q13 adds detailed guardrail-specific quality criteria, which may expand behavior beyond the requested “common clause” fix.  
**Suggestion:** Either justify the guardrail-specific criteria as required acceptance behavior, or narrow Q13 to a shared clause plus minimal examples derived directly from each existing guardrail body.

# Code Review Results

### [x] 1. Centralize the phase list
**File:** `src/flow/lib/get-guardrail.js`  
**Issue:** `VALID_PHASES` is a hard-coded list. That tends to drift from other phase-aware code paths whenever a new phase like `test` is added.  
**Suggestion:** Move the canonical phase list into a shared constant in the flow/guardrail domain and import it here. That keeps validation, help text, and phase-dependent behavior aligned.

**Verdict:** APPROVED
**Reason:** The exploration confirms there are **3 separate `VALID_PHASES` definitions** across `get-guardrail.js`, `set-metric.js`, and `review.js` — each with *different* phase sets that have already drifted (e.g., `set-metric.js` has `"gate"` but not `"lint"`; `get-guardrail.js` has `"lint"` but not `"gate"`). This is exactly the drift the proposal warns about. Note that different commands legitimately accept different phase subsets, so the shared constant should be a canonical superset, with each command selecting which phases it supports. The refactoring addresses a real maintenance hazard.

### [ ] 2. Extract repeated “load guardrail articles” guidance
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.md`  
**Issue:** The new spec-phase and test-phase additions repeat the same instruction pattern: run `sdd-forge flow get guardrail <phase>` and, if non-empty, follow the principles. This is duplication inside the template.  
**Suggestion:** Replace the repeated prose with one reusable convention in the template, such as a generic “Before authoring artifacts for a phase, load guardrails for that phase and apply them if present,” then reference it from the `spec` and `test` steps.

**Verdict:** REJECTED
**Reason:** The SKILL.md files are **LLM-consumed prompt templates**, not DRY application code. Each phase's guardrail instruction appears in a different step with phase-specific context ("when writing the spec" vs. "when writing tests"). Abstracting this into a generic convention forces the LLM reader to dereference an indirection, which hurts prompt clarity. Two instances is not problematic duplication in prose — it's appropriate repetition for an instruction-following context. The risk of the LLM misapplying or ignoring an abstracted convention outweighs the small editorial savings.

### [ ] 3. Fold the post-review impl gate into the review flow
**File:** `src/templates/skills/sdd-forge.flow-impl/SKILL.md`  
**Issue:** Step `3b` introduces an extra branch that is tightly coupled to Step 3, but it is modeled as a separate ad hoc sub-step. That makes the control flow harder to follow and is slightly inconsistent with the rest of the skill’s step structure.  
**Suggestion:** Make the impl gate re-run an explicit final action inside Step 3’s review path instead of a separate `3b` step. For example: “If review ran, re-run `gate --phase impl` before proceeding; if skipped, skip this check.” This keeps the review sequence linear and easier to maintain.

**Verdict:** REJECTED
**Reason:** Step `3b` serves a distinct purpose — it re-validates gate compliance *after* review auto-corrections, which is logically separate from the review itself. Folding it into Step 3 would conflate two concerns (code review vs. gate re-validation) and make the retry-limit logic (5 attempts) harder to distinguish from review's own iteration loop. The current `3b` naming clearly signals it's a conditional post-step dependent on Step 3's outcome, which is actually a reasonable structural convention for AI-consumed skill templates. The proposal is cosmetic and risks making the control flow *less* explicit, not more.

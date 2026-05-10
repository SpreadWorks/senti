# Spec Review Results

## Proposals

### 1. I’ll inspect the related modules and prompt/template references first, then compare actual call sites against the spec’s scope for missing dependencies or contradictions.The current working directory is the `.tmp` area and doesn’t contain the repo tree. I’m staying within the worktree boundary and checking the adjacent worktree contents from here.The repository root is the parent directory of `.tmp`, still inside the active worktree. I found an untracked spec directory for this issue and will read the actual code paths from the root without making changes.I have the main wiring points now. Next I’m reading the concrete implementations around gate prompts, review prompts, guardrail loading, and phase validation to find spec gaps that would cause missed call sites or stale generated references.### 1. Draft Gate Remediation Remains Ambiguous
**File:** `src/flow/prompts/plan/gate-draft.md`  
**Issue:** `backward-compatible-cli-interface` runs in `draft`, but draft gate is explicitly out of scope for matched spec acknowledgments. The spec documents draft strictness generally, but does not update draft-gate remediation guidance, so agents may try to record exceptions in `draft.json` fields that will never be scanned.  
**Suggestion:** Add `plan/gate-draft.md` to the guidance scope, stating that acknowledged exceptions are spec.json-only and draft gate violations must be fixed directly or escalated.

### 2. 2. Parent Spec Load Failure Semantics Are Undefined
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Diff-based gate currently tolerates some `spec.json` load failures for requirement ID fallback. The spec requires loading parent `spec.json` for acknowledged rationale but does not say whether parse/schema failures should fail the command, be treated as unavailable context, or use `validate: false`.  
**Suggestion:** Specify exact behavior for missing, invalid, and schema-invalid parent specs in `executeDiffBasedGate` and review paths. To preserve current behavior, require caught load failures to produce empty rationale plus a warning object, not a new hard failure, except in spec gate where validation already exists.

### 3. 3. Override Preservation Lacks Must-Have Tests
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** R19 requires preserving the common exception clause when preset-chain or project guardrail overrides replace target guardrails, but R31’s must-have test list does not include override/idempotence coverage. This is a core behavioral requirement, not just article-content coverage.  
**Suggestion:** Add must-have tests for `.sdd-forge/guardrail.json` project overrides and child preset overrides of the four target IDs, including “append once only” idempotence.

### 4. 4. Guardrail Body Clause Tests Are Under-Prioritized
**File:** `tests/unit/presets/guardrail-category-integrity.test.js`  
**Issue:** R13 is must-level behavior, but guardrail article content coverage is only listed under nice-to-have fixture coverage. A missing clause in one preset would silently break the feature for that guardrail.  
**Suggestion:** Promote target guardrail body assertions to must-have tests: all four target IDs contain the common clause and example sentence, while non-target guardrails do not gain acknowledged-exception semantics.

### 5. 5. Upgrade Requirement Does Not Match What Upgrade Deploys
**File:** `src/upgrade.js`  
**Issue:** R16 says to run `sdd-forge upgrade` after `src/presets/` or flow prompt source edits, but `upgrade` deploys skill templates and cleanup, not `src/flow/prompts/*` or preset `guardrail.json` bodies. This can create a misleading verification step.  
**Suggestion:** Clarify that `upgrade` is required for `src/templates/skills/*` changes and should be run after this spec only because `src/templates/skills/sdd-forge.flow/SKILL.md` changes; flow prompt and guardrail body edits should be verified through tests/source diff, with upgrade expected to be no-op unless skill templates changed.

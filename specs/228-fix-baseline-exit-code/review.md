# Code Review Results

### [x] 1. Unify Exit-Code Terminology Across Docs
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The new guidance uses `data.exitCode`/`data.summary.exitCode`, while the source comment in `run-tests.js` explains `result.exitCode`/`result.summary.exitCode`. This naming mismatch can confuse implementers and reviewers.  
**Suggestion:** Normalize terminology in this section to one canonical shape (e.g., “JSON envelope `data` contains `data.exitCode` …”) and explicitly map it once to the internal `result.*` naming used in implementation docs.

**Verdict:** APPROVED
**Reason:** This improves clarity and reduces reviewer/implementer confusion without changing runtime behavior. A single canonical JSON shape plus one explicit mapping to `result.*` is a safe documentation improvement.

### [ ] 2. Reduce Duplicated Semantic Spec Text
**File:** `src/flow/lib/run-tests.js`  
**Issue:** The added exit-code semantics block is very detailed and is now duplicated conceptually in `SKILL.md`, which increases drift risk when behavior changes.  
**Suggestion:** Keep a shorter in-code contract summary (baseline mode: capture success/failure; head mode: test outcome) and avoid restating full procedural wording already documented in the skill template. This keeps source comments focused and reduces maintenance duplication.

**Verdict:** REJECTED
**Reason:** This is mostly documentation reshaping and risks removing important contract detail from the code-local comment where maintainers need it most. It may increase ambiguity rather than quality, with limited concrete benefit.

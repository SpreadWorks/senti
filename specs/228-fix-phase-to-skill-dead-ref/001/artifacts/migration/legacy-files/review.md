# Code Review Results

### [x] 1. Collapse Repeated Switch Cases
**File:** `src/flow/lib/resolve-context-envelope.js`  
**Issue:** `phaseToSkill` has four cases (`plan`, `impl`, `task-impl`, `finalize`) that all return the same value, which is duplicate logic and increases maintenance cost.  
**Suggestion:** Group equivalent cases (fallthrough) or replace the `switch` with a small lookup table plus default. For example, keep only explicit special cases (`sync`) and return `"sdd-forge.flow"` as the default for all other phases.

**Verdict:** APPROVED
**Reason:** This is a real simplification, not cosmetic. Since all non-`sync` branches currently return `"sdd-forge.flow"` (including `default`), collapsing to `sync` + default preserves behavior while reducing maintenance surface.

### [ ] 2. Clarify Function Naming Intent
**File:** `src/flow/lib/resolve-context-envelope.js`  
**Issue:** The name `phaseToSkill` is slightly ambiguous now that it returns fully-qualified skill IDs (e.g., `"sdd-forge.flow"`), not just short skill names.  
**Suggestion:** Rename to something explicit like `resolveSkillIdForPhase` (or similar) to reflect that it resolves canonical skill identifiers.

**Verdict:** REJECTED
**Reason:** This is primarily a naming-only change. It adds churn and potential call-site break risk without materially improving logic, correctness, or maintainability enough to justify refactor risk.

### [x] 3. Remove Implicit Dead Branches via Data-Driven Mapping
**File:** `src/flow/lib/resolve-context-envelope.js`  
**Issue:** The current `switch` structure encourages adding phase-specific branches even when behavior is identical, creating effectively dead differentiation between phases.  
**Suggestion:** Use a minimal mapping object for true exceptions only:
- `"sync"` -> `"sdd-forge.flow-sync"`
- default -> `"sdd-forge.flow"`  
This removes unnecessary branch surface and keeps design consistent with “default + exceptions” logic.

**Verdict:** APPROVED
**Reason:** The current branch distinctions are functionally redundant. An exceptions-only mapping (`sync` special-case, default `"sdd-forge.flow"`) keeps behavior equivalent and makes intent clearer with less dead branching.

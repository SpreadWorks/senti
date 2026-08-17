# Code Review Results

### [x] 1. Extract Repeated Extra-Argument Validation
**File:** `src/flow.js`  
**Issue:** `Unknown option` / `Unexpected argument` detection is duplicated in three branches of `parseEntryArgs`, increasing maintenance cost and risk of inconsistent behavior.  
**Suggestion:** Introduce a helper like `throwIfUnexpectedArgs(args)` and call it from each branch. This centralizes validation and keeps error behavior consistent.

**Verdict:** APPROVED
**Reason:** This removes clear duplication in `parseEntryArgs` and can preserve identical error behavior (`Unknown option` vs `Unexpected argument`) with low risk if the helper is reused verbatim.

### [x] 2. Split `parseEntryArgs` Into Focused Helpers
**File:** `src/flow.js`  
**Issue:** `parseEntryArgs` now mixes multiple responsibilities (no-args command handling, help detection, positional mapping, extra-arg validation), making control flow harder to follow.  
**Suggestion:** Refactor into smaller functions, e.g. `parseArgsForNoArgEntry`, `assignPositionalArgs`, and `validateExtraArgs`, with `parseEntryArgs` orchestrating them.

**Verdict:** APPROVED
**Reason:** `parseEntryArgs` is handling multiple concerns now; decomposing into small helpers improves readability/testability without changing behavior, as long as current parse order and error semantics are kept exactly.

### [ ] 3. Improve Naming for Command Identity Parameters
**File:** `src/flow.js`  
**Issue:** `envelopeType` / `envelopeKey` are ambiguous in `helpCommandFor` and `runEntry`; they appear to represent command path segments, not envelope internals.  
**Suggestion:** Rename to clearer names such as `commandGroup` / `commandName` (or `scope` / `action`) to better reflect purpose and reduce cognitive load.

**Verdict:** REJECTED
**Reason:** Mostly cosmetic. The gain is limited, while renaming widely-used parameters can introduce avoidable churn and mismatch risk without meaningful behavioral or structural improvement.

### [x] 4. Replace Hardcoded Help Command Special Cases
**File:** `src/flow.js`  
**Issue:** `helpCommandFor` has explicit exceptions for `run prepare-spec` and `run resume`, which is brittle and may drift from registry structure as commands evolve.  
**Suggestion:** Move canonical CLI help command mapping into registry metadata (or alias map) and generate help commands from that single source of truth.

**Verdict:** APPROVED
**Reason:** Moving help-command mapping to registry metadata removes brittle special-casing and reduces drift risk as commands evolve, while preserving behavior if existing aliases are encoded in that single source of truth.

### [ ] 5. Normalize Help Text Construction
**File:** `src/flow/registry.js`  
**Issue:** Help strings are now built with inline arrays and `.join("\n")`; this pattern will likely repeat and can become inconsistent across commands.  
**Suggestion:** Add a small `formatHelp(lines)` utility (or shared constant pattern) and use it across registry entries for consistent formatting and easier edits.

**Verdict:** REJECTED
**Reason:** This is primarily formatting/style consolidation. A `formatHelp(lines)` utility adds indirection with minimal quality gain and no clear behavioral benefit.

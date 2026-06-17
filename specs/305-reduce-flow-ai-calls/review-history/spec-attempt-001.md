# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Primary measurement sample is ambiguous
**Target:** R9 / Scope measurement sample
**Issue:** The codebase currently contains both `specs/299-agent-config-setup` and `specs/299-worktree-config-preflight`, but the spec repeatedly says only `specs 293-299` without enumerating exact directories or defining how duplicate numeric prefixes are handled.
**Required change:** Enumerate the exact primary sample directories for R9, or add a deterministic duplicate-prefix rule such as explicitly including both 299 directories or selecting one named directory.
**Why blocking:** `measurement-results.json` and its tests cannot be designed reliably: agent call counts, duration, input tokens, retry counts, finalize-sync time, and completion rate change depending on whether one or both 299 samples are included.

### 2. Migration parity coverage has no fixed inventory source
**Target:** R8 / Acceptance R8
**Issue:** R8 requires `migration-parity-map.json` to include every retained public surface named in the draft inventory, but the spec does not identify a concrete draft-inventory artifact or minimum list. The related code spans CLI commands, generated skills, docs commands, review/gate artifacts, JSON repair, context search, and auto-check, so implementers can choose different coverage sets.
**Required change:** Name the exact inventory source for R8, or define the minimum retained public surface list that migration parity must cover for this research artifact.
**Why blocking:** Tests cannot determine whether migration parity coverage is complete, and implementation can silently omit an existing public behavior surface whose owner/fallback/verification must be preserved before later production migration work.


## Non-blocking Improvements

### 1. Clarify latest-heavy-sample wording
**Target:** Overview Data Flow / bounded-resource-usage constraint
**Improvement:** The Data Flow mentions `any available latest heavy samples`, while the bounded-resource constraint limits measurement to specs 293-299 and spec-local research files. Clarifying that latest samples are optional only when already inside the bounded sample set would avoid scope drift.
**Why non-blocking:** The bounded-resource constraint is already strong enough to guide implementation, so this does not prevent building or testing the required artifacts.

### 2. Name the spec-local test invocation
**Target:** R10 / Tasks test_strategy
**Improvement:** Specify the expected command or runner pattern for the research artifact tests, for example whether they should be run directly with `node --test specs/305-reduce-flow-ai-calls/tests/*.test.js` or through the existing flow test step only.
**Why non-blocking:** Existing spec-local test conventions are sufficient to implement tests, but naming the invocation would make verification evidence more consistent.

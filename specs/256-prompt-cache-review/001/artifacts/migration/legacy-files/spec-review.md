# Spec Review Results

## Proposals

### 1. I’ll inspect the scoped modules and nearby prompt/metrics consumers to see where the spec misses dependent behavior or tests. I’m only reviewing; no code changes.The configured cwd is a `.tmp` worktree subdirectory without `src/` directly under it, so I’m locating the repository root inside the allowed worktree before reading files.I found the real repo root and the active spec folder. Next I’m narrowing to actual PromptBuilder users, agent metric writes, and metrics readers so the proposals are grounded in concrete files.### 1. Preserve test-review role prompts when moving testDesign
**File:** `src/flow/commands/review.js`  
**Issue:** R5 requires passing `testDesign` through `systemPrompt`, but only asserts `systemPrompt.includes(testDesign)`. An implementation could replace the current gap-analysis / gap-fix system role strings with only the test design, weakening the reviewer/engineer instruction.  
**Suggestion:** Specify that the systemPrompt for both calls must contain the existing role instruction plus a `## Test Design` section containing `testDesign`, while userPrompt excludes `## Test Design`.

### 2. 2. Define provider buckets for legacy object metrics
**File:** `src/metrics/commands/token.js`  
**Issue:** The token command still supports legacy object-shaped `metrics` fixtures, while R10 focuses on rows derived from agent entries. The spec does not say whether legacy phase objects must get `providers.unknown.unknown`, even though older flow files are explicitly required to keep working.  
**Suggestion:** Add a requirement that legacy object-shaped phase metrics synthesize `providers.unknown.unknown` buckets, or explicitly declare that provider buckets are only guaranteed for append-only agent metric arrays.

### 3. 3. Clarify costIncomplete derivation
**File:** `src/metrics/commands/token.js`  
**Issue:** Existing token metrics derive `costIncomplete` when an agent entry has missing or zero cost, but R7/R10 define provider bucket `costIncomplete` only from source `costIncomplete` flags. New flow-store entries currently do not persist that flag.  
**Suggestion:** Define provider bucket `costIncomplete` as true when any source entry/row has `costIncomplete === true` or has missing/zero cost under the existing token-metrics semantics, and add a null-cost provider bucket test.

### 4. 4. Test placement is under-specified
**File:** `tests/run.js`  
**Issue:** The spec places focused tests under `specs/256-prompt-cache-review/tests/`, but the default runner discovers `tests/unit`, `tests/e2e`, and preset tests, not spec-local tests.  
**Suggestion:** Require either formal tests under `tests/unit/...` or an explicit verification command such as `node --test specs/256-prompt-cache-review/tests/*.test.js`.

### 5. 5. FlowManager facade is omitted from module scope
**File:** `src/lib/flow-manager.js`  
**Issue:** The data flow says metrics pass through `flowManager.accumulateAgentMetrics(...)`, but the module list only names `agent.js`, `provider.js`, and `flow-store.js`. The facade method is part of the actual call path and test seam.  
**Suggestion:** Add `src/lib/flow-manager.js` to Scope/Modules and require its facade contract/tests to accept and forward `provider` and `profileKey` unchanged.

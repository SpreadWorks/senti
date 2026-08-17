# Code Review Results

### 1. 1. Extract Shared Codebase Context Formatting
**File:** `src/flow/commands/review.js`  
**Issue:** `buildSpecReviewPrompt` and `buildDraftReviewPrompt` duplicate the same `contextEntries.map(...)` formatting and Japanese ordering note.  
**Suggestion:** Add a small helper like `formatCodebaseContextForPrompt(contextEntries)` and use it in both prompt builders to keep the context section consistent.

### 2. 2. Rename `callReviewAgent` Prompt Parameter
**File:** `src/flow/commands/review.js`  
**Issue:** `callReviewAgent(agent, prompt, ...)` now accepts either a raw string or a PromptBuilder result object, but the parameter name `prompt` still implies a single string.  
**Suggestion:** Rename it to `promptInput` or `promptPayload`, and optionally add a JSDoc shape for `{ systemPrompt, userPrompt }` to make the dual input contract explicit.

### 3. 3. Avoid Duck-Typing Arbitrary Prompt Objects
**File:** `src/flow/commands/review.js`  
**Issue:** The `"userPrompt" in prompt` check treats any object with that property as a PromptBuilder result, which is broad and can hide accidental malformed inputs.  
**Suggestion:** Add a local normalizer that checks `typeof prompt.userPrompt === "string"` and, if present, `typeof prompt.systemPrompt === "string" || prompt.systemPrompt == null` before calling `agent.call`.

### 4. 4. Bound Prompt Construction From Bulk Test Files
**File:** `src/flow/commands/review.js`  
**Issue:** `buildGapAnalysisPrompt` and `buildTestFixPrompt` include `formatTestFilesForPrompt(testFiles)` directly. If `testFiles` is large, prompt size can grow without an explicit bound, which conflicts with `bounded-resource-usage`.  
**Suggestion:** Ensure the test-file collection or formatting path has an explicit maximum file count and/or character budget before adding it to the user prompt.

### 5. 1. Extract Shared Metric Accumulation
**File:** `src/flow/lib/get-status.js`  
**Issue:** `applyEntry` and `applyProviderEntry` duplicate the same accumulation logic for `callCount`, `responseChars`, `durationMs`, `tokens`, `cost`, `costIncomplete`, and `models`. This increases the chance that future metric fields are added to one path but missed in the other.  
**Suggestion:** Extract a helper such as `applyMetricTotals(bucket, entry)` and use it for both the phase bucket and provider/profile bucket. Keep provider bucket creation separate, but share the field aggregation.

### 6. 2. Use a More Specific Name for `metricLabel`
**File:** `src/flow/lib/get-status.js`  
**Issue:** `metricLabel` is vague; it does not communicate that the function normalizes provider/profile dimension keys and falls back to `"unknown"`.  
**Suggestion:** Rename it to something more intent-revealing, such as `metricDimensionKey`, `providerProfileKey`, or `knownMetricKey`, depending on local naming conventions.

### 7. 3. Isolate Provider Bucket Lookup
**File:** `src/flow/lib/get-status.js`  
**Issue:** `applyProviderEntry` mixes key normalization, nested object initialization, and aggregation in one function. The chained assignments are compact but make the provider/profile bucket shape harder to scan.  
**Suggestion:** Extract bucket lookup/creation into a helper like `getProviderProfileBucket(phaseBucket, provider, profileKey)`, then let `applyProviderEntry` focus on applying the entry totals.

### 8. I’ll review the touched file in context so the proposals are grounded in the existing patterns and not just the diff hunk.The diff references `src/lib/agent.js`, but that path is not present under the current `.tmp` directory. I’ll check the workspace layout and then continue from the provided diff if the repository files are not available here.### 1. Clarify metric provider naming
**File:** `src/lib/agent.js`  
**Issue:** `runWithLogging` now accepts `provider`, but the value passed is `resolved.providerKey`. In this file, `provider` also appears to mean the resolved Provider instance/class, so the new parameter is ambiguous.  
**Suggestion:** Rename the `runWithLogging` parameter to `providerKey`, then pass it to metrics as `provider: providerKey`.

### 9. 2. Group metric identity fields
**File:** `src/lib/agent.js`  
**Issue:** `runWithLogging` gained two more top-level parameters solely for metric accumulation, widening an already broad argument object.  
**Suggestion:** Pass these as a small grouped object, e.g. `metricIdentity: { provider, profileKey }`, or `agentMetrics: { provider, profileKey }`, then spread or forward them inside `accumulateAgentMetrics`. This keeps logging inputs separate from metrics-only metadata.

### 10. I’ll inspect the touched file around the metric aggregation path so the review is grounded in the existing design, not just the snippet.The diff path is relative to the repository root, but this worktree’s current directory appears to be the flow `.tmp` directory. I’m locating the actual checkout root before reading the file.### 1. Narrow the metric label helper name
**File:** `src/lib/flow-store.js`  
**Issue:** `normalizeMetricLabel` is generic, but the current behavior is specifically for required agent metric dimensions (`provider`, `profileKey`). A broader name may invite reuse for unrelated metric labels where `"unknown"` is not the right fallback.  
**Suggestion:** Rename it to something more specific, such as `normalizeAgentMetricLabel` or `normalizeAgentMetricDimension`, and update the two call sites.

### 11. I’ll inspect the touched file context so the review is based on the surrounding process helper behavior, then I’ll keep proposals scoped to `src/lib/process.js`.The provided `cwd` appears to be a `.tmp` directory rather than the repository root, and `src/lib/process.js` is not present there. I’ll check the local layout without leaving the worktree boundary.`src/lib/process.js` is in the parent worktree directory (`../src/lib/process.js`), so I’m reading it in place and not making any edits.### 1. Centralize process-result normalization
**File:** `src/lib/process.js`  
**Issue:** `runCmd` and `runCmdAsync` duplicate the same result shape, string coercion, status fallback, signal handling, and success semantics. The latest change also makes sync success calculation diverge further from the async path, where any `err` forces `ok: false`.  
**Suggestion:** Add a small helper such as `createProcessResult({ status, stdout, stderr, signal, error, killed })` and have both runners use it. Keep `ok` semantics in one place, ideally treating process-level errors consistently instead of relying on each caller path to remember the same conditions.

### 12. 1. Extract Prompt Section Formatting
**File:** `src/lib/prompt-builder.js`  
**Issue:** Section storage and rendering are duplicated in system/user paths, and sections are represented as plain object literals despite the project’s OOP-by-design rule.  
**Suggestion:** Introduce a small `PromptSection` class with `header`, `content`, and `toPromptText()`, then store instances in both `_systemSections` and `_userSections`. This removes repeated `${header}\n${content}` formatting and makes the section value explicit.

### 13. 2. Centralize Section Appending
**File:** `src/lib/prompt-builder.js`  
**Issue:** `addSystemPrompt()` and `addUserPrompt()` differ only by target array, so future behavior changes around prompt section insertion would need to be duplicated.  
**Suggestion:** Add a private helper such as `_addSection(sections, header, content)` and have both public methods delegate to it while preserving the required public API names.

### 14. I’ll inspect the touched file around the registry and provider classes so the proposals stay grounded in the existing pattern.The provided cwd is a temporary worktree directory that does not contain `src/` directly, so I’m checking the local layout before relying on the diff alone.### 1. Rename the matched provider variable
**File:** `src/lib/provider.js`  
**Issue:** `matched` is vague and does not explain what was matched or why it matters for `providerKey`.  
**Suggestion:** Rename it to something like `registeredProvider` or `builtInProvider` so the branch reads more clearly.

### 15. 2. Centralize provider key derivation
**File:** `src/lib/provider.js`  
**Issue:** `providerKey` is derived with a conditional separate from `provider` creation, which can drift if provider resolution changes later.  
**Suggestion:** Add a small helper or instance getter, e.g. `provider.key`, and return `providerKey: provider.key`. `UserProvider` can expose `"user"` through the same path as built-in providers.

### 16. 1. Extract provider bucket source creation
**File:** `src/metrics/commands/token.js`  
**Issue:** The mapping from token/cost/duration fields into the provider bucket shape is duplicated in `applyPhaseMetrics()` and `normalizeMetrics()`.  
**Suggestion:** Add a helper such as `createProviderBucketSource(tokens, metrics)` or `mergeProviderMetricsFromPhaseData()` so field mapping stays consistent if bucket fields change again.

### 17. 2. Make provider map merging report actual merges
**File:** `src/metrics/commands/token.js`  
**Issue:** `mergeProviderMaps()` sets `merged = true` even when `mergeProviderBucket()` receives an invalid/non-object bucket and returns without merging. This can suppress the `"unknown"` fallback in `applyPhaseMetrics()`.  
**Suggestion:** Have `mergeProviderBucket()` return a boolean, and only mark `merged = true` when a bucket was actually merged.

### 18. 3. Add explicit bounds for provider/profile map processing
**File:** `src/metrics/commands/token.js`  
**Issue:** `mergeProviderMaps()` iterates every provider and profile from metrics data with no explicit cap. This violates the bounded-resource guardrail for bulk data processing if a malformed cached metrics file contains a huge nested map.  
**Suggestion:** Define limits such as `MAX_PROVIDERS_PER_ROW` and `MAX_PROFILES_PER_PROVIDER`, enforce them during merge, and either skip excess entries or mark the row incomplete in a documented way.

### 19. 1. Standardize Agent Metric Dimension Names
**File:** `src/lib/agent.js`  
**Issue:** Metric identity naming is inconsistent across `agent.js`, `flow-store.js`, and `get-status.js`: `provider`, `providerKey`, `profileKey`, `metricLabel`, and `normalizeMetricLabel` describe the same provider/profile metric dimensions at different abstraction levels.  
**Suggestion:** Use `providerKey` and `profileKey` consistently for stored metric dimensions, and rename helpers to a shared intent-revealing name such as `normalizeAgentMetricDimension`.

### 20. 2. Centralize Provider/Profile Metric Bucket Logic
**File:** `src/flow/lib/get-status.js`  
**Issue:** Provider/profile bucket creation, normalization, and metric accumulation appear independently in `get-status.js`, `flow-store.js`, and `metrics/commands/token.js`. This creates drift risk when fields like tokens, cost, duration, or incomplete flags change.  
**Suggestion:** Extract shared metric helpers or classes for dimension normalization, bucket creation, and total accumulation, then reuse them across status reporting, storage, and token command normalization.

### 21. 3. Formalize Prompt Payload Interface
**File:** `src/flow/commands/review.js`  
**Issue:** `review.js` accepts either raw prompt strings or PromptBuilder result objects, while `prompt-builder.js` owns the actual prompt shape. The current cross-file contract is implicit and relies on duck-typing `userPrompt`.  
**Suggestion:** Add an explicit prompt payload class or normalizer exported from `prompt-builder.js`, and make `review.js` consume that interface instead of locally inferring object shape.

### 22. 4. Keep Provider Identity on Provider Resolution
**File:** `src/lib/provider.js`  
**Issue:** `provider.js` derives `providerKey` separately from the provider object, while `agent.js` forwards that key into metrics as `provider`. This splits provider identity across files and encourages ambiguous naming.  
**Suggestion:** Expose provider identity through a single provider resolution object or provider instance property, then pass `providerKey` through agent metrics consistently.

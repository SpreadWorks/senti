# Code Review Results

### [ ] 1. Add an explicit prompt-size bound to loop review
**File:** `src/flow/commands/review.js`  
**Issue:** `MAX_LOOP_CALLS` limits only the number of AI calls, not the amount of diff content packed into each call. When `groups.length` is much larger than `MAX_LOOP_CALLS`, each chunk can still accumulate an arbitrarily large number of files and diff text, which violates the `bounded-resource-usage` guardrail for bulk loading and can make prompt size unpredictable.  
**Suggestion:** Add an explicit per-call size bound such as `MAX_GROUPS_PER_CALL` and/or `MAX_DIFF_BYTES_PER_CALL`, and split chunks by accumulated input size instead of only by call count. If the total review payload exceeds a hard ceiling, fail fast with a clear error rather than building unbounded prompts.

**Verdict:** REJECTED
**Reason:** The concern about unbounded prompt size is theoretical; the current chunking by call count already provides a coarse bound, and there is no evidence of actual overflow. Adding `MAX_DIFF_BYTES_PER_CALL` plus a hard-fail ceiling introduces new failure modes (legitimate large changes would now error out) and tuning surface without a measured need. Should be revisited only after observed prompt-size problems.

### [x] 2. Remove the unused `escapeRegExp` helper
**File:** `src/flow/commands/review.js`  
**Issue:** `escapeRegExp()` is introduced but never called. It also contains a suspicious replacement string (`"\\{{PROMPT}}"`), which makes it look like leftover or incomplete code. Keeping it increases noise and makes future readers wonder whether some escaping path is missing.  
**Suggestion:** Delete `escapeRegExp()` entirely. If escaping is actually needed later, reintroduce it at the call site with a tested implementation and a name tied to that specific use.

**Verdict:** APPROVED
**Reason:** The function is genuinely unused, and its replacement string `"\\{{PROMPT}}"` is clearly wrong (it should be `"\\$&"`), so leaving it as "future scaffolding" actively misleads readers. Deletion is risk-free dead-code removal that aligns with the project's "alpha policy" of not keeping unused paths.

### [ ] 3. Replace regex-based proposal body rewriting with a single proposal renderer
**File:** `src/flow/commands/review.js`  
**Issue:** `expandProposalsToGroup()` mutates `p.body` by regex-replacing the `**File:**` line while also overriding the structured `file` field. That creates two sources of truth for the same proposal and couples expansion logic to one exact markdown format. Any future formatting change can silently break cloning.  
**Suggestion:** Keep proposals fully structured during processing and render markdown from fields in one dedicated formatter. For group expansion, clone the structured proposal with a new `file` value and regenerate `body` through the shared renderer instead of patching markdown text with a regex.

**Verdict:** REJECTED
**Reason:** The two-sources-of-truth observation is valid, but the fix requires introducing a structured proposal renderer/parser that does not yet exist in this file. That is a larger refactor than the proposal frames it as, and it touches the markdown contract consumed downstream by `parseProposals` and `writeReviewMd`. Risk of behavior drift outweighs the cleanup benefit at this point — defer until a renderer is independently justified.

### [x] 4. Extract chunk input assembly and summary labeling into helpers
**File:** `src/flow/commands/review.js`  
**Issue:** `runLoopReview()` duplicates the same “resolve diff + resolve requirements + build per-file input” logic for `primaryGroup` and the remaining groups in the chunk. It also stores one summary per chunk under `primaryGroup.representative`, even when the chunk contains multiple unrelated groups, which makes cross-check provenance harder to follow.  
**Suggestion:** Extract a helper such as `buildChunkReviewInput(chunk, rawPerFileDiffs, fileToReqs)` and a matching summary-label helper. That removes duplication, keeps the chunk path consistent, and lets summaries be labeled per chunk or per group instead of overloading one representative file name.

**Verdict:** APPROVED
**Reason:** The duplication between the `primaryGroup` branch and the `for (let j = 1; ...)` loop is real and identical in shape (resolve raw diff, resolve reqs, build per-file input). Extracting `buildChunkReviewInput` is a straightforward, behavior-preserving simplification that matches the project's "extract on the 2nd occurrence" rule. The summary-labeling tweak is a small, low-risk clarity win that addresses a genuine provenance ambiguity when chunks contain multiple groups.

# Test Design

### Test Design

- **TC-1: addUserPrompt appends header+content to userPrompt in insertion order**
  - Type: unit
  - Input: New PromptBuilder; call addUserPrompt("## A", "alpha") then addUserPrompt("## B", "beta"); build prompt.
  - Expected: userPrompt section equals `## A\nalpha\n## B\nbeta` (or equivalent join), in the exact insertion order.

- **TC-2: addSystemPrompt appends after setRole and setRules output**
  - Type: unit
  - Input: setRole("role text"), setRules("rules text"), addSystemPrompt("## Extra", "extra body"), then addSystemPrompt("## More", "more body").
  - Expected: systemPrompt contains role first, then rules, then `## Extra\nextra body`, then `## More\nmore body`, in that order.

- **TC-3: setRole / setRules / setJsonSchema / setFmtFallback are overwrite-only**
  - Type: unit
  - Input: Call each setter twice with different values.
  - Expected: Only the second value appears in built prompt; no concatenation occurs.

- **TC-4: Old add() method is removed**
  - Type: unit
  - Input: Inspect PromptBuilder.prototype.
  - Expected: `typeof PromptBuilder.prototype.add === "undefined"`; calling `pb.add(...)` throws TypeError.

- **TC-5: Static scan rejects `<promptBuilder>.add(...)` in src/**
  - Type: integration (static analysis test)
  - Input: Walk all files under src/, parse imports/locals named `PromptBuilder`/`new PromptBuilder()`, search for `<var>.add(`.
  - Expected: Zero matches; test fails with file:line if any are found.

- **TC-6: Static scan ignores Set.add and Map-like add**
  - Type: unit
  - Input: Fixture file containing `new Set().add(x)`, `mapLike.add(k,v)`, and an unrelated `foo.add(...)` where foo is not a PromptBuilder.
  - Expected: Scan does not flag these; only PromptBuilder-tracked variables are flagged.

- **TC-7: Docs command migrations preserve user-prompt-only behavior**
  - Type: integration
  - Input: For each migrated docs command call site that previously used add(), build the prompt via the new API.
  - Expected: systemPrompt equals the pre-migration systemPrompt (role+rules only, no extra sections); userPrompt content matches the pre-migration prompt body byte-for-byte.

- **TC-8: review.js buildDraftSystemPrompt keeps Additional Guardrail header in systemPrompt**
  - Type: unit
  - Input: Invoke buildDraftSystemPrompt with representative inputs.
  - Expected: Built systemPrompt includes `## Additional Guardrail Review Perspectives`; userPrompt does not include that heading.

- **TC-9: review-spec systemPrompt content (R3)**
  - Type: unit
  - Input: Invoke review-spec prompt construction with sample spec + context.
  - Expected: systemPrompt includes `You are a spec completeness reviewer`, the `Focus on:` bullet section, and `Output a numbered list of proposals`.

- **TC-10: review-spec userPrompt content (R3)**
  - Type: unit
  - Input: Same as TC-9.
  - Expected: userPrompt includes `## Spec` and `## Codebase Context`; userPrompt does NOT include the spec reviewer role line, `Focus on:`, or `Output a numbered list of proposals`.

- **TC-11: review-draft systemPrompt content (R4)**
  - Type: unit
  - Input: Invoke review-draft prompt construction with sample request/issue + draft entries.
  - Expected: systemPrompt includes `You are a draft QA quality reviewer`, the `Focus on:` bullet section, and `Output a numbered list of issues`.

- **TC-12: review-draft userPrompt content (R4)**
  - Type: unit
  - Input: Same as TC-11.
  - Expected: userPrompt includes `## Request / Issue` and `## Draft QA Entries`; userPrompt does NOT include the three instruction blocks above.

- **TC-13: test-review gap-analysis passes testDesign via systemPrompt (R5)**
  - Type: unit
  - Input: Stub runReviewLoop; invoke test-review with a known testDesign string; capture systemPrompt and userPrompt for the gap-analysis call.
  - Expected: `systemPrompt.includes(testDesign) === true`; `userPrompt.includes("## Test Design") === false`; userPrompt still contains test-file/gap-data sections.

- **TC-14: test-review gap-fix passes testDesign via systemPrompt (R5)**
  - Type: unit
  - Input: Same setup as TC-13 but capture the gap-fix call.
  - Expected: Same assertions as TC-13 for the gap-fix call.

- **TC-15: testDesign computed once before runReviewLoop and reused**
  - Type: unit
  - Input: Spy on the testDesign producer function; run gap-analysis then gap-fix in one test-review invocation.
  - Expected: Producer called exactly once; both calls receive the same instance/string value.

- **TC-16: Agent metric entry includes provider and profileKey strings (built-in)**
  - Type: integration
  - Input: Mock built-in Provider class (e.g. claude); run an agent call; inspect persisted metric entry.
  - Expected: Entry has `provider` equal to resolved Provider class key (string) and `profileKey` equal to value returned by Agent.resolve (string).

- **TC-17: UserProvider yields provider="user"**
  - Type: unit
  - Input: Resolve via UserProvider; record metric.
  - Expected: Entry has `provider === "user"`, `profileKey` equals resolved key.

- **TC-18: accumulateAgentMetrics normalizes missing/null/non-string at storage boundary**
  - Type: unit
  - Input: Call accumulateAgentMetrics with `{ provider: undefined, profileKey: null }`, then `{ provider: 123, profileKey: {} }`, then `{}`.
  - Expected: All persisted entries have `provider === "unknown"` and `profileKey === "unknown"`; valid strings pass through unchanged in a separate case.

- **TC-19: Existing aggregation behavior preserved (R6)**
  - Type: unit
  - Input: Drive accumulateAgentMetrics with a fixed sequence of entries containing tokens, cost, durationMs, etc.
  - Expected: Aggregated tokens.input/output/cacheRead/cacheCreation, cost, costIncomplete OR-fold, callCount, responseChars, durationMs, and model aggregation match the pre-spec golden values byte-for-byte.

- **TC-20: get-status metricsSummary nests providers[provider][profileKey] (R7)**
  - Type: unit
  - Input: flow.json with entries spanning two providers and two profileKeys.
  - Expected: `metricsSummary.providers["claude"]["sonnet"]` (or equivalent) exists with shape `{ callCount, responseChars, durationMs, tokens: { input, output, cacheRead, cacheCreation }, cost, costIncomplete, models }`.

- **TC-21: get-status numeric totals are exact sums per bucket**
  - Type: unit
  - Input: Fixture with three entries in same bucket; known token/cost/duration values.
  - Expected: Each numeric field equals the exact sum of its source entries (no rounding drift).

- **TC-22: get-status costIncomplete OR-fold per bucket**
  - Type: unit
  - Input: Bucket with one entry costIncomplete=true and others false; second bucket with all false.
  - Expected: First bucket costIncomplete=true; second bucket costIncomplete=false.

- **TC-23: get-status falls back to providers.unknown.unknown**
  - Type: unit
  - Input: Entries missing provider and/or profileKey.
  - Expected: Aggregated under `providers.unknown.unknown` with correct numeric sums.

- **TC-24: metrics token JSON rows nest provider buckets with row field names (R10)**
  - Type: integration
  - Input: Build fixture metrics.json; run `metrics token --format json`.
  - Expected: Each row has `providers[provider][profileKey]` with shape `{ tokenInput, tokenOutput, cacheRead, cacheCreate, callCount, cost, costIncomplete, durationMs }`.

- **TC-25: metrics token phaseSummary[phase].providers required and summed**
  - Type: integration
  - Input: Multiple rows in same phase across providers/profiles.
  - Expected: `phaseSummary[phase].providers[p][k]` totals equal sums of contributing rows; costIncomplete is true if any contributing row had costIncomplete true.

- **TC-26: CACHE_VERSION increment forces rebuild of cached metrics.json**
  - Type: integration
  - Input: Pre-seed `.sdd-forge/output/metrics.json` with old-shape rows and the prior CACHE_VERSION; run `metrics token --format json`.
  - Expected: Cache is invalidated and rebuilt with new row shape; output rows contain the new providers buckets.

- **TC-27: report.js buildReportTotals ignores provider buckets (R11)**
  - Type: unit
  - Input: tokenMetrics with provider buckets present.
  - Expected: buildReportTotals returns the same totals it returned before this spec; provider/profile fields are not present in returned totals.

- **TC-28: report.json and report text unchanged in this spec (R11)**
  - Type: integration
  - Input: Run report generation with tokenMetrics containing provider buckets.
  - Expected: report.json and rendered text match pre-spec snapshots (no provider/profile output added).

- **TC-29: review-spec / review-draft mocked usage with cache_creation_tokens > 0 (R8)**
  - Type: integration
  - Input: Mock agent usage returning `cache_creation_tokens: 1234`; run review-spec then review-draft.
  - Expected: Resulting flow metric entry has `tokens.cacheCreation > 0`; corresponding `providers[provider][profileKey]` bucket also has `cacheCreation > 0`.

- **TC-30: Mocked provider usage with cache_creation_tokens = 0 still records provider/profileKey (R8)**
  - Type: integration
  - Input: Mock a non-reporting provider with `cache_creation_tokens: 0`.
  - Expected: Entry has `tokens.cacheCreation === 0` and persists provider/profileKey strings; bucket appears in providers map (visible without live run).

- **TC-31: Backward compatibility — flow get status with legacy flow.json (R9)**
  - Type: acceptance
  - Input: flow.json containing entries that lack provider/profileKey fields.
  - Expected: `sdd-forge flow get status` exits 0; entries are aggregated under `providers.unknown.unknown` without errors.

- **TC-32: Backward compatibility — metrics token --format json with legacy data (R9)**
  - Type: acceptance
  - Input: Older metrics rows lacking provider/profileKey.
  - Expected: `sdd-forge metrics token --format json` exits 0; missing fields aggregate to `unknown`/`unknown` bucket; JSON shape valid.

- **TC-33: CLI surface unchanged (R9)**
  - Type: acceptance
  - Input: `sdd-forge --help`, `sdd-forge flow get --help`, `sdd-forge metrics token --help`.
  - Expected: Command names, option flags, and exit codes match pre-spec snapshots.

- **TC-34: Edge — empty flow.json**
  - Type: unit
  - Input: flow.json with zero entries passed to metricsSummary.
  - Expected: `providers` is `{}`; no errors; numeric defaults are zero where applicable.

- **TC-35: Edge — single entry with provider but missing profileKey**
  - Type: unit
  - Input: One entry `{ provider: "claude", profileKey: null, ... }`.
  - Expected: Aggregated under `providers.claude.unknown`; provider key preserved, profileKey normalized.

- **TC-36: Failure mode — addUserPrompt called before any setter still produces valid systemPrompt ordering**
  - Type: unit
  - Input: Only addUserPrompt calls, no setRole/setRules.
  - Expected: systemPrompt is empty (or contains only set values, none here); userPrompt still contains the appended sections in order; no thrown errors.

- **TC-37: Failure mode — invalid Agent.resolve return value**
  - Type: unit
  - Input: Stub Agent.resolve to return `null` profileKey.
  - Expected: Metric entry stored with `profileKey === "unknown"` (normalization at boundary), no exception.

# Code Review Results

### [ ] 差分の3ファイルだけを対象に、重複・命名・不要コード・設計整合性・単純化の観点で見ます。まず `null` センチネル対応が既存ロジックとどう噛み合っているか、次にこの変更で増えた分岐が局所化できるかを確認しています。### 1. Bound the number of test files executed in retro review
**File:** `src/flow/lib/run-retro.js`
**Issue:** `mappedFileNames` is collected from the entire `test-map.json` and passed to a single `node --test` invocation with no explicit cap. That violates the `bounded-resource-usage` guardrail and can also hit argv-size limits or make retro review time scale unpredictably with spec size.
**Suggestion:** Add an explicit upper bound for `fullPaths` and either fail fast with a clear note or execute in bounded batches. Keep both the per-batch size and total processed file count capped so the review path has deterministic resource usage.

**Verdict:** REJECTED
**Reason:** Speculative and out of scope. The diff is about `null` sentinel handling, not resource bounding. No evidence is given that argv limits or runtime are actually a problem in practice, and the cited `bounded-resource-usage` guardrail isn't established for this code path. Introducing caps (or fail-fast) is a behavior change that could silently truncate review coverage and would need its own design discussion.

### [x] 2. Centralize `test-map` entry normalization instead of repeating raw `null` checks
**File:** `src/flow/lib/run-retro.js`
**Issue:** The new `string[] | null` contract is interpreted through multiple ad hoc branches (`tests === null`, `testMap[r.id] === null`, and fallback-to-empty behavior elsewhere). That spreads sentinel handling across the method and makes future schema changes easy to miss.
**Suggestion:** Introduce a small helper such as `classifyTestMapping(entry)` or `isTestNotRequired(entry)` and reuse it for both file collection and per-requirement status generation. This removes duplicated branching and makes the new state explicit.

**Verdict:** APPROVED
**Reason:** The `=== null` branching now appears in three places (file collection loop in `run-retro.js`, per-requirement mapping in `run-retro.js`, and `review.js`). CLAUDE.md explicitly mandates extracting a helper when the same pattern appears in 2+ places, and centralizing the sentinel semantics makes the contract `string[] | null` explicit and easier to evolve. Pure refactor with no behavioral change.

### [ ] 3. Treat missing requirement keys differently from intentionally empty mappings
**File:** `src/flow/commands/review.js`
**Issue:** `const tests = testMap[r.id] || [];` still collapses `undefined` and `[]` into the same case. After the prompt change, those states are no longer equivalent: every requirement key must exist, while `[]` specifically means “test required but nothing is mapped yet.”
**Suggestion:** Branch explicitly on the raw value: `null` means skip, `[]` means untested, and `undefined` should be reported as an invalid `test-map.json` shape. That keeps runtime behavior aligned with the documented schema instead of silently masking malformed maps.

**Verdict:** REJECTED
**Reason:** This is a behavior change disguised as a refactor. The current `testMap[r.id] || []` collapses `undefined` and `[]` deliberately, and switching `undefined` to an "invalid map" error path adds new validation that could break existing maps and surface as runtime failures during review. Schema enforcement is a separate concern that belongs in a dedicated validation step (e.g. at load time), not in the consumer. Out of scope for the `null` sentinel change.

# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-impl-repair-acceptance/test-coverage.json`

## Blocking Findings

### 1. R4 producer coverage relies on source-text matching for several artifacts
**Target:** specs/318-impl-repair-acceptance/tests/repair-lifecycle.test.js
**Issue:** The test for required fingerprint producers only regex-searches producer source files for writeRepairEvidenceArtifact or stampRepairFingerprint. That can pass if the helper is mentioned but not used on the executable artifact path, and it does not exercise impl-gate, retro, or acceptance-review artifact production behavior.
**Required change:** Replace or supplement the regex source check with executable spec-local coverage that runs or directly invokes each required producer path and asserts the emitted artifact records the current repair fingerprint.
**Why blocking:** R4 requires every artifact produced by those steps to record the current repair fingerprint; the current static anti-pattern could pass without exercising production behavior.

### 2. R8 public CLI acceptance lifecycle coverage is missing
**Target:** specs/318-impl-repair-acceptance/tests/repair-closure-cli.test.js and specs/318-impl-repair-acceptance/tests/semantic-acceptance.test.js
**Issue:** R8 requires public CLI behavior coverage for exhaustive requirement judgments, notMet repair routing, and notVerifiable approval safety without directly mutating flow state or evidence. The CLI test covers repair closure and no-repair PASS, while the acceptance cases directly construct artifacts and mutate an in-memory flow manager.
**Required change:** Add spec-local CLI tests that drive acceptance-review and acceptance-decision behavior through the public commands for exhaustive judgments, notMet routing, and notVerifiable approval safety.
**Why blocking:** An acceptance requirement has no corresponding public CLI coverage and the existing unit-style tests bypass the target API required by R8.

### 3. R2 audit empty-field rejection coverage is incomplete
**Target:** specs/318-impl-repair-acceptance/tests/repair-lifecycle.test.js
**Issue:** The test only verifies ImplRepairEntry rejects an empty sourceFindingIds list. It does not cover rejection of other required empty audit fields such as changedPaths, reason, invalidatedArtifacts, or createdAt.
**Required change:** Add focused assertions that ImplRepairEntry rejects each required audit field when empty.
**Why blocking:** R2 explicitly requires dedicated classes to reject empty audit fields; the current tests leave most required audit fields uncovered.

### 4. R3 plugin fingerprint coverage is missing
**Target:** specs/318-impl-repair-acceptance/tests/repair-lifecycle.test.js
**Issue:** The fingerprint test covers src, .senti/config.json, the active spec, active spec tests, and generated evidence exclusion, but it does not verify additions, removals, or content changes under plugins/.
**Required change:** Add plugin-path cases showing the repair fingerprint changes for plugin file addition, removal, and content change.
**Why blocking:** R3 requires fingerprint changes for any addition, removal, or content change under plugins/; that required input class has no corresponding test coverage.

### 5. R6 mechanical-blocker routing is not exercised
**Target:** specs/318-impl-repair-acceptance/tests/semantic-acceptance.test.js
**Issue:** The tests assert verdict precedence returns blocked for mechanicalBlockers, but do not exercise acceptance routing for a mechanical blocker to ensure the flow fails closed and does not advance to repair, acceptance-decision, or final-regression.
**Required change:** Add a routing test for an acceptance-review artifact with mechanicalBlockers that asserts fail-closed step behavior.
**Why blocking:** R6 requires acceptance routing to fail closed on mechanical blockers; current routing coverage omits that critical path.


## Advisory Findings

No advisory findings.
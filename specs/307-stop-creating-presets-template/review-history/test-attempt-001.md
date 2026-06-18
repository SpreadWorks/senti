# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/307-stop-creating-presets-template/test-coverage.json`

## Blocking Findings

### 1. Managed copy update path is untested
**Target:** specs/307-stop-creating-presets-template/tests/deploy-preset-copies.test.js R3/R4
**Issue:** The R3 and R4 tests only verify creation into an empty temp root. They do not seed stale or incorrect `.senti/presets/base/guardrail.json` or `.senti/presets/base/guardrail-rewrite-rubric.md` files before running `deployPresetCopies()`, so they do not prove the required update behavior.
**Required change:** Add spec-local coverage that pre-creates each managed base file with different content, runs `deployPresetCopies(workRoot, { presetKeys: ["base"] })`, and asserts the resulting content equals the corresponding `src/presets/base/*` source file.
**Why blocking:** R3 and R4 explicitly require create-or-update behavior; the update half has no corresponding regression test coverage.

### 2. Full upgrade preservation path is not covered
**Target:** specs/307-stop-creating-presets-template/tests/deploy-preset-copies.test.js R2
**Issue:** The R2 test runs `new RenameMigration(root).run()` and `deployPresetCopies()`, but it does not exercise the full `senti upgrade` path named by the requirement. A full upgrade could still modify existing `.senti/templates/<lang>/docs/creating_presets.md` while this test passes.
**Required change:** Add spec-local coverage that creates an existing `creating_presets.md` with legacy rename tokens, runs the same full upgrade entrypoint used by `senti upgrade`, and asserts the file contents remain byte-for-byte unchanged.
**Why blocking:** R2 specifically requires preservation before full `senti upgrade` runs; the current test covers only a migration class plus deploy call, not the full upgrade behavior.

### 3. Non-base rubric test may not exercise a real non-base preset
**Target:** specs/307-stop-creating-presets-template/tests/deploy-preset-copies.test.js R5
**Issue:** The R5 test passes `"non-base"` as a preset key, but the test does not establish that this is an actual preset with source files. If that key is ignored because no source preset exists, the test would pass without proving that rubrics are withheld from real non-base preset deployments.
**Required change:** Use an actual non-base preset key from the repository, or otherwise set up a real non-base preset fixture that would exercise production copy behavior, then assert no `.senti/presets/<non-base>/guardrail-rewrite-rubric.md` is returned or written.
**Why blocking:** R5 requires behavior for non-base preset keys; a nonexistent key can pass without exercising the production behavior under review.


## Advisory Findings

No advisory findings.
# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/269-unify-flow-step-names/test-coverage.json`

## Blocking Findings

### 1. R2 route and post-hook behavior is only indirectly covered
**Target:** specs/269-unify-flow-step-names/tests/code-references.test.js
**Issue:** R2 explicitly requires updating src/flow/lib/draft-review-routes.js route definitions and the src/flow/registry.js review post-hook, but the tests only assert a few mapping literals plus absence of seven old unambiguous tokens. A route can be missing, renamed to an incorrect new id, or the post-hook can fail to register the expected new review steps while these tests still pass as long as old literals are absent.
**Required change:** Add focused spec-local assertions for the expected draft-review route definitions and the registry review post-hook targets using the new step ids.
**Why blocking:** This leaves an explicit must requirement without direct regression coverage and the current grep-style test can pass without exercising the required production behavior.

### 2. R7 does not cover report/retro collision-name handling
**Target:** specs/269-unify-flow-step-names/tests/migration-tool.test.js
**Issue:** R7 requires report.json, retro.json, and review.md replacements inside code-block/path strings only, including renamed step ids generally. The fixture only validates the unambiguous id gate-draft in report.json and retro.json, so collision ids review, gate-impl, and impl could be incorrectly replaced or left unchanged in path strings without being detected.
**Required change:** Extend the report.json and retro.json fixture/assertions to include path-string values for the collision ids and assert they are converted to the correct flow-scope names while prose values remain unchanged.
**Why blocking:** The migration tool’s most error-prone rule is scope-sensitive handling of collision ids, and this must requirement currently lacks regression coverage for two required file types.

### 3. R8 repository migration coverage omits required file types
**Target:** specs/269-unify-flow-step-names/tests/migration-tool.test.js
**Issue:** R8 requires verifying migration results in specs/*/flow.json, report.json, retro.json, and review.md, plus issue-log.json collision preservation. The repository-level test only scans non-active flow.json files and does not inspect repository report.json, retro.json, review.md, or issue-log.json after applying the migration.
**Required change:** Add repository-level assertions that inspect specs/*/report.json, specs/*/retro.json, specs/*/review.md, and specs/*/issue-log.json for the required post-migration conditions, while respecting the active flow exclusion for flow.json.
**Why blocking:** The coverage artifact marks R8 covered, but actual tests only cover part of the acceptance requirement, so migrated repository artifacts other than flow.json can regress unnoticed.


## Advisory Findings

### 1. R1 mapping completeness could be clearer
**Target:** specs/269-unify-flow-step-names/tests/definition-and-prompts.test.js
**Improvement:** Consider making the rename mapping a single table in the test and asserting each old-to-new pair, rather than separate NEW_FLOW_LEAVES and OLD_FLOW_LEAVES arrays.
**Why non-blocking:** The current tests do cover the required leaf ids and removed old ids, but a pairwise table would make future diagnosis easier if one mapping is accidentally swapped.

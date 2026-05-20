# Test Review Results

## Verdict: ADVISORY

Coverage artifact: `specs/262-rename-skill-data-dirs/test-coverage.json`

## Blocking Findings

No blocking findings.

## Advisory Findings

### 1. R4 path assertion is overly prescriptive about path.join style
**Target:** specs/262-rename-skill-data-dirs/tests/path-contracts.test.js (R4 test, regex /experimental["'],\s*["']workflow["'],\s*["']skills["']/)
**Improvement:** Loosen the regex to also accept equivalent path expressions such as a single literal `"experimental/workflow/skills"` or `path.join(..., "experimental", "workflow", "skills")` with arbitrary leading segments, so the test enforces the path semantics rather than a specific quoting/segmentation style.
**Why non-blocking:** The current regex matches the conventional path.join style used elsewhere in this codebase, so a compliant implementation will satisfy it; this is purely a robustness improvement.

### 2. R8 verifies upgrade output artifacts but does not exercise `sdd-forge upgrade` exit code
**Target:** specs/262-rename-skill-data-dirs/tests/path-contracts.test.js (R8 test)
**Improvement:** Consider invoking `sdd-forge upgrade` from the test (or relying on a separate e2e test) so that R8's `exit 0 after the rename` clause is actively verified rather than inferred from pre-existing generated artifacts; at minimum, document that the spec depends on upgrade being run as part of implementation.
**Why non-blocking:** R6 frames the spec-local coverage around `upgrade output` (artifact content), and the combination of R2 (no `@templates/` in skill sources) and R8 (artifacts contain expanded `Core Principle` content with no `@templates/`) transitively detects an unrun or failed upgrade; the runtime exit code check belongs to test-execute/final-regression phases.

### 3. R6 file-count threshold is fragile if tests/unit/templates/ is itself renamed
**Target:** specs/262-rename-skill-data-dirs/tests/path-contracts.test.js (R6 test, `existingTestFiles.length >= 8`)
**Improvement:** Either widen the candidate list to include likely renamed locations (e.g. tests/unit/skills/*) or lower the threshold, so the assertion does not flip to failure purely because shared regression tests were relocated alongside the src rename.
**Why non-blocking:** Today's candidate list has 11 entries and only the three under tests/unit/templates/ are likely to move, leaving exactly 8 — still meeting the threshold; this is a future-proofing concern.

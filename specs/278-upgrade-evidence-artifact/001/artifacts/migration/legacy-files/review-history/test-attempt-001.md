# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/278-upgrade-evidence-artifact/test-coverage.json`

## Blocking Findings

### 1. R11 test asserts repoRoot.endsWith("sdd-forge"), which is false in the worktree execution environment
**Target:** specs/278-upgrade-evidence-artifact/tests/upgrade-evidence-artifacts.test.js (R11 test, final assertion; `repoRoot` at top of file)
**Issue:** `repoRoot` resolves via `path.resolve(import.meta.dirname, "../../..")` to the directory that contains `specs/`, which during the flow is the worktree root `/home/nakano/workspace/sdd-forge/.sdd-forge/worktree/feature-278-upgrade-evidence-artifact`. `repoRoot.endsWith("sdd-forge")` is therefore false and the R11 test fails for an environment-specific reason unrelated to spec-header coverage. I verified the resolution: the path ends with `feature-278-upgrade-evidence-artifact`, not `sdd-forge`.
**Required change:** Remove the `assert.ok(repoRoot.endsWith("sdd-forge"))` line (and the now-unused `repoRoot` binding). It does not exercise R11's requirement (spec-header coverage) and encodes a false assumption about the checkout directory name.
**Why blocking:** The test is not executable as written in the actual run environment: R11 will fail regardless of whether the implementation is correct, so the requirement cannot be validated.

### 2. R10 is covered only by a tautological metadata mirror that does not exercise the real upgrade arg parser
**Target:** specs/278-upgrade-evidence-artifact/tests/upgrade-evidence-artifacts.test.js (R10 test) vs src/upgrade.js `parseUpgradeArgs`
**Issue:** R10 requires that the upgrade command keep `--dry-run`/`--help` as no-value boolean flags, add no new user-facing option, and preserve stdout summary behavior. The test only deep-equals a new declarative function `upgradeUserFacingArguments()` against the literal expected array. That function is a restatement of the expected answer; it is decoupled from `parseUpgradeArgs` (which independently hardcodes `flags: ["--dry-run"]`). A developer could add a new option to `parseUpgradeArgs` and the test would still pass as long as the metadata function returns the two entries.
**Required change:** Add at least one assertion that exercises the real parser/behavior R10 constrains — e.g. assert `parseUpgradeArgs(["--dry-run"]).dryRun === true` and `parseUpgradeArgs(["--help"]).help === true` with no value consumed, and that the parser exposes no option beyond these flags — or have `parseUpgradeArgs` derive its flag/option set from `upgradeUserFacingArguments()` and assert that coupling so the two cannot diverge.
**Why blocking:** This is a static anti-pattern: the test passes without exercising production arg-parsing behavior, so R10's substantive requirement (no new option, flags unchanged) is effectively unverified despite the coverage artifact marking R10 'covered'.


## Advisory Findings

### 1. Test introduces MAX_UPGRADE_RAW_OUTPUT_BYTES while requirements name the bound MAX_RAW_OUTPUT_BYTES
**Target:** specs/278-upgrade-evidence-artifact/tests/upgrade-evidence-artifacts.test.js (R3 test) vs R3/R4 requirement text and src/flow/lib/test-artifacts.js `MAX_RAW_OUTPUT_BYTES`
**Improvement:** If the intent is to reuse the existing 64 MiB bound named in R3/R4 (`MAX_RAW_OUTPUT_BYTES`, already exported from test-artifacts.js), reference that symbol instead of inventing `MAX_UPGRADE_RAW_OUTPUT_BYTES`; if a distinct upgrade-specific bound is intended, note that divergence explicitly so the naming drift from the requirement is deliberate.
**Why non-blocking:** Either choice still validates a size bound consistent with R3/R4; this is a naming/consistency concern, not a coverage or correctness gap.

### 2. R3 negative size case may allocate a very large string
**Target:** specs/278-upgrade-evidence-artifact/tests/upgrade-evidence-artifacts.test.js (R3 test, `"x".repeat(MAX_UPGRADE_RAW_OUTPUT_BYTES + 1)`)
**Improvement:** If the implemented bound equals the existing 64 MiB `MAX_RAW_OUTPUT_BYTES`, this allocates and writes a 64 MiB+ string per run; consider a smaller upgrade-specific bound or stubbing the size check so the over-limit case stays cheap.
**Why non-blocking:** The test still exercises the size guard correctly; this only affects test runtime/memory, not validity.

### 3. R3 does not exercise the rawLogPath-mismatch invalidation case
**Target:** specs/278-upgrade-evidence-artifact/tests/upgrade-evidence-artifacts.test.js (R3 test)
**Improvement:** R3 states the raw log is valid only when `upgrade-result.json.rawLogPath` equals `tests/.raw/upgrade.log`; add a negative case where the artifact's `rawLogPath` differs and assert `validateUpgradeEvidenceFiles` returns ok=false.
**Why non-blocking:** The empty-file, oversize, and happy-path cases are covered and the constant equality is asserted; the missing negative case is an additional boundary, not an uncovered requirement.

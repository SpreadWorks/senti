# Test Review Results

## Verdict: ADVISORY

Coverage artifact: `specs/278-upgrade-evidence-artifact/test-coverage.json`

## Blocking Findings

No blocking findings.

## Advisory Findings

### 1. Integration-gate wiring (R4/R5/R6) is only tested at the helper level
**Target:** tests R4/R5/R6 — validateUpgradeEvidenceForChangedFiles
**Improvement:** R4/R5/R6 are phrased about the integration gate, but every test exercises the new standalone helper validateUpgradeEvidenceForChangedFiles. No test drives the real gate entry point (validateIntegrationArtifactTrust / buildGateArtifactTrustContract / INTEGRATION_TRUST_INPUTS). Add at least one test that proves the helper is actually consulted by the gate (e.g. upgrade inputs appear in the contract's required trust inputs, or validateIntegrationArtifactTrust returns a GateArtifactTrustFailure whose .reason carries the upgrade message) so that forgetting to wire the helper into the gate cannot pass green.
**Why non-blocking:** The new logic is fully covered at the helper level and the end-to-end gate enforcement is re-verified at the impl-gate runtime phase, which is out of this reviewer's scope.

### 2. report.json composition (R9) only covers the pure summary builder
**Target:** tests R9 — buildUpgradeEvidenceReportSummary
**Improvement:** R9 requires report.json itself to include an upgradeEvidence summary when upgrade-result.json exists. The test only checks the pure mapping function buildUpgradeEvidenceReportSummary. Add a test asserting that run-report's emitted report includes the upgradeEvidence field when the artifact is present (and omits it when absent).
**Why non-blocking:** The field-mapping contract is covered; whether run-report invokes it is observable at runtime report generation, and R9 is a should-level requirement.

### 3. Artifact-writer behavior (R1/R3/R7) is validated only against hand-built fixtures
**Target:** tests R1/R3/R7 — validateUpgradeResultArtifact / validateUpgradeEvidenceFiles
**Improvement:** R1/R3/R7 concern evidence that is *written* when flow-managed `sdd-forge upgrade` runs. The tests only validate manually-constructed artifacts/logs; no test exercises the code that executes the upgrade, captures stdout/stderr, derives result/skills/configMigration, and writes upgrade-result.json + tests/.raw/upgrade.log. Consider a test (or fixture-driven harness) covering the writer so an empty/missing log or a mis-derived result is caught before runtime.
**Why non-blocking:** Spawning the upgrade CLI is a runtime concern owned by test-execute/impl-gate; validating the artifact shape is the appropriate static-spec coverage and each requirement does have a corresponding validator test.

### 4. R10 `_` positional assertions premise a field absent from the parseArgs contract
**Target:** tests R10 — parseUpgradeArgs(...)._
**Improvement:** src/lib/cli.js parseArgs never returns a `_` array and throws `Unknown option` on positionals, so parseUpgradeArgs(['--dry-run'])._ is currently undefined. The assertions deepEqual(_, []) force the implementer to hardcode `_: []`, making them tautological. Prefer asserting the real contract (e.g. parseUpgradeArgs(['foo']) throws Unknown option) or drop the `_` checks.
**Why non-blocking:** parseUpgradeArgs is in this spec's scope and the implementer can add an empty `_` field without violating R10; the assertion is weak, not contradictory.

### 5. Raw-log size bound diverges from the requirement-named constant (R3/R4)
**Target:** tests R3/R4 — MAX_UPGRADE_RAW_OUTPUT_BYTES
**Improvement:** R3 and R4 both name MAX_RAW_OUTPUT_BYTES, which already exists in test-artifacts.js (64MB). The tests introduce a separate MAX_UPGRADE_RAW_OUTPUT_BYTES. Align the constant (reuse the named one or document why a distinct bound exists) so the gate bound matches the requirement text; also note the oversize case allocates a full-bound `x`-string, which is heavy if it inherits 64MB.
**Why non-blocking:** Both interpretations enforce a `≤ bound` check; this is a naming/value alignment detail that does not change executable test intent.

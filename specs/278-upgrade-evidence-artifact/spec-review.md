# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Flow-managed upgrade execution trigger/owner is left implicit
**Target:** Data Flow / T-2
**Improvement:** The spec defines the artifact contract (R1-R3), gate validation (R4-R6), and durable collection (R8-R9), but never names which flow command/step actually runs `sdd-forge upgrade` and writes the evidence; T-2 only says 'the chosen flow-managed entry point.' Naming the concrete mechanism (e.g. an optional CLI option on `sdd-forge upgrade` invoked during impl, vs a new flow run-step) would make the write path unambiguous.
**Why non-blocking:** The artifact-writing code path and gate enforcement are both specified and testable, and the constraints already hint at an optional CLI option, so an implementer can fill the orchestration choice without spec change; the gate (R4) still enforces presence regardless of who triggers the run.

### 2. Second report.json writer (finalize) not identified for the upgradeEvidence summary
**Target:** run-finalize.js executeCommitPost / R9
**Improvement:** report.json is written by two sites: RunReportCommand in run-report.js AND executeCommitPost in run-finalize.js (lines 282, 301-309), which independently calls generateReport()+saveReport() and is the report that is committed and posted to the issue. R9 and the Overview only name run-report.js. Note that the finalize path must also load upgrade-result.json and pass it into generateReport so the durable report carries upgradeEvidence.
**Why non-blocking:** generateReport() is the shared function both callers use, so an implementer wiring the new field will likely discover both call sites; run-finalize.js is already in scope, so this is a completeness clarification rather than a missing target.

### 3. Changed-file list is computed after the integration artifact check
**Target:** run-gate.js checkIntegrationTestArtifacts / R4 R5
**Improvement:** checkIntegrationTestArtifacts (run-gate.js:2921) runs before the committed/uncommitted/untracked diff is computed (2969-2974), and validateIntegrationArtifactTrust currently takes no changed-file list. To condition upgrade-evidence on src/skills/** or src/presets/** changes, the gate must derive the changed-file set at the upgrade-check point and the validation function must accept it (also enabling spec-local unit tests to inject a changed-file set).
**Why non-blocking:** All needed git helpers live in the named module run-gate.js and the validation signature is the implementer's to design; this is an ordering/parameter detail, not a missing capability.

### 4. Failure-evidence capture interacts with upgrade.js process.exit/exit-code contract
**Target:** upgrade.js main() / R6 + Failure handling decision
**Improvement:** upgrade.js exits via process.exit(EXIT_ERROR) on preset-chain validation failure (line 80) and deploySkills failure (line 104), before any summary write. Since the decision requires failed runs to still write upgrade-result.json and upgrade.log, the spec should make explicit that evidence capture happens around the process (e.g. subprocess capture of stdout/stderr + exitCode) rather than inside main() after the failing call.
**Why non-blocking:** The failure error path is specified (R6 + decision) and is solvable by capturing the command as a child process, which also satisfies the R3 stdout/stderr requirement; it constrains the implementation approach but does not contradict the existing exit-code contract.

### 5. result no_changes/updated determination has no signal for preset-copy deployment
**Target:** upgrade.js deployPresetCopies / R2 R7
**Improvement:** R2 lists 'preset/config migration' among tracked updates, but deployPresetCopies (upgrade.js:115) returns nothing and the existing hasChanges computation (line 157) ignores preset copies entirely. Clarify that result is derived from R1's concrete fields (skills.updated/unchanged/removed, configMigration.changed) so a preset-template-only change that redeploys copies but changes no skill/config correctly yields no_changes (still a passing evidence state per R6).
**Why non-blocking:** R1's fixed field set already defines the determination basis, so the contract is internally consistent; the wording in R2 is loose but does not block implementation or testing, and no_changes remains gate-valid.

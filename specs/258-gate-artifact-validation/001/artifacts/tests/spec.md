# Test Design

### Test Design

- **TC-1: Contract includes flow gate trust inputs**
  - Type: unit
  - Input: Build spec artifact contract for `gate-impl` with `phase=integration`.
  - Expected: Required trust inputs include `test-execute-result.json`, `test-result-review.json`, `file-map.json`, and `tests/.raw/test-execution.log`.

- **TC-2: Contract excludes task-level gate**
  - Type: unit
  - Input: Build spec artifact contract for `gate-impl` with `phase=task-impl`.
  - Expected: Trust-input precondition validation is not applied.

- **TC-3: Contract excludes retro and report**
  - Type: unit
  - Input: Validate `gate-impl phase=integration` artifacts with missing `retro.json` and `report.json`.
  - Expected: Validation does not fail because those files are absent.

- **TC-4: Valid artifact set passes precondition validation**
  - Type: integration
  - Input: Valid `test-execute-result.json`, `test-result-review.json`, `file-map.json`, and matching `tests/.raw/test-execution.log`.
  - Expected: Artifact validation passes and AI guardrail evaluation may proceed.

- **TC-5: Missing test execution result fails early**
  - Type: integration
  - Input: Omit `test-execute-result.json`.
  - Expected: `gate-impl phase=integration` fails with `ARTIFACT_PLACEHOLDER` before AI guardrail evaluation.

- **TC-6: Missing review result fails early**
  - Type: integration
  - Input: Omit `test-result-review.json`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER` before AI guardrail evaluation.

- **TC-7: Missing file map fails early**
  - Type: integration
  - Input: Omit `file-map.json`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER` before AI guardrail evaluation.

- **TC-8: Missing raw execution log fails early**
  - Type: integration
  - Input: Omit `tests/.raw/test-execution.log`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER` before AI guardrail evaluation.

- **TC-9: Malformed JSON artifact fails**
  - Type: integration
  - Input: Provide invalid JSON in `test-execute-result.json`, `test-result-review.json`, or `file-map.json`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-10: Missing required JSON keys fails**
  - Type: unit
  - Input: JSON artifact is syntactically valid but omits required keys such as summary, evidence, verdict, checked items, or requirement mapping.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-11: Empty requirement summary fails**
  - Type: unit
  - Input: `test-execute-result.json` contains an empty requirement summary.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-12: Unknown requirement id in test execution result fails**
  - Type: unit
  - Input: `test-execute-result.json` references a requirement id not present in the spec.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-13: Unknown requirement id in file map fails**
  - Type: integration
  - Input: `file-map.json` maps files to an unknown requirement id.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-14: Raw output line range outside log fails**
  - Type: unit
  - Input: Evidence references `raw_output_lines` beyond the length of `tests/.raw/test-execution.log`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-15: Raw output evidence mismatch fails**
  - Type: unit
  - Input: Evidence line range exists, but expected command/test evidence does not match the referenced raw log content.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-16: Placeholder sentinel in summary command fails**
  - Type: unit
  - Input: Sentinel string appears in `test-execute-result.json summary[].evidence.command`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-17: Placeholder sentinel in test name or file fails**
  - Type: unit
  - Input: Sentinel string appears in `summary[].evidence.test_name` or `summary[].evidence.test_file`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-18: Placeholder sentinel in regression commands fails**
  - Type: unit
  - Input: Sentinel string appears in `regression.command` or `regression.root_test_command`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-19: Placeholder sentinel in review detail fails**
  - Type: unit
  - Input: Sentinel string appears in `test-result-review.json checked_items[].detail`.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-20: Placeholder fixture hash fails**
  - Type: unit
  - Input: JSON artifact content hashes to a documented placeholder fixture hash.
  - Expected: Fails with `ARTIFACT_PLACEHOLDER`.

- **TC-21: File map paths are not globally sentinel-scanned**
  - Type: unit
  - Input: Sentinel-like string appears only inside `file-map.json` path values.
  - Expected: Does not fail solely because of that sentinel string.

- **TC-22: Raw log is not globally sentinel-scanned**
  - Type: unit
  - Input: Sentinel-like string appears only in `tests/.raw/test-execution.log`, outside referenced evidence validation concerns.
  - Expected: Does not fail solely because of that sentinel string.

- **TC-23: Summary scan limit is enforced**
  - Type: unit
  - Input: `test-execute-result.json` has more than 200 summary entries, with a sentinel after entry 200.
  - Expected: Sentinel scan inspects at most 200 entries; behavior matches documented limit.

- **TC-24: Checked item scan limit is enforced**
  - Type: unit
  - Input: `test-result-review.json` has more than 200 checked items, with a sentinel after item 200.
  - Expected: Sentinel scan inspects at most 200 entries; behavior matches documented limit.

- **TC-25: JSON artifact byte limit is enforced**
  - Type: unit
  - Input: JSON artifact larger than 1 MiB with sentinel content beyond the inspected range.
  - Expected: Sentinel scanning inspects at most 1 MiB per JSON artifact.

- **TC-26: Existing version validation still fails**
  - Type: integration
  - Input: `test-execute-result.json` uses unsupported version, such as version 1.
  - Expected: Existing version 2 validation failure remains a failure.

- **TC-27: Existing review verdict validation still fails**
  - Type: integration
  - Input: `test-result-review.json` has verdict other than `pass`.
  - Expected: Existing review verdict validation failure remains a failure.

- **TC-28: Existing spec-local evidence validation still fails**
  - Type: integration
  - Input: Evidence points outside the current spec-local test area.
  - Expected: Existing spec-local evidence validation failure remains a failure.

- **TC-29: Existing regression freshness validation still fails**
  - Type: integration
  - Input: Regression snapshot is stale relative to current expected freshness rules.
  - Expected: Existing regression freshness validation failure remains a failure.

- **TC-30: Placeholder permission exception succeeds**
  - Type: integration
  - Input: Placeholder artifact is present, and `specs/<spec>/placeholder-permission.json` has version `1`, phase `integration`, `approvedByUser: true`, matching non-empty `artifactPaths`, non-empty `permissionText`, non-empty `reason`, and non-empty `createdAt`.
  - Expected: Placeholder precondition does not fail with `ARTIFACT_PLACEHOLDER`; later gate checks still run normally.

- **TC-31: Invalid placeholder permission fails**
  - Type: unit
  - Input: Permission file exists but has wrong version, wrong phase, `approvedByUser: false`, empty artifact paths, missing artifact path, or empty text fields.
  - Expected: Placeholder artifact still fails with `ARTIFACT_PLACEHOLDER`.

- **TC-32: Automated spec test placement and headers**
  - Type: acceptance
  - Input: Inspect automated tests added for this feature.
  - Expected: Tests live under `specs/258-gate-artifact-validation/tests` and include spec headers covering valid artifacts, missing artifacts, malformed artifacts, placeholder sentinel rejection, file-map unknown requirement rejection, and explicit-permission exception behavior.

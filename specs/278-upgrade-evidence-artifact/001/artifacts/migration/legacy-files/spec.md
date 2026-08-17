# Feature Specification: 278-upgrade-evidence-artifact

**Feature Branch**: `feature/278-upgrade-evidence-artifact`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub Issue #362

## Goal
src/skills/** or src/presets/** を変更する SDD flow で、sdd-forge upgrade の実行結果を spec 配下の標準 artifact として保存し、integration gate と finalize/report から検証・参照できるようにする。

## Background
Issue #362 targets a gap in SDD flow evidence. `sdd-forge upgrade` is required after src/skills/** or src/presets/** changes, but the current command only prints a stdout summary. The integration gate already validates machine-readable test trust inputs under the spec directory, and finalize/report already preserve durable test/report artifacts. Upgrade execution has no equivalent artifact contract, so skill/preset flows can depend on terminal history or manual issue-log entries to prove upgrade was run. This spec adds a dedicated upgrade evidence artifact while preserving the existing test artifact contract and normal upgrade CLI behavior.

## Scope
- sdd-forge upgrade の flow-managed 実行結果を specs/<spec>/upgrade-result.json と specs/<spec>/tests/.raw/upgrade.log に保存する artifact contract
- src/skills/** または src/presets/** の変更がある integration gate での upgrade evidence 検証
- upgrade 実行済み、変更なし、更新あり、失敗を区別できる machine-readable evidence
- finalize 後も upgrade-result.json と tests/.raw/upgrade.log を durable artifact として保持し、report.json に要約を含めること
- spec-local tests と必要な shared regression tests による artifact contract、gate、report/finalize の検証

## Out of Scope
- sdd-forge upgrade の配布・migration 処理全体の再設計
- test-execute-result.json または test-result-review.json への upgrade evidence 混入
- npm publish、npm dist-tag、release 操作
- src/skills/** または src/presets/** の個別内容改善
- 生成先の .agents/skills/**、.claude/skills/**、AGENTS.md SDD section、preset-derived copies を upgrade 必須判定の trigger path に含めること

## Constraints
- 外部依存を追加しない。Node.js built-in modules と既存 CLI/flow infrastructure のみを使う。
- src/ 以下に特定プロジェクト固有の値、spec id、issue id、repository 固有 path を hardcode しない。
- 既存の `sdd-forge upgrade [--dry-run]` CLI は stdout summary と exit code contract を維持する。成功は exit code 0、preset chain validation failure または deploySkills failure は既存通り non-zero とする。
- upgrade evidence は test-execute artifact とは別契約にする。test-execute-result.json、test-result-review.json、file-map.json、tests/.raw/test-execution.log の schema と意味は変更しない。
- bounded-resource-usage: upgrade artifact validation は bounded file size と bounded array validation を持つ。raw log は既存 raw output limit と同等以下の上限で読み取る。
- backward-compatible-cli-interface: 既存 upgrade command の user-facing option は削除・意味変更しない。flow evidence のための新しい user-facing option は追加しない。
- validate-user-input-at-entry-point: `sdd-forge upgrade` の user-facing arguments は `--dry-run` と `--help` の boolean flags のみ。どちらも値を受け取らず、format/range validation は不要で、未知 option は既存 parseArgs の entry-point validation で拒否する。
- src/skills/** または src/presets/** を変更した後は sdd-forge upgrade を実行し、生成済み skill/preset artifacts に反映する。

## Design Principles
- Upgrade evidence is a first-class flow artifact, not a note in conversation history or issue-log.
- Keep test execution evidence and upgrade execution evidence separate so each artifact has a narrow validation contract.
- Make the gate decision depend on source changes that require upgrade, not on generated files produced by upgrade itself.
- Reuse the existing artifact pathspec and report/finalize collection patterns instead of adding a parallel persistence mechanism.

## Overview
### Modules
- `src/upgrade.js`: owns the existing `sdd-forge upgrade` command. It currently deploys skills, removes obsolete skills, deploys preset copies, migrates config, and prints stdout summary.
- `src/flow/lib/test-artifacts.js`: owns integration trust input validation and durable artifact pathspecs. It is the target module for upgrade artifact constants, schema validation, and durable pathspec inclusion.
- `src/flow/lib/run-gate.js`: runs task-impl and integration gates against git diff and artifact trust validation. It is the target integration point for requiring upgrade evidence when changed files include src/skills/** or src/presets/**.
- `src/flow/lib/run-report.js`: writes report.json from persisted flow artifacts and git summary. It is the target module for adding upgrade evidence summary fields.
- `src/flow/lib/run-finalize.js`: collects durable artifact pathspecs during finalize. It must continue using the shared durable artifact list after upgrade artifacts are added.

### Data Flow
- A flow changes files -> integration gate computes committed, uncommitted, and untracked diff -> changed paths are checked for src/skills/** or src/presets/**.
- When upgrade-required source paths are present, the flow-managed upgrade execution writes specs/<spec>/tests/.raw/upgrade.log and specs/<spec>/upgrade-result.json.
- integration gate validates upgrade-result.json and raw log path only for flows with src/skills/** or src/presets/** changes. Other flows keep the existing trust input contract.
- finalize/report collect upgrade-result.json and tests/.raw/upgrade.log as durable artifacts and report.json includes a compact upgradeEvidence summary.

### Decisions
- [VERIFY] Checked current upgrade behavior: `sdd-forge upgrade` writes stdout summary and exits through existing success/failure paths, but does not emit a spec-local JSON artifact.
- [VERIFY] Checked artifact contract location: integration trust inputs and durable artifact patterns are centralized in `test-artifacts.js`.
- [VERIFY] Checked finalize/report usage: report writes report.json and finalize commits durable pathspecs derived from `durableTestArtifactPathspecs()`.
- Trigger path decision: upgrade evidence is required only when changed paths include `src/skills/**` or `src/presets/**`.
- Artifact shape decision: `upgrade-result.json` has fixed required fields so gate and report read the same contract.
- Failure handling decision: failed upgrade execution still writes artifact and raw log, and integration gate fails when exitCode is non-zero or result is failed.
- Impact on existing features: existing test trust inputs, normal upgrade stdout, and flows without src/skills/** or src/presets/** changes remain compatible.
- Manual retry reset note: draft-gate retry was reset manually only after the final gate finding was fixed and user approved retry recovery.

## Clarifications (Q&A)
- Q: Which changed paths require upgrade evidence?
  - A: Only source paths under `src/skills/**` and `src/presets/**`. Generated skill copies, AGENTS.md sections, and preset-derived output paths are not trigger paths for this spec.
- Q: Should no-change upgrade runs write evidence?
  - A: Yes. No-change execution is required evidence because it distinguishes a completed upgrade run from a missing upgrade run.
- Q: Should failed upgrade runs write evidence?
  - A: Yes. The artifact and raw log are written for failure diagnosis, and the integration gate fails when the artifact reports non-zero exitCode or result `failed`.
- Q: Does this change the normal upgrade CLI contract?
  - A: No. Existing stdout summary and `--dry-run` semantics remain. Flow evidence is an added contract for flow-managed execution.
- Q: What user-facing arguments does the modified `sdd-forge upgrade` command accept?
  - A: `--dry-run` and `--help` only. Both are boolean flags that take no value and have no range. Flow evidence controls are internal automation behavior, not user-facing CLI options.

## Alternatives Considered
- Store upgrade execution only in issue-log.json — Rejected because Issue #362 explicitly seeks a standard artifact that avoids manual issue-log or conversation-history dependence.
- Embed upgrade execution evidence into test-execute-result.json — Rejected because upgrade execution is not test execution and mixing the contracts would make integration gate trust validation harder to reason about.
- Require upgrade evidence for generated skill/preset output paths as well as src/skills/** and src/presets/** — Rejected because generated paths can be changed by upgrade itself, creating circular trigger/result coupling. Source paths define the upgrade-required condition.
- Write upgrade-result.json only when upgrade changes files — Rejected because no-change execution must be distinguishable from missing execution.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-05T00:49:59.785Z
- Notes: autoApprove: gate-passed spec approved after spec review advisory and spec-gate PASS.

## Requirements
- R1 [must]: When flow-managed upgrade evidence is written, `specs/<spec>/upgrade-result.json` must be a JSON object with version, command, dryRun, exitCode, result, skills.updated, skills.unchanged, skills.removed, configMigration.changed, checkedPaths, and rawLogPath fields.
- R2 [must]: `upgrade-result.json.result` must be one of `no_changes`, `updated`, or `failed`; `no_changes` is used when exitCode is 0 and no skill removal, skill update, preset/config migration, or other tracked update occurred.
- R3 [must]: When flow-managed `sdd-forge upgrade` runs, stdout and stderr from that execution must be saved to `specs/<spec>/tests/.raw/upgrade.log`; the raw log is valid only when that file exists, is non-empty, is no larger than MAX_RAW_OUTPUT_BYTES, and `upgrade-result.json.rawLogPath` equals `tests/.raw/upgrade.log`.
- R4 [must]: When the integration gate runs and the changed file list contains at least one path matching `src/skills/**` or `src/presets/**`, the gate must require a valid upgrade-result.json and a valid raw log before it can PASS; valid raw log means the file at rawLogPath exists under the spec directory, is non-empty, and is no larger than MAX_RAW_OUTPUT_BYTES.
- R5 [must]: When the integration gate runs and no changed file path matches `src/skills/**` or `src/presets/**`, upgrade-result.json must not be required; the existing trust inputs remain test-execute-result.json, test-result-review.json, file-map.json, and tests/.raw/test-execution.log.
- R6 [must]: When upgrade-result.json has exitCode other than 0 or result `failed`, integration gate must FAIL for flows with `src/skills/**` or `src/presets/**` changes and the gate artifact trust failure message must include `upgrade-result.json exitCode=<value> result=<value>`.
- R7 [must]: When flow-managed upgrade execution completes with no updated, removed, or config migration changes, upgrade-result.json must still be written with result `no_changes`, exitCode 0, checkedPaths containing `src/skills` and `src/presets`, and a raw log reference.
- R8 [should]: When finalize collects durable artifacts for the spec, `specs/<spec>/upgrade-result.json` and `specs/<spec>/tests/.raw/upgrade.log` must be included in durable artifact pathspec collection without removing existing durable test/report pathspecs.
- R9 [should]: When report.json is written and upgrade-result.json exists, report.json must include an `upgradeEvidence` summary with artifactPath, rawLogPath, exitCode, result, updatedCount, unchangedCount, removedCount, and configMigrationChanged.
- R10 [must]: When `sdd-forge upgrade` is run by a user, the command must keep the existing user-facing arguments `--dry-run` and `--help` as boolean flags that take no value; it must add no new user-facing option, and normal execution must keep the existing stdout summary behavior.
- R11 [must]: Spec-local tests under `specs/278-upgrade-evidence-artifact/tests/` must include `// spec: R<N>` headers covering upgrade artifact writing, integration gate validation, durable artifact collection, and report summary behavior.

## Acceptance Criteria
- A spec-local test can run flow-managed upgrade evidence generation and assert that upgrade-result.json contains the required fields from R1.
- A spec-local test can simulate no-change upgrade output and assert result `no_changes`, exitCode 0, checkedPaths, and rawLogPath.
- A spec-local test can simulate failed upgrade execution and assert integration gate artifact trust validation rejects it with a message containing `upgrade-result.json exitCode=<value> result=<value>` when src/skills/** or src/presets/** changed.
- A spec-local test can assert raw log validation rejects a missing, empty, or oversized tests/.raw/upgrade.log for src/skills/** or src/presets/** changes.
- A spec-local or shared regression test can assert that integration gate does not require upgrade-result.json when only non-skill and non-preset source paths changed.
- A test can assert durable artifact pathspecs include upgrade-result.json and tests/.raw/upgrade.log while retaining the existing durable test/report artifacts.
- A test can assert report.json includes the `upgradeEvidence` summary fields when upgrade-result.json exists.
- Existing `sdd-forge upgrade --dry-run` and normal `sdd-forge upgrade` behavior remains compatible from the user's perspective.

## Implementation Targets
- src/upgrade.js
- src/flow/lib/test-artifacts.js
- src/flow/lib/run-gate.js
- src/flow/lib/run-report.js
- src/flow/lib/run-finalize.js
- specs/278-upgrade-evidence-artifact/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define upgrade artifact contract
  - Add shared constants, paths, schema validation, and bounded raw-log handling for upgrade-result.json and tests/.raw/upgrade.log.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Capture upgrade execution evidence
  - Connect flow-managed upgrade execution to artifact writing without changing default user-facing upgrade behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Validate integration upgrade evidence
  - Make integration gate require upgrade evidence only when changed source paths require upgrade.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Publish durable upgrade evidence
  - Include upgrade evidence in durable artifact collection and final report summaries.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add regression coverage
  - Add focused spec-local tests and update shared regression tests where existing artifact contracts change.
  - see `tasks/T-5.md` for full spec

# Feature Specification: 316-canonical-regression-snapshots

**Feature Branch**: `feature/316-canonical-regression-snapshots`
**Created**: 2026-07-11
**Status**: Draft
**Input**: GitHub Issue #410

## Goal
project regression の保存時と integration gate 再検証時で同一の RegressionFileSnapshotList factory を使い、changed-file evidence の表現差による F-001 の stale 誤判定を解消する。

## Background
F-001 is an evidence-correctness release blocker. The current test-execute saver fingerprints changed files, but integration gate revalidation compares freshly classified entries that do not contain fingerprints against the persisted arrays by JSON.stringify. The same Git state can therefore fail immediately after a successful required regression. The schema also rejects fingerprint as an additional property while deterministic runtime validation does not validate snapshot item shape, so old and current representations have no single trust contract.

## Scope
- RegressionFileSnapshot と RegressionFileSnapshotList を `src/flow/lib/regression-file-snapshot.js` に定義する。
- required / skipped regression artifact の `changed_files` と `trigger_relevant_changed_files` を canonical snapshot list として保存する。
- integration gate で保存済み snapshot と current snapshot を canonical comparison する。
- test-execute result schema で snapshot item の fingerprint を必須化し、旧 item 形式を rerun-required failure とする。
- unchanged、1 byte change、add、delete、rename、ordering difference、deleted file、legacy artifact、required gate の spec-local automated coverage を追加する。
- source 変更に必要な generated docs synchronization を実行して検証する。

## Out of Scope
- F-001 以外の audit finding の修正。
- targeted / full / skip classification、regression command discovery、final-regression policy の再設計。
- flow hook、step transition、test config key、raw log、summary、review、file-map contract の変更。
- test-execute result root version `2` の compatibility conversion または legacy snapshot item の吸収。
- npm publish、npm dist-tag、official release。

## Constraints
- Node.js 組み込み module のみを使用し、外部依存を追加しない。
- RegressionFileSnapshot と RegressionFileSnapshotList の constructor が invariant を強制し、serialization と comparison を class の behavior として保持する。
- artifact root versionは `2` を維持するが、snapshot item の `fingerprint` は必須とし、欠落する旧形式を変換せず rerun-required error にする。
- snapshot entry 数は git changed-file helper の上限 2000 と共有し、regression enumeration は `untrackedFiles: "all"` で untracked directory を leaf files に展開し、file hashing は固定長 buffer で行って whole-file memory loading を避ける。
- status、path、old_path、fingerprint 以外の project 固有情報を `src/` に埋め込まない。
- 既存 tests の失敗 scenario が妥当な場合、test expectation を迂回せず product code を修正する。
- `src/skills/` と `src/presets/` は変更しないため、この spec 自体は `senti upgrade` を要求しない。該当 path が実装中に変更された場合のみ repository rule に従って実行する。

## Design Principles
- Canonicalization before persistence and comparison: 同じ changed-file set は入力順に依存せず同じ JSON value になる。
- One value owner: hashing、normalization、sorting、validation、serialization、equality は RegressionFileSnapshotList に集約する。
- Fail closed on legacy evidence: fingerprint を欠く artifact は trusted evidence とせず test-execute rerun を要求する。
- Migration parity: command orchestration、classification、config、hooks、raw/review artifacts、side effects は既存 owner に残す。

## Overview
### Modules
- `src/flow/lib/regression-file-snapshot.js`: RegressionFileSnapshot と RegressionFileSnapshotList。changed-file entry の validation、SHA-256 fingerprint、canonical sort、JSON serialization、equality を所有する。
- `src/flow/lib/run-test-execute.js`: existing orchestration を維持し、required / skipped regression evidence の two changed-file lists を shared factory から保存する。
- `src/flow/lib/test-artifacts.js`: snapshot schema validation と integration gate freshness comparison を shared value class で行う。
- `src/flow/lib/test-regression.js`: classification owner を維持し、existing withChangedFileFingerprints API を shared factory への delegation に置換する。
- `src/lib/git-helpers.js` と `src/flow/schemas/test-execute-result.schema.json`: changed-file count bound を共有し、fingerprint-required JSON contract を宣言する。

### Data Flow
- Save: Git changed leaf entries (`untrackedFiles: all`) → existing classification → RegressionFileSnapshotList.fromChangedFiles(root, entries) → canonical JSON arrays → test-execute-result.json.
- Validate: test-execute-result.json arrays → RegressionFileSnapshotList.fromJSON() → legacy/malformed item rejection before trust checks.
- Revalidate: current Git entries → existing classification → the same fromChangedFiles factory → equals(saved list) → unchanged PASS or rerun-required stale failure.
- Parity: command discovery → targeted/full/skip planning → process execution → raw log/summary/review → gate transition remains on existing paths; only changed-file value creation and comparison move.

### Decisions
- [VERIFY] Save path / `run-test-execute.js` / result=match: required evidence currently adds fingerprints before persistence, confirming the Issue premise that save representation includes content identity.
- [VERIFY] Gate path / `test-artifacts.js` / result=match: current classification entries are compared directly with persisted fingerprint entries, reproducing F-001 by representation mismatch.
- [VERIFY] Artifact schema / `test-execute-result.schema.json` / result=match: root version is `2`, but changed-file items omit the fingerprint field that the saver emits.
- [VERIFY] Git detail contract / `git-helpers.js` / result=match: status/path/old_path values are normalized, deduplicated, bounded, and stably sorted before snapshot creation.
- Keep array-shaped artifact fields and root version `2`; require fingerprint on each item so existing array consumers remain valid while old no-fingerprint evidence fails closed.
- Use canonical value equality rather than raw JSON equality so input ordering cannot create false stale results while status/path/old_path/fingerprint changes remain detectable.
- Enumerate untracked content with `untrackedFiles: all` before classification so directory paths never collapse nested file identity into a null fingerprint.

## Clarifications (Q&A)
- Q: Does artifact schema update require changing test-execute-result root version `2`?
  - A: No. The changed-file item contract is updated by making fingerprint required string-or-null. This deterministically separates legacy no-fingerprint items while retaining existing array consumers and the unrelated v2 summary/process contract.
- Q: How is a deleted file fingerprinted?
  - A: The snapshot retains status/path/old_path and stores fingerprint null for a deleted path. Untracked directories are expanded by Git with untrackedFiles=all before snapshot creation, so their leaf files receive content fingerprints. The null field is explicit and required, so missing legacy fields remain distinguishable.
- Q: Which behavior is intentionally removed?
  - A: Only successful trust of changed-file artifact items that omit fingerprint. The user-visible recovery is to rerun test-execute; no automatic compatibility conversion is provided.

## Alternatives Considered
- Add fingerprints only in the gate before raw JSON comparison — This fixes one call site but leaves normalization, ordering, schema validation, and future producers split across modules, so the representation can diverge again.
- Strip fingerprints from saved evidence — This would make unchanged arrays comparable but would lose one-byte content-change detection and weaken evidence correctness.
- Wrap lists in a new artifact object and bump all test-execute evidence to version `3` — This forces unrelated consumer, fixture, prompt, and report migrations. Requiring fingerprint on the existing array item schema gives an unambiguous legacy boundary within the Issue scope.
- Accept legacy items by computing missing fingerprints during validation — This is compatibility absorption prohibited by Issue #410 and the alpha policy, and it would trust evidence that did not record content identity at execution time.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-11T14:47:11.065Z
- Notes: User approved Wave 1 specifications for Issues #410, #411, and #412 together by selecting option 1 on 2026-07-11.

## Requirements
- R1 [must]: listRegressionChangedFiles shall request untrackedFiles=all so untracked directories become bounded leaf entries; RegressionFileSnapshotList shall construct immutable canonical snapshots from at most 2000 modified/added/deleted/renamed/untracked entries, normalize POSIX paths, retain status/path/old_path, compute a SHA-256 fingerprint with fixed-size buffered reads or explicit null for deleted paths, reject duplicate or malformed entries, sort independently of input order, serialize to JSON, parse persisted JSON, and compare value equality.
- R2 [must]: RunTestExecuteCommand shall use RegressionFileSnapshotList.fromChangedFiles for both changed_files and trigger_relevant_changed_files in required and skipped regression artifacts; the test-execute result schema and deterministic validator shall require fingerprint as a string or null and reject no-fingerprint legacy items with a rerun-test-execute reason.
- R3 [must]: Integration regression evidence validation shall parse saved lists with RegressionFileSnapshotList.fromJSON, build both current classified lists with the same fromChangedFiles factory, and compare canonical values so unchanged and reordered entries pass while a 1 byte content change, add, delete, rename, or content change under an untracked directory produces a stale rerun-required failure; deleted files shall remain comparable with fingerprint null.
- R4 [must]: The migration shall preserve user-facing test-execute and integration-gate command behavior, listRegressionChangedFiles/classifyRegression/planTestExecuteRegression APIs, flow hooks, test.command/test.projectPaths/test.testExecuteRegression config, targeted/full/skip planning, process execution, raw log, summary, review, file-map, and step-transition behavior; only successful trust of legacy no-fingerprint snapshots is intentionally removed and replaced by rerun requirement.

## Acceptance Criteria
- AC1 (R1): The same changed-file entries in different input orders produce equal RegressionFileSnapshotList values and byte-identical JSON serialization.
- AC2 (R1): Snapshot tests distinguish modified content by one byte; represent add, delete, rename, old_path, untracked leaf files, and an already deleted file; and prove untrackedFiles=all expands an untracked directory within the 2000-entry bound.
- AC3 (R2): Required and skipped artifacts written by the save path contain fingerprint on every changed_files and trigger_relevant_changed_files item and satisfy the updated JSON/deterministic schema.
- AC4 (R2): An old-format artifact whose snapshot item lacks fingerprint is not successful evidence and returns a message requiring test-execute rerun; it is not converted or accepted.
- AC5 (R3): A required=true, result=pass artifact passes integration regression evidence validation immediately after save when the worktree is unchanged.
- AC6 (R3): After save, a one-byte edit, added file, deleted file, rename, or one-byte edit inside a previously saved untracked directory makes the relevant canonical snapshot unequal and the gate requires rerun.
- AC7 (R3): Reordering saved or current input entries alone does not produce a stale-snapshot failure, and unchanged deleted-file entries compare equal with fingerprint null.
- AC8 (R4): Existing targeted/full/skip classification, command discovery/execution, skipped artifact fields, config handling, raw evidence, review, file-map, hook, and step-transition tests continue to pass through the canonical snapshot path.
- AC9 (R1-R4): Spec-local failure reproduction fails against the pre-fix source, then all spec-local tests and required targeted project regression pass after implementation.
- AC10 (R1-R4): Docs synchronization reports the source-derived docs state, and no upgrade is required unless an upgrade-trigger source path enters the final diff.
- AC11 (R1): `specs/316-canonical-regression-snapshots/tests/regression-file-snapshot.test.js` begins with `// spec: R1` and executes canonical model, ordering, lifecycle, untracked-directory, and bounded hashing scenarios.
- AC12 (R2-R4): `specs/316-canonical-regression-snapshots/tests/regression-artifact-gate.test.js` begins with `// spec: R2 R3 R4` and executes save/schema/legacy rejection, immediate required gate, stale-change, and retained behavior scenarios.

## Implementation Targets
- src/flow/lib/regression-file-snapshot.js
- src/flow/lib/run-test-execute.js
- src/flow/lib/test-regression.js
- src/flow/lib/test-artifacts.js
- src/flow/schemas/test-execute-result.schema.json
- src/lib/git-helpers.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define canonical regression snapshots
  - Create the immutable snapshot value model and centralize changed-file hashing, validation, canonical ordering, serialization, and equality.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Persist canonical regression snapshots
  - Make test-execute artifacts persist canonical snapshots for every regression outcome and enforce the new item schema without legacy absorption.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Revalidate canonical regression snapshots
  - Use the shared factory and value equality at integration gate so fresh evidence passes and substantive Git changes require rerun.
  - see `tasks/T-3.md` for full spec

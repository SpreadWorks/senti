# Feature Specification: 301-no-tests-valid-state

**Feature Branch**: `feature/301-no-tests-valid-state`
**Created**: 2026-06-15
**Status**: Draft
**Input**: GitHub Issue #392

## Goal
Flow のテスト系 artifact contract にテスト不在を表す正当状態を追加し、プロジェクトや spec がテストを持たない場合でも step promotion が壊れないようにする。

## Background
Flow の regression-test 関連 step はテストが存在する前提で作られている。Issue #392 では、spec-local tests 0 件かつ testable requirement ありの場合に missing.test.js の ENOENT で test-execute-result.json が作られないこと、project-level regression command 不在が final-regression で invalid_project_test になること、downstream artifact が test execution 前提の contract になっていることが確認されている。本 spec は、テスト不在を明示 artifact として表現し、schema / validator / post-hook / consumer がその状態を検証できるようにする。

## Scope
- test-execute は spec-local tests 0 件かつ testable requirement ありでも ENOENT を起こさず、test-execute-result.json と raw log に not_applicable 証跡を残す。
- test-execute-result.json v2 schema / validator / evidence validation は summary[].result = not_applicable と reason = no_tests_declared を機械検証する。
- test-result-review は no-tests artifact を fabricated evidence と誤判定せず、raw decision log と artifact contract を検証して pass できる。
- retro は not_applicable requirement を done / not_done とは別に集計し、summary に not_applicable_count を出す。
- final-regression は project-level regression command 不在を invalid_project_test に直結させず、skipKind = skipped_by_project_policy の skipped artifact として記録できる。
- impl-gate、acceptance-review、report、finalize artifact commit は既存 artifact file name を保持したまま新 contract を消費する。
- 実行済みテストの failure、spawn error、timeout、無関係な missing file は no-tests skip と混同しない。

## Out of Scope
- scenario-validity と plan/test の仕様全体は再設計しない。
- 既存テストコマンドが存在して失敗するケースを skip に変えない。
- 特定プロジェクト専用の test policy、固定 path、固定 command を src/ に埋め込まない。
- artifact file name や public flow command name は変更しない。

## Constraints
- 外部依存は追加しない。Node.js 組み込みモジュールのみを使う。
- src/ 以下に特定プロジェクト固有の値や構造を含めない。
- alpha policy に従い、旧 artifact format との後方互換 shim は追加しない。現在の v2 contract を更新する。
- No Silent Error Swallowing: no-tests は分類済み artifact と raw decision log に記録し、catch で ENOENT や command discovery error を黙って捨てない。
- Migration parity: `senti flow run test-execute`, `test-result-review`, `retro`, `final-regression` の command、artifact path、post-hook promotion は保持する。
- skipped_by_project_policy は no supported regression command source が確認できた場合だけ使う。malformed configured command、invalid test.command syntax、その他の command discovery invalid state は invalid_project_test failure として残す。

## Design Principles
- テスト不在は failure の握りつぶしではなく、artifact contract 上の明示状態として扱う。
- pass/fail 二値前提を持つ consumer は、not_applicable / skipped を schema と validator 経由で処理する。
- 本物の test failure は従来どおり gate を止める。skip はテスト不在が source/config から判定できる場合だけ許可する。

## Overview
### Modules
- src/flow/lib/run-test-execute.js owns spec-local execution and writes test-execute-result.json v2 plus tests/.raw/test-execution.log.
- src/flow/lib/test-artifacts.js and src/flow/schemas/*.schema.json own artifact validation for test-execute, test-result-review, retro, and final-regression.
- src/flow/lib/run-test-result-review.js, run-retro.js, and run-final-regression.js consume or produce downstream artifacts that must recognize no-tests states.
- src/flow/registry.js post hooks keep step promotion fail-closed by validating the updated artifacts before marking steps done.

### Data Flow
- test-execute detects spec-local tests. If none exist, it writes raw decision log lines and per-requirement summary entries with result=not_applicable and reason=no_tests_declared.
- test-result-review validates the not_applicable summary against requirements and raw decision log, then writes pass review artifacts when the no-tests contract is complete.
- retro aggregates pass/fail/not_applicable requirement states from verified test-execute artifacts without re-running tests.
- final-regression discovers the project regression command. If none exists, it writes a skipped artifact with skipKind=skipped_by_project_policy and retained raw attempt log.

### Decisions
- [VERIFY] test-execute currently synthesizes missing.test.js when spec-local tests are absent; result=match.
- [VERIFY] test-execute-result v2 currently only accepts pass/fail summary results; result=match.
- [VERIFY] final-regression currently classifies command discovery failure as invalid_project_test; result=match.
- Choose summary[].result=not_applicable and summary[].reason=no_tests_declared for spec-local no-tests requirements.
- Choose final-regression skipKind=skipped_by_project_policy for project regression command absence.
- Define skipped_by_project_policy proof as command-discovery evidence, not a proof exemption.
- Retain public commands and artifact file names while updating their contracts.

## Clarifications (Q&A)
- Q: テスト不在は failure を隠すための fallback か。
  - A: いいえ。テストが存在しないことを source/config から分類できる場合だけ not_applicable / skipped_by_project_policy として記録する。実行済みテストの failure は failure のまま扱う。
- Q: command discovery error はすべて skipped_by_project_policy になるか。
  - A: いいえ。skipped_by_project_policy は no supported regression command source が確認できた場合だけ使う。malformed configured command、invalid syntax、その他の invalid discovery state は invalid_project_test failure として扱う。
- Q: skipped_by_project_policy artifact の proof は必要か。
  - A: はい。proof.kind は skipped_by_project_policy とし、proof.commandDiscovery.checkedSources、supportedCommandFound=false、invalidConfiguredCommand=false、reason を含める。proof なしの skipped artifact は validator が reject する。
- Q: summary を空配列にすればよいか。
  - A: いいえ。testable requirement が存在する場合は、各 requirement の未実行理由を not_applicable entry として残す。空配列は requirement の存在を downstream から見えなくするため使わない。

## Alternatives Considered
- missing.test.js の ENOENT だけを catch して成功扱いにする。 — artifact contract に no-tests state が残らず、test-result-review / retro / gate が機械検証できないため不採用。
- testable requirement がある no-tests case で summary を空配列にする。 — requirement coverage 情報が失われ、retro が未検証と適用外を区別できないため不採用。
- project regression command 不在を invalid_project_test のまま維持する。 — Issue #392 の confirmed behavior を解消せず、テスト無しプロジェクトを壊れた設定として扱い続けるため不採用。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-15T15:38:49.344Z
- Notes: autoApprove: approved gate-passed spec for Issue #392

## Requirements
- R1 [must]: test-execute は spec-local tests 0 件かつ testable requirement ありの場合、missing.test.js を evidence として読まず、各 testable requirement を result=not_applicable, reason=no_tests_declared として test-execute-result.json に記録する。
- R2 [must]: test-execute-result.json v2 schema と validateTestExecuteResultV2 / validateSummaryEvidence は not_applicable summary entries を受け付け、raw_output_lines と reason を検証する。
- R3 [must]: test-result-review は no-tests artifact の summary membership、raw decision log、project regression contract を検証し、complete な artifact なら verdict=pass を書く。
- R4 [must]: retro は verified test-execute artifact の not_applicable entries を not_done ではなく not_applicable として集計し、summary に not_applicable_count を含める。
- R5 [must]: final-regression は no supported regression command source が確認できた場合だけ skipKind=skipped_by_project_policy, completed=true, nextAction=finalize-commit の skipped artifact と raw attempt log を書き、malformed configured command や invalid discovery state は invalid_project_test failure のまま扱う。
- R6 [must]: impl-gate、acceptance-review、report、finalize artifact handling は既存 artifact file names を保持し、not_applicable / skipped_by_project_policy を valid contract として消費する。
- R7 [must]: 実行開始済みテストの non-zero exit、timeout、signal、spawn failure、無関係な missing file は no-tests state に変換せず、従来どおり failure として扱う。

## Acceptance Criteria
- spec-local tests 0 件かつ testable requirement ありの fixture で `senti flow run test-execute` 相当の runner が test-execute-result.json と tests/.raw/test-execution.log を作り、summary に全 testable requirement の result=not_applicable と reason=no_tests_declared が含まれる。
- not_applicable summary artifact を `validateTestExecuteResultV2` と schema validation が受け付け、test_file / test_name が無いことだけを理由に reject しない。
- no-tests test-execute artifact に対して `senti flow run test-result-review` 相当の validator が verdict=pass の test-result-review.json / .md を作る。
- verified no-tests artifact に対して `senti flow run retro` 相当の aggregator が retro.json を作り、not_applicable_count が testable requirement 数と一致する。
- project regression command source が存在しない fixture で final-regression-result.json が result=skipped, skipKind=skipped_by_project_policy, completed=true, process.started=false を含み、post-hook promotion 条件を満たす。
- malformed test.command または invalid command discovery fixture では final-regression-result.json が result=fail, failureKind=invalid_project_test を含み、skipped_by_project_policy にならない。
- skipped_by_project_policy artifact は proof.kind=skipped_by_project_policy と proof.commandDiscovery を持ち、checkedSources、supportedCommandFound=false、invalidConfiguredCommand=false、reason を validator が検証する。
- 既存テストコマンドが存在して non-zero exit する fixture では final-regression または test-execute regression が fail artifact を作り、skipped_by_project_policy にならない。
- impl-gate / acceptance-review / report に相当する artifact loaders が updated contract を読み、既存 artifact file name のまま no-tests state を表示または判定できる。

## Implementation Targets
- src/flow/lib/run-test-execute.js
- src/flow/lib/run-test-result-review.js
- src/flow/lib/run-retro.js
- src/flow/lib/run-final-regression.js
- src/flow/lib/test-artifacts.js
- src/flow/schemas/test-execute-result.schema.json
- src/flow/schemas/test-result-review.schema.json
- src/flow/schemas/retro.schema.json
- src/flow/schemas/next-action/final-regression.schema.json
- src/flow/registry.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Update artifact contracts
  - Extend schemas and validators so test-execute, test-result-review, retro, and final-regression can represent no-tests states without weakening failure handling.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Record spec no-tests
  - Change test-execute so spec-local test absence is recorded as explicit per-requirement not_applicable evidence instead of missing.test.js ENOENT.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Consume no-tests results
  - Update test-result-review and retro so verified no-tests test-execute artifacts pass integrity review and aggregate as not_applicable.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Skip absent regression
  - Change final-regression so absence of a project regression command can be recorded as skipped_by_project_policy instead of invalid_project_test.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Preserve consumers
  - Update downstream loaders, gate/report paths, and post-hook checks so existing artifact names remain valid while no-tests states are displayed and promoted correctly.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add regression coverage
  - Add spec-local and shared regression tests that prove no-tests states work and real failures are not skipped.
  - see `tasks/T-6.md` for full spec

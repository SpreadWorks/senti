# Feature Specification: 271-flow-judgment-contract

**Feature Branch**: `feature/271-flow-judgment-contract`
**Created**: 2026-06-02
**Status**: Draft
**Input**: GitHub Issue #350

## Goal
flow の判定 artifact と step completion 判定を共通契約で扱い、R2 の normal completion policy を満たさない non-normal artifact + done step が承認済み override か状態不整合かを機械的に判別できるようにする。

## Background
現在の flow は review、gate、test-result-review、final-regression がそれぞれ異なる artifact shape と post hook 条件を持つ。個別の stop handling は存在するが、失敗分類、blocking finding、next action、resume 判断、step status 更新条件の語彙が揃っていない。そのため、同じ失敗が再開後に繰り返される場合や、R2 の normal completion policy を満たさない artifact が残ったまま step が done になった場合に、承認済み例外と状態不整合を機械的に区別しにくい。

## Scope
- [must] test-review、impl-review、impl-gate、test-result-review、final-regression の判定 artifact を共通 contract input へ正規化する。
- [must] normal completion 条件を step ごとに定義し、artifact existence、permitted verdict、blocking finding count を検証する。
- [must] override completion 条件を定義し、user approval、reason、finding disposition、successor owner、accepted risk を検証する。
- [must] non-normal artifact + done step を、override evidence の有無で承認済み例外か状態不整合かに分類する。non-normal artifact は R2 の normal completion policy を満たさない対象 artifact を指す。
- [should] resume 判定の入力として step id、artifact path、verdict、blocking finding count、input fingerprint、artifact fingerprint、nextAction を記録する。

## Out of Scope
- GitHub Projects workflow の状態遷移変更。
- AI provider、model、agent 実行方式の変更。
- Issue #350 に含まれない flow step の全面再設計。
- 既存 CLI コマンドの削除、または外部 npm 依存の追加。

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 flow 構造だけを使う。
- 意味のある値は専用クラスで表現する。共通契約、completion result、override evidence、finding disposition はオブジェクトリテラルの discriminated union だけで表現しない。
- 既存 artifact の読み手が必要とする verdict / path / failureKind の意味は共通契約へ移す。旧フォーマット互換のためだけの分岐は追加しない。
- exit-code-contract: 新しいユーザー向け CLI コマンドと user-facing option は追加しない。既存 `flow run gate`、`flow run review`、`flow run test-result-review`、`flow run final-regression`、`flow set step` は、契約検証に失敗した場合に既存どおり non-zero envelope を返す。
- override completion は normal completion と同じ status 更新ではない。R2 の normal completion policy を満たさない non-normal artifact を done 相当に扱うには、契約上の override evidence が必要である。

## Design Principles
- 各 step の責務分離は維持する。review は detection、triage は disposition、repair は mutation/audit、gate は mechanical validation を担当する。
- completion 判定は artifact verdict だけで推測しない。target artifact、blocking finding count、failure kind、next action、override evidence を独立した信号として扱う。
- 過去の失敗情報は prompt 文だけでなく構造化 artifact と validator へ戻し、再開後に同じ失敗を繰り返す条件を減らす。

## Overview
### Modules
- `src/flow/lib/flow-judgment-contract.js` を追加し、FlowJudgmentContract、StepCompletionPolicy、OverrideCompletionEvidence、FindingDisposition などの専用クラスで invariant を表現する。
- `src/flow/registry.js` と `src/flow/lib/set-step.js` は step completion policy を参照し、post hook と manual done transition の条件を同じ validator で判定する。
- `src/flow/lib/test-artifacts.js`、`src/flow/lib/run-test-result-review.js`、`src/flow/lib/run-final-regression.js`、`src/flow/lib/run-review.js` は既存 artifact を共通 contract input へ変換する。
- `src/flow/lib/run-gate.js` は integration phase の gate verdict を `specs/<spec>/impl-gate-result.json` に保存し、impl-gate の contract input を提供する。
- `src/flow/schemas/next-action/*.schema.json` と対象 artifact schema は、既存必須 field の意味を維持しながら contract summary と completion evidence を表現する。

### Data Flow
- 各 step の raw artifact を converter が FlowJudgmentContract へ正規化する。completion validator は policy matrix と contract を比較し、normal / override / inconsistent のいずれかを返す。
- normal completion は artifact exists + permitted verdict + blockingCount=0 で成立する。override completion は failed contract + valid OverrideCompletionEvidence で成立する。
- OverrideCompletionEvidence は `specs/<spec>/completion-overrides.json` の step-keyed entries から読み取る。AI skill/operator は user approval 後にこの artifact を書き、validator は自由文 issue-log ではなくこの JSON を読む。
- resume 判定用の progress signature は step id、artifact path、verdict、blocking count、failure kind、nextAction、input/artifact fingerprint から構成され、issue-log と next-action diagnosis の入力になる。

### Decisions
- [VERIFY] 判定と step status は現在 step ごとに分散しているため、共通 contract に集約する。
- [VERIFY] final-regression は既に failureKind、retryable、nextAction を持つため、共通契約の失敗分類入力として扱う。
- [VERIFY] artifact schema は全面置換せず、既存読み手が必要とする意味を共通 contract へ移す。
- [VERIFY] override completion は normal done と同義にしない。
- [CORRECTION] override evidence は `completion-overrides.json`、impl-gate verdict は `impl-gate-result.json` を durable source とする。
- [IMPACT] Existing flow runtime features affected: review post-hooks, gate execution, manual step completion, test-result validation, final-regression classification, retro/report artifact readers, next-action diagnosis, and spec-local test header validation.

## Clarifications (Q&A)
- Q: 対象 step はどこまで含めるか。
  - A: 必須範囲は test-review、impl-review、impl-gate、test-result-review、final-regression。draft-review / spec-review / spec-gate は既存 route と矛盾しない確認に留める。
- Q: artifact schema は全面置換するか。
  - A: 全面置換しない。既存読み手が必要とする verdict / path / failureKind の意味を維持し、共通 contract summary を追加する。旧フォーマット互換のためだけの分岐は追加しない。
- Q: resume 判定はどこまで含めるか。
  - A: この spec では progressSignature と入力/artifact fingerprint の記録までを含める。retry policy 全体の再設計は含めない。
- Q: validate-user-input-at-entry-point: `flow set step <id> <status>` の入力 validation は何を要求するか。
  - A: `<id>` は string で、現在の flow definition または active task definition に存在する step id のみ許可する。`<status>` は pending、in_progress、done、skipped の enum のみ許可する。completion validator は `<status>` が done で対象 step が test-review、impl-review、impl-gate、test-result-review、final-regression の場合だけ実行する。未知 step id、未知 status、または対象 step の invalid completion は non-zero Envelope.fail を返し、step status を永続化しない。

## Alternatives Considered
- retry limit と prompt だけを調整する — non-normal artifact + done step の意味を機械判定できず、同じ失敗分類を後続 step が共有できないため採用しない。
- 既存 artifact schema を全面置換する — registry、retro、report、gate など現行読み手を同時に不安定化させる。ユーザーは既存必須 field の意味を保つ方針を選択した。
- override を issue-log の自由文だけで記録する — finding ごとの disposition、successor owner、accepted risk を validator が安定して読めないため採用しない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-02T05:06:36.607Z
- Notes: User approved spec 271 and asked to proceed

## Requirements
- R1 [must]: FlowJudgmentContract 系の専用クラスを追加し、targetStep、artifactPath、verdict、blockingFindings、failureKind、nextAction、rawArtifactPath、inputFingerprint、artifactFingerprint を constructor invariant として検証する。
- R2 [must]: 対象 step ごとの normal completion policy を定義する。test-review と impl-review は PASS または ADVISORY かつ blockingFindings=0、impl-gate は pass かつ blockingFindings=0、test-result-review は verdict=pass、final-regression は result=pass かつ failureKind=null かつ nextAction=finalize-commit のときだけ normal completion を許可する。
- R3 [must]: OverrideCompletionEvidence を定義し、`specs/<spec>/completion-overrides.json` に step id ごとの entries として保存する。各 entry は userApproval=true、reason、approvedAt、approvedBy、各 blocking finding の disposition、successorOwner、acceptedRisk を必須にする。disposition は out_of_scope、transferred_to_successor、accepted_risk、false_positive を少なくとも許可する。
- R4 [must]: completion validator は FlowJudgmentContract、step policy、`completion-overrides.json` から読み取った step id 一致の override evidence を入力にし、normal、override、inconsistent のいずれかを返す。R2 の normal completion policy を満たさない non-normal artifact + done step で valid override evidence がない場合は inconsistent を返す。
- R5 [must]: `flow set step <id> done` と registry post hook は、対象 step の completion validator を通過した場合だけ done を永続化する。validator は `completion-overrides.json` を読むが、新しい user-facing CLI option は追加しない。validator failure は step status を変更せず、Envelope.fail の data.completionValidation に stepId、result、reason、artifactPath、overridePath を保存する。
- R6 [must]: 対象 review / gate / test-result-review / final-regression artifact は contract summary を提供する。test-review は verdict、blockingFindings、advisoryFindings、summary、toolingFailure を維持する。impl-review は verdict、blockingFindings、nonBlockingImprovements、summary、excluded を維持する。test-result-review は verdict、checked_items、result_file_path、raw_output_path、invalid_reason を維持する。final-regression は version、completed、result、command、rawOutputPath、rawOutputLines、failureKind、retryable、nextAction、changedFiles、process を維持する。impl-gate では `src/flow/lib/run-gate.js` が verdict、issues、nextAction、contractSummary を持つ `specs/<spec>/impl-gate-result.json` を保存し、その artifactPath を validator が読む。summary は targetStep、artifactPath、verdict/result、blockingCount、failureKind、nextAction、completionKind、progressSignature を含む。
- R7 [should]: progressSignature は targetStep、artifactPath、verdict/result、blockingCount、failureKind、nextAction、inputFingerprint、artifactFingerprint から生成し、同一入力で同一文字列、入力または artifact が変わると異なる文字列になる。
- R8 [must]: spec-local tests は `specs/271-flow-judgment-contract/tests/` に作成し、各 test file 先頭に `// spec: R<N> ...` header を置いて R1-R7 を検証する。少なくとも normal completion PASS、FAIL without override inconsistent、FAIL with valid override override、invalid disposition rejection、progressSignature change detection を含める。

## Acceptance Criteria
- 対象 step の completion policy 一覧が production code の定数またはクラスとして存在し、test-review / impl-review / impl-gate / test-result-review / final-regression の許可 verdict がテストで検証される。
- non-normal artifact + done 相当の fixture に override evidence がない場合、completion validator が inconsistent を返す。
- non-normal artifact + done 相当の fixture に valid override evidence がある場合、completion validator が override を返し、各 blocking finding の disposition と successorOwner を保持する。
- `completion-overrides.json` が存在しない、step id が一致しない、または required field が欠ける場合、completion validator が override を許可しない。
- integration phase の `flow run gate` は `specs/<spec>/impl-gate-result.json` を保存し、impl-gate validator は command envelope ではなくこの artifact path を読む。
- 既存 artifact 読み手が参照する verdict / path / failureKind は削除されず、共通 contract summary から同じ意味で取得できる。
- progressSignature は同じ input/artifact で安定し、artifact body または input fingerprint の変更で変化する。
- `node tests/run.js --scope unit` と spec-local tests が PASS する。

## Implementation Targets
- src/flow/lib/flow-judgment-contract.js
- src/flow/lib/set-step.js
- src/flow/registry.js
- src/flow/lib/test-artifacts.js
- src/flow/lib/run-test-result-review.js
- src/flow/lib/run-final-regression.js
- src/flow/lib/run-gate.js
- src/flow/lib/run-review.js
- src/flow/schemas/next-action/*.schema.json
- src/flow/schemas/test-result-review.schema.json
- specs/271-flow-judgment-contract/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Define judgment contract
  - Add the shared value model for normalized judgment artifacts, completion policy, override evidence, finding disposition, and progress signatures.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Enforce completion policy
  - Route target step completion through the shared policy so normal, override, and inconsistent outcomes are decided by the same validator.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Expose contract evidence
  - Add contract summary and progress evidence to target artifacts while preserving existing verdict / path / failureKind meanings for current readers.
  - see `tasks/T-3.md` for full spec

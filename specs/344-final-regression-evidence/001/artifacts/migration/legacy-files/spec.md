# Feature Specification: 344-final-regression-evidence

**Feature Branch**: `feature/344-final-regression-evidence`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #468

## Goal
final-regression の completion evidence を、各 stdout/stderr 1 MiB 以内で完全に取得された実行済みテスト、実行対象への一致検証、または operator が明示した例外証跡でのみ成立させる。

## Background
現行の final-regression は testCount=0 と exitCode=0 を completion として扱え、autoApprove が failed artifact を record-and-proceed により completed/report へ進められる。保存 artifact は execution 時の HEAD、tree、command、result を受理時に一致検証できないため、完了に見える記録が残り得る。

## Scope
- src/flow/lib/run-final-regression.js の completion 判定、record-and-proceed、artifact validation。
- final-regression artifact schema と spec-local focused tests。

## Out of Scope
- #403 で導入された failure classification と recovery classification の削除または弱体化。

## Constraints
- 外部依存を追加しない。
- 既存の `senti flow run final-regression` command 名、artifact 保存先、pass と policy skip の report 遷移、failure classification、issue-log 記録を維持する。
- autoApprove は failed または incomplete regression の record-and-proceed を選択してはならない。
- stdout と stderr は各 1 MiB まで capture し、いずれかが上限を超えた場合は truncated=true として completion evidence を生成しない。

## Design Principles
- completion evidence は実行時に観測した値を保存し、受理時に同じ値を再検証できる場合だけ信頼する。
- 例外 proceed は自動復旧ではなく、operator が根拠と残存リスクを記録する明示的な安全境界とする。

## Overview
### Modules
- `src/flow/lib/run-final-regression.js` は project regression の実行、failure classification、artifact 作成、record-and-proceed の唯一の command boundary。
- Final-regression captures bounded execution evidence and records an execution binding.
- Explicit failed-regression proceed is accepted only through operator-bound evidence validation.
- Final-regression retains its command, durable artifact path, classification, recovery, and issue-log contracts.

### Data Flow
- regression process result → raw output → parsed test/result evidence → final-regression artifact → report/stop の順に評価し、artifact 受理時に execution binding を再検証する。
- process streams -> bounded capture -> execution binding -> live artifact validation
- failed artifact -> operator evidence -> exact execution binding validation -> report
- pass/policy skip/classified failure -> existing report or recovery path

### Decisions
- [VERIFY] checked draft policy / `src/flow/lib/run-final-regression.js` / result=match: FinalRegressionArtifact は autoApprove selected record-and-proceed を completed/report に進めるため、選択経路を除去する必要がある。
- [VERIFY] checked draft policy / `src/flow/lib/run-final-regression.js` / result=match: existing record-and-proceed categories と #403 failure classification は保持し、explicit override validation を強化する。
- Migration parity: command 名、artifact path、issue-log、pass/policy skip/recovery nextAction は同じ module が保持する。auto-selected proceed だけを explicit operator override 必須へ置換する。
- R1/R2: completion evidence uses a 1 MiB per-stream bound plus HEAD/tree/raw-hash binding.
- Execution binding uses the artifact validator as its owner; the runner reuses that contract's TAP plan parser to prevent producer and acceptance drift.
- R3: autoApprove never selects failed-regression proceed; operator evidence is an explicit acceptance boundary.
- R4: only automatic failed-regression proceed changes; established non-proceed outcomes remain stable.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- record-and-proceed を全 category で削除する — Issue #468 は evidence-backed explicit exception flow を要求するため採用しない。
- autoApprove に operator evidence の既定値を補完させる — 失敗または不完全な regression の proceed を自動選択しない不変条件に反するため採用しない。
- execution binding を runner 固有の分岐で検証する、または live binding 検証を省略する — R2 の再計算可能な completion evidence には producer と acceptance の共通検証契約が必要なため採用しない。ユーザーが許容した複雑性の範囲で、既存 artifact validator を唯一の検証責務として使用する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T14:31:14.127Z
- Notes: autoApprove: gate-passed spec accepted

## Requirements
- R1 [must]: pass artifact は process.started=true、exitCode=0、testCount>=1、stdout と stderr が各 1 MiB 以下かつ truncated=false、解析済み result=pass の全条件を満たす場合だけ completed=true と nextAction=report を設定する。
- R2 [must]: artifact は各 1 MiB に制限した raw output、execution 前の HEAD SHA と tree SHA、実行 command、raw output SHA-256、parsed result、testCount、truncated を保存し、artifact を受理または proceed するときに保存値と再計算値が全て一致しない限り completion evidence として拒否する。
- R3 [must]: failed または incomplete regression で autoApprove は record-and-proceed を選択せず、operator が failure classification、raw output path/SHA-256、HEAD SHA、tree SHA、override 根拠、残存リスクを入力して binding が一致する場合だけ explicit proceed artifact を作成する。
- R4 [must]: 既存の pass、policy skip、failure classification、recovery nextAction、issue-log、command 名、artifact path を保持し、auto-selected proceed のみを explicit override 必須へ変更する。

## Acceptance Criteria
- AC-1: spec-local test `// spec: R1` は testCount=0/exitCode=0 と truncated output を completed=false かつ report 非遷移として検証する。
- AC-2: spec-local test `// spec: R2` は stale HEAD SHA、stale tree SHA、command/output/result mismatch の artifact を completion evidence として拒否する。
- AC-3: spec-local test `// spec: R3` は autoApprove の failed proceed を拒否し、全 operator evidence と一致 binding を持つ explicit proceed だけを許可する。
- AC-4: shared or spec-local regression test `// spec: R4` は `senti flow run final-regression` を同じ command 名で起動し、pass、policy skip、分類済み failure の artifact/nextAction/issue-log contract が保持されることを検証する。

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Harden completion evidence
  - pass artifact の test execution と output completeness 条件、execution binding 保存・再検証を実装する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Require explicit proceed evidence
  - record-and-proceed から auto selection を除去し、operator evidence と exact binding を検証する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Verify retained regression behavior
  - strict evidence change後も既存 command と non-proceed outcomes を維持する。
  - see `tasks/T-3.md` for full spec

# Feature Specification: 349-guard-issue-log-target

**Feature Branch**: `feature/349-guard-issue-log-target`
**Created**: 2026-07-25
**Status**: Draft
**Input**: User request

## Goal
複数の active flow がある環境で、senti flow set issue-log は --expect-run-id、--expect-issue、--expect-spec の全指定に一致する flow へだけ entry を記録し、いずれかが不一致なら entry を記録しない。

## Background
set issue-log は target guard option を受理するが、既定の FlowCommand context 解決は ambient flow を使う。そのため #466 のように別 worktree flow を target guard で指定しても、実行 cwd に authority flow がなければ NO_FLOW となる。明示 expectation がある場合は対象 flow を先に解決し、既存の mismatch 判定と append 処理に渡す必要がある。

## Scope
- set issue-log の target guard を authority flow の選択に使用する。
- 一致 target への entry 追加、不一致時の ACTIVE_FLOW_MISMATCH、および既存の guard-free 実行を検証する。
- set issue-log の usage/help に supported target guard を表示する。

## Out of Scope
- issue-log entry schema、文字数 validation、taskId 解決、IssueLogStore の永続化形式の変更。
- 他の flow set command、#466 の acceptance-review、artifact validation の変更。
- 外部依存の追加、publish、release。

## Constraints
- Node.js 組み込みモジュールと既存の FlowCommand、FlowTargetExpectation、FlowManager、Envelope のパターンだけを使用する。
- target mismatch は mutation と IssueLogStore.append より前に標準の ACTIVE_FLOW_MISMATCH envelope で返す。
- guard-free の単一 worktree flow は既存の flow binding による authority 解決と entry 内容を維持する。
- production 変更は set issue-log command とその registry help/target-resolution 宣言に必要な範囲に限定する。

## Design Principles
- 明示された target guard は ambient cwd より優先する authority 選択情報である。
- target selection、mismatch 判定、issue-log 永続化を既存の責務境界に残し、command-local のファイル探索を追加しない。
- 同じ target guard 契約を command の受理、help 表示、behavior-level test に揃える。

## Overview
### Modules
- `src/flow/lib/set-issue-log.js` は issue-log entry の入力検証、task ID 解決、IssueLogStore への append を担当する。
- `src/flow/lib/base-command.js` と `src/flow/lib/flow-context.js` は FlowCommand が使う target-aware context と authority root を組み立てる。
- `src/flow/registry.js` は set issue-log が受理する guard option と usage/help を定義する。
- SetIssueLogCommand opts into shared explicit target resolution when target guards are supplied.

### Data Flow
- CLI は3つの optional expectation を受け、明示 target があればその runId・Issue・spec に一致する flow を authority として解決する。
- 解決後、既存の target mismatch 判定が全 expectation を検査する。不一致なら append を行わず envelope を返し、一致なら既存 SetIssueLogCommand が選択 flow の spec へ append する。
- Guarded issue-log calls resolve the matching flow authority before existing mismatch validation and append.

### Decisions
- [VERIFY] `set-issue-log.js` の entry validation と append は ctx.flowState に依存し、guard 引数の解析は registry に既に存在する。result=match: 修正点は explicit target を FlowCommand context 解決へ有効にすることだけである。
- [VERIFY] `flow-context.js` は explicitTargetResolution が true のとき FlowManager の explicit target resolver から authority root と flow state を返す。result=match: SetIssueLogCommand がこの shared boundary を opt in すれば独自検索なしで並行 flow を選べる。
- Migration parity inventory: retained guard-free worktree issue-log entry は既存 SetIssueLogCommand と WorktreeFlowBindingStore が所有し、guarded entry の新 owner は explicit FlowCommand context resolution、mismatch rejection は既存 FlowTargetExpectation/Envelope、usage 表示は registry である。entry schema と IssueLogStore side effect は移動・削除しない。
- Use FlowCommand explicitTargetResolution rather than command-local flow lookup; preserve IssueLogStore and entry validation.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- SetIssueLogCommand 内で runId、Issue、spec を直接探索して IssueLogStore の root を選ぶ。 — Rejected because flow-context と FlowManager が authority selection を一元化しており、command-local の検索は target guard 契約を重複させる。
- guarded issue-log command を実行 cwd の worktree に限定する。 — Rejected because explicit target は並行 flow の安全な記録に必要であり、#466 のような current-context 外の flow を記録できない。
- 全ての flow set command を同時に explicit target resolution へ変更する。 — Rejected because本 spec の concern は issue-log の targetability であり、他 command の behavior 変更は scope 外である。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T14:34:06.700Z
- Notes: autoApprove: guarded issue-log target specification approved

## Requirements
- R1 [must]: `flow set issue-log` は、--expect-run-id だけを指定した場合は runId が一致する flow、--expect-run-id と --expect-issue を指定した場合は両方が一致する flow、--expect-run-id・--expect-issue・--expect-spec を指定した場合は3値すべてが一致する flow の authority root と flow state で実行されなければならない。
- R2 [must]: 指定した runId、Issue、spec のいずれかが解決 flow の値と異なる場合、command は IssueLogStore.append 前に ACTIVE_FLOW_MISMATCH を返し、対象候補と実行 cwd の両方の issue-log.json を変更してはならない。
- R3 [must]: guard-free の `flow set issue-log` は既存の bound worktree flow へ同じ step、reason、optional field、taskId を持つ entry を append し、entry validation と JSON envelope の形式を維持しなければならない。
- R4 [must]: `flow set issue-log --help` は --expect-issue、--expect-spec、--expect-run-id の3つを supported option として表示し、command test は3条件一致の append と各条件を1つずつ不一致にした無書き込みを検証しなければならない。

## Acceptance Criteria
- AC1: two active flow fixtures で、target flow の runId、Issue、spec をすべて指定した issue-log command は target の issue-log.json にだけ1件追加する。
- AC2: AC1 の runId、Issue、spec をそれぞれ別々に不一致値へ置き換えた3ケースは ACTIVE_FLOW_MISMATCH を返し、両 flow の issue-log entry count を変更しない。
- AC3: target guard を省略した既存 set-issue-log unit test は、bound flow に同じ entry schema を append する。
- AC4: help output は3つの --expect option を含む。
- AC5: specs/349-guard-issue-log-target/tests/ の spec-local test は `// spec: R1 R2 R3 R4` header を持ち、2 flow fixture で一致 target の1件追加と3つの不一致無書き込みを assert する。

## Implementation Targets
- src/flow/lib/set-issue-log.js
- src/flow/registry.js
- tests/unit/flow/set-issue-log.test.js
- specs/349-guard-issue-log-target/tests/issue-log-target-guards.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Resolve issue-log target
  - Enable set issue-log to select the explicit target flow through the shared FlowCommand context boundary while preserving its existing entry behavior.
  - see `tasks/T-1.md` for full spec

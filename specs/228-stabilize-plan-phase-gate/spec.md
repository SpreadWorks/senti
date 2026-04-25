# Feature Specification: 228-stabilize-plan-phase-gate

**Feature Branch**: `feature/228-stabilize-plan-phase-gate`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #254

## Goal
plan phase gate (gate-draft / gate-spec) の AI 評価が run 毎に不安定で不要なリトライを誘発するバグを修正する。retry 上限・no-progress ガード・repeated-fail 検出を plan phase にも適用し、加えて PASS→FAIL flip 検出で判断揺らぎを直接排除する。

## Background
gate-impl / integration には c612 (#194) / 83b6 (#180) / spec 210 / spec 212 で retry 上限・no-progress ガード・repeated-fail 検出が導入済み。しかし plan phase gate (draft, spec) にはこれらの保護が一切なく、`RETRY_TRACKED_PHASES = ["task-impl", "integration"]` で明示的に除外されている。spec 221 では gate-draft 8 retry + gate-spec 4 retry = 計 12 回の AI 呼び出し（467 秒, 254k input tokens）を要した。

## Scope
- RETRY_TRACKED_PHASES に draft, spec を追加
- executeDraft / executeSpec に retry 上限・no-progress・repeated-fail ガードを追加
- appendIssueLogFromGateResult に passedGuardrails フィールドを追加
- PASS→FAIL flip 検出ロジック: git state hash 同一時、前回 PASS が今回 FAIL に反転した guardrail を PASS に override

## Out of Scope
- gate-impl / integration の挙動変更
- AI プロンプト変更（temperature 制御等）
- CLI コマンド引数変更
- gate 評価を複数 AI 呼び出しに分割する構造変更

## Constraints
- checkMissingHeadTestEvidence は plan phase には適用しない（テスト証拠は impl 固有、executeDiffBasedGate 内でのみ呼ばれる）
- 既存の issue-log エントリに passedGuardrails フィールドが存在しない場合は flip 検出をスキップする

## Design Principles
- 既存の guard 関数群を可能な限り再利用し、plan phase 固有の分岐は最小限に留める
- runGateFlow にコンテキスト（flowState, issueLog, gitState）を渡す形で guard を統合し、executeDraft / executeSpec 個別のインライン追加を避ける

## Overview
### Modules
- run-gate.js: RETRY_TRACKED_PHASES 拡張、runGateFlow への guard 統合、passedGuardrails 記録、flip 検出ロジック追加
- registry.js: gate post-hook は既に全 phase で動作するため変更不要

### Data Flow
- gate FAIL 時: issue-log エントリに failedEvaluations + passedGuardrails を記録
- gate re-run 時: issue-log から前回の passedGuardrails を読み出し、git state hash が同一なら flip した guardrail を PASS に override

### Decisions
- guard の統合先は runGateFlow（shared orchestrator）。executeDraft / executeSpec 個別にインラインで追加するとコード重複が生じるため。
- flip override は AI 評価結果を受け取った後、PASS/FAIL 判定の前に適用する。override された guardrail は result を 'pass' に書き換え、reason に flip override の旨を追記する。

## Clarifications (Q&A)
- Q: RETRY_TRACKED_PHASES の拡張で checkMissingHeadTestEvidence が plan phase に適用されないか？
  - A: checkMissingHeadTestEvidence は executeDiffBasedGate 内でのみ呼ばれる。executeDraft / executeSpec は executeDiffBasedGate を経由しないため影響なし。
- Q: flip override は gate-impl / integration にも適用すべきか？
  - A: 本 spec では plan phase のみを対象とする。gate-impl には既に十分な保護機構が機能している。

## Alternatives Considered
- 全 guardrail 評価を単一 AI 呼び出しに統合: 既に実現済み
- AI プロンプト固定化（temperature=0 等）: agent.call 経由では temperature を制御不可

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-25
- Notes: approach #3 (retry limit + escalation) + #4 (PASS→FAIL flip detection) combination

## Requirements
- **REQ-1** (must): When a plan phase gate (draft / spec) が FAIL したとき、retry カウンタを metrics に記録する。上限（config.flow.retry.max、デフォルト 3）に達したら ESCALATE_RETRY_EXHAUSTED envelope を返す。
- **REQ-2** (must): When plan phase gate を再実行するとき、git state hash（HEAD sha + worktree hash）が前回 FAIL 時と同一なら NO_PROGRESS_SINCE_LAST_FAIL envelope を返し、AI 呼び出しを行わない。
- **REQ-3** (must): When plan phase gate で同一の (guardrail_id, reason) ペアが前回 FAIL と今回 FAIL で一致したとき、ESCALATE_REPEATED_FAIL エラーを throw する。
- **REQ-4** (must): When gate FAIL 結果を issue-log に記録するとき、failedEvaluations に加えて passedGuardrails（PASS した guardrail_id の配列）も記録する。フィールド不在の既存エントリは flip 検出をスキップする。
- **REQ-5** (must): When 同一内容（git state hash 同一）で plan phase gate を再実行し、前回の passedGuardrails に含まれる guardrail_id が今回 FAIL になったとき、その guardrail の result を 'pass' に override し、reason に flip override の旨を追記する。override 後に残りの FAIL がなければ gate 全体を PASS にする。
- **REQ-6** (must): checkMissingHeadTestEvidence は plan phase (draft / spec) では呼び出さない。
- **REQ-7** (must): gate-impl / integration の既存挙動は変更しない。

## Acceptance Criteria
- [ ] plan phase gate (draft / spec) で FAIL 時に retry カウンタが記録される
- [ ] plan phase gate で retry 上限到達時に ESCALATE_RETRY_EXHAUSTED が返る
- [ ] plan phase gate で git state 未変更の再実行が NO_PROGRESS_SINCE_LAST_FAIL で拒否される
- [ ] plan phase gate で同一 (guardrail_id, reason) の繰り返し FAIL が ESCALATE_REPEATED_FAIL で検出される
- [ ] gate FAIL の issue-log エントリに passedGuardrails フィールドが含まれる
- [ ] git state hash 同一 + 前回 PASS guardrail が今回 FAIL → PASS に override される
- [ ] flip override 後に残り FAIL がなければ gate 全体が PASS になる
- [ ] gate-impl / integration の既存テストが全て PASS する

## Implementation Targets
- src/flow/lib/run-gate.js

## Open Questions
- (なし)

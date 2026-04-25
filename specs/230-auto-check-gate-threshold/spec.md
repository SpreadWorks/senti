# Feature Specification: 230-auto-check-gate-threshold

**Feature Branch**: `feature/230-auto-check-gate-threshold`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #265

## Goal
auto-check の eligible 判定を改善し、狭いスコープの bugfix/enhancement が false negative として reject されないようにする

## Background
auto-check は6カテゴリの重み付きスコア（最大24点）と hard-gate（specBuildability/ambiguity/verifiability のいずれか0で即fail）の2段階で eligible を判定する。過去26件のデータ分析で、THRESHOLD 18/24（75%）が高すぎて17点の狭いスコープ修正が3件 reject、hard-gate zero-tolerance で ambiguity=0 の bugfix が1件弾かれていることが判明した。17点と19点の間にギャップがあり（18点のケースが0件）、閾値を16に下げれば false negative を解消しつつ true negative（12点以下）は維持できる。Impact on Existing Features: auto-check の eligible 判定が緩和される。過去データで17点だった3件が新たに eligible になり、14点の bugfix は hard-gate 段階化で救済される可能性がある

## Scope
- THRESHOLD 定数の変更（18 → 16）
- hardGateFailed() の段階化（zero-tolerance → sum ≤ 1）
- composeAutoCheck() の reason 生成更新
- 既存ユニットテストの更新

## Out of Scope
- static gates (auto-check-static.js)
- AI プロンプトの変更
- WEIGHTS の変更

## Constraints
- 変更は run-auto-check.js 内に閉じること。他モジュールへの波及なし
- composeAutoCheck() の export signature は変更しない（set-auto.js が依存）

## Design Principles
-

## Overview
### Modules
- src/flow/lib/run-auto-check.js — THRESHOLD, hardGateFailed(), composeAutoCheck()

### Data Flow
- scoreWithAi → composeAutoCheck（hard-gate判定 → スコア判定 → eligible決定）

### Decisions
- hard-gate 段階化（sum ≤ 1 → fail）を採用し、hard-gate 廃止は見送り。段階化なら致命的な曖昧さ（2項以上が0）を確実にブロックしつつ、1項目だけ0のケースを救済できる

## Clarifications (Q&A)
- Q: 既存テストの修正は承認されているか？
  - A: 承認済み。draft Q4 でテスト更新戦略をユーザーが承認した（2026-04-25）

## Alternatives Considered
- hard-gate 廃止 + THRESHOLD 16 のみ — ambiguity=0 かつ他が満点のケース（合計18点）が通過するリスクがあるため見送り。重み(weight=3)だけでは曖昧なリクエストのブロックが不十分

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: When AIスコアリング後に合格判定を行うとき、THRESHOLD は 16/24（67%）とする
- R2 [must]: When hard-gate 判定を行うとき、3項目の合計が1以下なら fail とする。1項目が0でも他2項の合計が2以上なら通過する
- R3 [must]: When hard-gate fail が発生したとき、reason に段階化ロジックの合計値と閾値を出力する
- R4 [should]: When 上記変更を行ったとき、既存テストを更新し境界値（hard-gate合計1でfail・合計2でpass、スコア15でfail・16でpass）を検証する

## Acceptance Criteria
- THRESHOLD が 16 に変更されている
- hardGateFailed() が3項合計 ≤ 1 で true を返す
- hardGateFailed() が3項合計 ≥ 2 で false を返す
- composeAutoCheck() の reason が段階化後のロジックを反映している
- npm test が pass する

## Implementation Targets
-

## Authorized Existing Test Modifications
- **tests/unit/flow/run-auto-check.test.js** — Threshold and hard-gate logic changed — existing assertions must be updated to match new THRESHOLD=16 and staged hard-gate (sum≤1) behavior

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Relax hard-gate and threshold in run-auto-check.js
  - THRESHOLD を 16 に変更し、hardGateFailed() を段階化（3項合計 ≤ 1 で fail）に変更し、composeAutoCheck() の reason 生成を新ロジックに合わせて更新する
  - see `tasks/T-1.md` for full spec

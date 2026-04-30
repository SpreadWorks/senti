# Feature Specification: 248-gate-impl-per-req-diff

**Feature Branch**: `feature/248-gate-impl-per-req-diff`
**Created**: 2026-04-30
**Status**: Draft
**Input**: GitHub Issue #303

## Goal
gate-impl の requirement チェックを per-requirement diff 分割方式に変更し、AI 呼び出しあたりのトークン消費を削減する

## Background
gate-impl は直近2日で cacheCreate 1,997K tokens を消費（全フェーズの 42.7%）。主因は毎回 spec.md 全文 + git diff 全文（75-118KB）を1プロンプトに結合して AI に投入する構造にある。リトライ時も同じ diff を再送信するため、トークン消費が累積する。review.js で同様の問題に対して per-file diff 分割が実装済み（spec 242）であり、同パターンを gate-impl にも適用する

## Scope
- [must] gate-impl の requirement チェックが requirement 単位で実行され、各呼び出しに渡される diff が対象 requirement に関連するファイルのみに限定される
- [must] file-map.json が存在しない場合、現行と同じ動作（全 diff + 全 requirement を一括チェック）にフォールバックする
- [must] file-map に登録されていない requirement は全 diff を受け取る（per-requirement フォールバック）
- [should] リトライ時に前回 PASS した requirement を再評価しない

## Out of Scope
- guardrail チェックの分割（横断的チェックであり分割不適）
- review.js の collectPerFileDiffs / groupByDiffContent の共通化（diff 収集セマンティクスが異なる）
- gate-draft / gate-spec フェーズの変更

## Constraints
- gate-impl の外部インターフェース（gatePass/gateFail の返却値構造）を変更しない
- file-map.json が不在でも gate-impl が正常に動作する

## Design Principles
- diff 収集は gate-impl 固有のセマンティクス（committed + uncommitted + untracked）を維持する
- requirement 単位の判定コンテキスト = マッピング済みファイル diff + 未マッピングファイル diff
- 関連 diff が空の requirement は skip 判定とする

## Overview
### Modules
- run-gate.js: handleImplCheck を per-requirement ループに変更。buildImplCheckPrompt を単一 requirement 用に変更

### Data Flow
- file-map.json → requirement ごとのファイルリスト取得
- per-file diff 収集 → requirement ごとの diff 結合
- requirement 単位で AI 判定 → 結果を集約して gatePass/gateFail

### Decisions
- review.js の関数を共通化せず、gate-impl で独自実装する。diff 収集セマンティクスが異なるため抽象化コストに見合わない
- requirement 単位で個別に AI を呼び出す。バッチ化しない。リトライ時に FAIL 分だけ再評価でき、トータルコスト最小
- 未マッピングファイルの diff は全 requirement の判定に含める。cross-cutting な変更の見落としを防ぐ
- requirement テキストのソースに spec.json の requirements 配列を使用する。spec.md のマークダウンパースは脆弱

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- review.js の collectPerFileDiffs / groupByDiffContent を共通ライブラリに移動 — diff 収集セマンティクスが異なる（review は committed+staged、gate は committed+uncommitted+untracked）。抽象化コストに見合わない
- N 件バッチで AI を呼び出す — requirement 間に依存がないため個別呼び出しで十分。バッチ化は実装を複雑にするだけ
- file-map.json を必須にする — 手動 gate 実行時や記録漏れ時に動作しなくなるため却下
- spec.md から requirement テキストをパースする — マークダウンのセクション境界検出が正規表現依存で脆弱。spec.json は構造化済み

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- REQ-1 [must]: handleImplCheck が requirement 単位で AI を呼び出し、各呼び出しに渡される diff が file-map.json のマッピングに基づいて対象 requirement に関連するファイルの diff + 未マッピングファイルの diff に限定される
- REQ-2 [must]: file-map.json が存在しないか空の場合、handleImplCheck は現行と同じ動作（全 diff + 全 requirement ID を1回の AI 呼び出しでチェック）にフォールバックする
- REQ-3 [must]: file-map.json に登録されていない requirement は、全 diff を受け取って判定される（per-requirement フォールバック）
- REQ-4 [must]: マッピング済みだが関連 diff が空の requirement は skip 判定となり、AI 呼び出しを行わない
- REQ-5 [must]: per-requirement 判定の結果が既存の gatePass/gateFail インターフェースと同じ形式で集約される。呼び出し元の動作に変更がない
- REQ-6 [should]: リトライ時に前回 PASS した requirement を再評価しない（previouslyPassedIds の仕組みを per-requirement 方式でも維持する）

## Acceptance Criteria
- file-map.json あり・全 requirement マッピング済みの場合、各 AI 呼び出しに渡される diff が対象 requirement のファイル + 未マッピングファイルのみ
- file-map.json なしの場合、現行と同じ1回の AI 呼び出しで全 requirement をチェック
- 部分的な file-map（一部 requirement のみマッピング）の場合、マッピング済みは関連 diff、未マッピングは全 diff
- 関連 diff が空の requirement が skip として結果に含まれる
- gatePass/gateFail の返却値構造が変更されていない
- 既存テストが更新され、新規テストが追加されている

## Implementation Targets
-

## Open Questions
- [ ] Issue #303 の推定値（requirement あたり 1-4KB）は分析データに基づく設計前提。実装後に実測で検証する

## Tasks
### Round 0
- **T-1** [pending]: Add per-file diff collection for gate-impl
  - gate-impl 固有の per-file diff 収集関数を追加する。committed (baseBranch...HEAD)、uncommitted (HEAD)、untracked の3種を file 単位で収集する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Build per-requirement diff from file-map
  - file-map.json と per-file diff を組み合わせて、requirement ごとの diff を構築する。未マッピングファイルの diff は全 requirement に付加する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Refactor handleImplCheck to per-requirement loop
  - handleImplCheck を per-requirement ループに変更し、requirement 単位で AI を呼び出す。file-map なし時のフォールバックを含む
  - see `tasks/T-3.md` for full spec

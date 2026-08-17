# Feature Specification: 133-spec-review-phase

**Feature Branch**: `feature/133-spec-review-phase`
**Created**: 2026-04-03
**Status**: Draft
**Input**: GitHub Issue #76

## Goal

`flow run review --phase spec` を追加し、gate では検出できない spec の考慮漏れをコードベースコンテキストを使った AI レビューで検出・自動修正する。既存の test review ループを共通化し、spec review と共有する。

## Scope

- review.js の test review ループ（レビュー → 修正 → 再レビュー）を共通関数に抽出
- review.js に `--phase spec` 分岐を追加
- get-context.js から `loadAnalysisEntries` / `contextSearch` を export
- run-review.js に phase=spec のパース処理を追加
- registry.js の review エントリの help テキストを更新
- flow-plan スキル（SKILL.md）に gate → spec review → gate のステップを追加

## Out of Scope

- code review（デフォルトの review）のループ化
- gate コマンド自体の変更
- impl review との共通化（将来検討）

## Clarifications (Q&A)

- Q: spec review に渡すコンテキストの取得方法は？
  - A: review.js 内から get-context.js の `loadAnalysisEntries` + `contextSearch` を関数呼び出しする

- Q: 出力形式は？
  - A: code review と同じ proposal 形式（review.md に指摘・修正案・APPROVED/REJECTED を出力）

- Q: test review との共通化の範囲は？
  - A: 「指摘検出 → 修正適用 → 再検出」のループ制御を共通関数に抽出。プロンプト構築・パース・修正適用は各 phase 固有

- Q: spec review の反復上限は？
  - A: 3回。test review の MAX_TEST_REVIEW_RETRIES と同じ

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-03
- Notes: Gate PASS 後に承認

## Requirements

Priority order:

1. **R1: レビューループの共通化** — When: review.js の test review と spec review がレビュー → 修正 → 再レビューのループを実行する場合、共通関数（例: `runReviewLoop`）を使う。共通関数はコールバック（指摘検出・修正適用）を受け取り、上限回数まで反復し、指摘なし or 上限到達で終了する。既存の test review の動作は変わらない。
2. **R2: --phase spec の追加** — When: `flow run review --phase spec` が実行された場合、review.js は spec.md のテキストと、get-context.js の `loadAnalysisEntries` + `contextSearch` で取得したコードベースコンテキストを AI に渡し、考慮漏れを proposal 形式で検出する。
3. **R3: spec の自動修正と反復** — When: spec review で APPROVED な指摘が存在する場合、review.js は AI に修正版 spec を生成させ spec.md に書き戻す。R1 の共通ループで再レビューし、NO_PROPOSALS まで反復する（上限 3回）。
4. **R4: get-context.js の export 追加** — When: review.js が spec review のコンテキストを取得する場合、get-context.js から export された `loadAnalysisEntries` と `contextSearch` を関数呼び出しする。前提: `searchEntries` は既に export 済みのため変更不要。`loadAnalysisEntries` と `contextSearch` のみ export を追加する。
5. **R5: flow-plan スキルの更新** — When: flow-plan スキルで gate spec が PASS した場合、`flow run review --phase spec` を実行し、完了後に gate spec を再実行して修正が guardrail 違反を持ち込んでいないことを再検証する。

## Acceptance Criteria

- AC1: `flow run review --phase spec` が実行でき、spec.md の考慮漏れを proposal 形式で review.md に出力する
- AC2: APPROVED な指摘があれば spec.md が自動修正され、再レビューが実行される
- AC3: 指摘なし（NO_PROPOSALS）で正常終了する
- AC4: 上限（3回）到達時に上限到達ステータスで終了する
- AC5: test review が既存通り動作する（リファクタで壊れていない）
- AC6: get-context.js の `loadAnalysisEntries` / `contextSearch` が export されている
- AC7: registry.js の review help テキストに `--phase spec` が記載されている
- AC8: When: 全変更完了後に `npm test` を実行した場合、既存テスト全通過（1406 tests, 0 failures）

## 既存機能への影響

- **review.js**: test review のループを共通関数に抽出するリファクタ。test review の動作は変わらない（AC5 で検証）
- **get-context.js**: `loadAnalysisEntries` / `contextSearch` を export に追加。既存の呼び出し元（GetContextCommand.execute）は引き続きモジュール内で使うため影響なし。新規 export の追加のみ
- **run-review.js**: phase=spec のパース処理を追加。既存の code review / test review のパース処理に影響なし
- **registry.js**: review エントリの help テキストに `--phase spec` を追記。既存の `--phase test` 記載はそのまま維持

## CLI 後方互換性

- 既存コマンドの削除・意味の変更なし
- `--phase spec` オプションの追加のみ
- alpha 版ポリシーにより内部 API の後方互換は不要

## Open Questions

- [x] `searchEntries` は export 済みか → 済み。`loadAnalysisEntries` / `contextSearch` の export が必要

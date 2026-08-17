---
title: metrics 日付軸を finalizedAt ベースに変更
issue: 156
---

# Draft: metrics-finalized-at

**開発種別:** 機能改善 (ENHANCE)

**目的:** metrics token の日付軸を `flow.json` mtime ベースから、spec ごとに記録された finalize 完了時刻ベースに変更し、時系列分析をファイル更新ノイズから切り離す。

## 調査済み事項（事前探索）

- Issue #156 の本文に仕様決定事項を確認済み
- metrics token コマンドの現行日付軸生成ロジック（mtime 参照）を確認済み
- flow finalize パイプライン（squash route / PR route）の構造を確認済み
- 既存 metrics テスト fixture に finalizedAt が未設定であることを確認済み

## 要件

### P1（必須）

- **R1 [Complete Context]** When `flow finalize` が正常完了したとき, the system shall 当該 spec の flow.json に `state.finalizedAt`（ISO 8601 UTC full timestamp）を書き込む
- **R2 [Complete Context]** When `metrics token` が集計対象の flow.json を読み込むとき, the system shall 日付軸として `state.finalizedAt` を使用する（`flow.json` mtime は使用しない）
- **R3 [Complete Context]** If flow.json に `state.finalizedAt` が存在しない spec があれば, the system shall その spec を集計から除外し警告ログを出力する

### P2（重要）

- **R4 [Complete Context]** When metrics キャッシュが有効性判定されるとき, the system shall キャッシュ内 `maxFinalizedAt` と現在の finalize 済み spec の最大 `finalizedAt` を比較して判定する
- **R5 [Complete Context]** If キャッシュに `maxFinalizedAt` フィールドが存在しなければ, the system shall そのキャッシュを無効とみなし再計算する
- **R6 [Complete Context]** When 本 spec の finalize が実行されたとき, the system shall 既存全 spec の flow.json へ `state.finalizedAt` を backfill するスクリプトを一度だけ実行する

### P3（付随）

- **R7 [Complete Context]** When backfill が実行されるとき, the system shall 対象 spec の本流への merge 日時を優先使用し、取得できない場合は spec の初回追加日時をフォールバックとする
- **R8 [Complete Context]** When 既存テスト fixture が `state.finalizedAt` を欠いて失敗するとき, the system shall 本 spec の作業範囲内で fixture を修正する

## スコープ外

- フェーズ実行時間メトリクスの記録（別 Issue）
- スキーマバージョニング機構の導入（ユーザー決定により不採用）
- `spec.md` の `**Created**:` 行を日時ソースとして使う案（ユーザー決定により不採用）

## 既存機能への影響

- **metrics token コマンド**: 日付軸ソース変更。未 backfill の既存 spec は一時的に集計対象外になるが、本 spec の finalize で実行される backfill により即時解消される
- **metrics cache**: 旧形式キャッシュは `maxFinalizedAt` フィールド欠如により次回実行時に自動無効化される（互換コードなし）
- **flow finalize**: 成功時に `state.finalizedAt` 書き込み処理が追加される
- **既存テスト**: metrics token の e2e / unit テスト fixture に `state.finalizedAt` 追加が必要

## 代替案（ユーザーにより確定済み）

各代替案はユーザーの最終判断として以下のとおり確定している（brainstorming ではなく decision）。

1. **書き込みタイミング（Q2）**
   - 推奨: finalize 成功時点で一律書き込み（案B）
   - 根拠: 日付軸は日単位粒度で、PR route の sync 完了遅延が実害を生じない。route 分岐より実装シンプル
   - 確定: 案B 採用

2. **既存テスト fixture 更新（Q3）**
   - 推奨: 本 spec スコープ内で fixture に `state.finalizedAt` を追加
   - 根拠: guardrail「変更ファイル内の一貫性問題は修正してよい」。別 spec 分割のコストが不要
   - 確定: スコープ内修正

3. **backfill / cache 自動化（Q4）**
   - 推奨: cache は自動無効化、backfill は本 spec の finalize 時に自動実行
   - 根拠: 手動運用はユーザー負担を増やし、忘却リスクもある。一度きり自動化で完結する
   - 確定: 自動化採用

## テスト戦略

- **テスト種別**: unit（public CLI 契約の検証）
- **検証対象**: R1, R2, R3, R4, R5 を覆う。R6 (backfill) は本 spec の finalize 実行時に実際に走るため acceptance テスト不要
- **テスト配置判定**: 「将来変更で壊れた場合は常にバグか？」→ YES。公式 `tests/` 配下に配置

## 将来拡張

- `state.finalizedAt` は今後フェーズ別実行時間メトリクス等、他の時系列分析にも共通インデックスとして活用可能
- 使い捨てスクリプトを spec 配下に同梱し finalize で実行するパターンは、他のデータマイグレーション系 spec で再利用可能

## Open Questions

なし

## Q&A

### Q1: Issue #156 の解釈確認
- **推奨 & 根拠**: Issue 本文の決定事項をそのまま採用（Issue は十分詳細）
- **選択肢**: [1] はい / [2] 修正する / [3] その他
- **User 回答**: [1]

### Q2: `state.finalizedAt` の書き込み方針
- **推奨 & 根拠**: 案B（finalize 成功時点で一律）。理由は「代替案」節参照
- **選択肢**: [1] route 別 / [2] finalize 成功時点で一律 / [3] 毎回 git 参照
- **User 回答**: [2]

### Q3: 既存 metrics テスト fixture の更新方針
- **推奨 & 根拠**: 本 spec スコープ内で fixture 修正。理由は「代替案」節参照
- **選択肢**: [1] 本 spec スコープ内で修正 / [2] 別途新規追加
- **User 回答**: [1]

### Q4: backfill / cache の自動化範囲
- **推奨 & 根拠**: 両方自動化。理由は「代替案」節参照
- **選択肢**: [1] 自動化案で進める / [2] 修正する / [3] その他
- **User 回答**: [1]

## User Confirmation

- [x] User approved this draft
- 承認日: 2026-04-17

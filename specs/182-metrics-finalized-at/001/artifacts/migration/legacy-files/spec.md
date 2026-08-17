# Feature Specification: 182-metrics-finalized-at

**Feature Branch**: `feature/182-metrics-finalized-at`
**Created**: 2026-04-17
**Status**: Draft
**Input**: Issue #156 — metrics date axis to finalize timestamp

## Goal

metrics token コマンドの日付軸を flow.json ファイルの mtime 依存から、spec ごとの finalize 完了時刻（`state.finalizedAt`）ベースに切り替え、時系列分析をファイル更新ノイズから切り離して実運用に耐える粒度に引き上げる。

## Scope

- flow.json スキーマに `state.finalizedAt`（ISO 8601 UTC full timestamp）を追加する
- `flow finalize` 成功時に route を問わず `state.finalizedAt` を書き込む
- metrics token の日付軸ソースを mtime から `state.finalizedAt` へ変更する
- 欠損時スキップ＋警告、および metrics キャッシュの `maxFinalizedAt` ベース無効化判定を実装する
- 既存 spec 向け backfill 処理を本 spec の finalize 時に一度だけ実行する
- 既存 metrics テスト fixture を本スコープ内で更新する

## Out of Scope

- フェーズ実行時間メトリクスの記録（別 Issue）
- スキーマバージョニング機構の導入
- `spec.md` の `**Created**:` 行を日時ソースとして利用する選択肢

## Clarifications (Q&A)

- Q: Issue #156 の解釈は妥当か
  - A: 妥当（User: [1] はい）
- Q: `state.finalizedAt` の書き込みタイミング
  - A: route を問わず finalize 成功時点で一律書き込み（User 決定）
- Q: 既存 metrics テスト fixture の更新範囲
  - A: 本 spec スコープ内で fixture に `state.finalizedAt` を追加（User 決定）
- Q: backfill と cache 更新の自動化範囲
  - A: cache は自動無効化、backfill は本 spec の finalize 時に自動実行（User 決定）

## Alternatives Considered

- **案A: route 別の書き込み（squash=即時、PR=sync 時）**
  - 却下理由: route 分岐の実装複雑度に見合う厳密性が得られない。日付軸は日単位粒度のため差異が実質的影響を持たない
- **案C: flow.json に書かず metrics 実行時に git log で毎回解決**
  - 却下理由: metrics 実行ごとに全 spec 数ぶんの git log 呼び出しが発生し、コストが線形に増加する
- **schemaVersion フィールドの導入**
  - 却下理由: `maxFinalizedAt` フィールド有無で cache の自動無効化が可能。バージョン管理機構は本件の範囲で過剰
- **`**Created**:` 行を backfill ソースに利用**
  - 却下理由: 手書きで信頼性が劣る。git 履歴の方が欠損率・改変耐性で優れる

## Impact on Existing Features

- **metrics token コマンド**: 日付軸ソースを mtime から `state.finalizedAt` に切り替える。未 backfill の既存 spec は一時的に集計対象から除外されるが、本 spec の finalize 時の backfill で即時解消される
- **metrics キャッシュ（`.sdd-forge/output/metrics.json`）**: 旧形式キャッシュは `maxFinalizedAt` フィールド欠如により次回実行時に自動無効化される
- **flow finalize**: 成功完了時に `state.finalizedAt` 書き込み処理が追加される。失敗時はこれまで同様、非ゼロ終了コードで中断する
- **既存 metrics テスト**: fixture に `state.finalizedAt` を追加する必要がある（本スコープ内で対応）
- **上記以外の既存機能への影響**: なし

## Bounded Resource Usage

- **backfill 対象件数**: リポジトリ内の既存 spec 数（現時点で 238 件）。spec 総数は自然な上限を持ち、現行の metrics token も同件数の flow.json を走査するため既存の上限設計と同等
- **backfill の git log 呼び出し**: 1 spec あたり最大 2 回（merge 日時 → 初回追加日時フォールバック）で有限
- **backfill の実行回数**: 本 spec の finalize 時の一度限り。以降は実行されない
- **metrics token の flow.json 走査上限**: 既存の `MAX_FLOW_FILES` 上限を維持（本 spec で変更しない）

## Exit Code Contract

- `flow finalize` が `state.finalizedAt` の書き込みに失敗した場合、非ゼロ終了コードで中断し、既存の finalize 失敗ハンドリングに従う
- `metrics token` は欠損 spec のスキップを正常動作として扱い終了コード 0 を維持する（警告ログのみ）
- backfill スクリプトが git log 取得に失敗し、どの spec についても日時を解決できない場合、非ゼロ終了コードで中断する

## Why This Approach

- **データ耐久性**: `state.finalizedAt` を flow.json に保存することで、以降の metrics 実行が git 履歴参照を要さず高速に完結する
- **実装簡素化**: route を問わず finalize 成功時に一律書き込みすることで、route 分岐コードを増やさず仕様を単純に保つ
- **自動移行**: cache の `maxFinalizedAt` 欠如で自動無効化する設計により、後方互換コードや手動運用指示が不要
- **一度きり backfill**: 本 spec の finalize で backfill を自動実行することで、ユーザーの手動運用ステップを省略し忘却リスクを排除

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-17
- Notes: Issue #156 の決定事項に沿って承認

## Requirements

### P1（必須）

- **R1** When `flow finalize` が正常完了したとき, the system shall 当該 spec の flow.json に `state.finalizedAt`（ISO 8601 UTC full timestamp）を書き込む
- **R2** When `metrics token` が集計対象の flow.json を読み込むとき, the system shall 日付軸として `state.finalizedAt` を使用し、flow.json の mtime は使用しない
- **R3** If flow.json に `state.finalizedAt` が存在しない spec があれば, the system shall その spec を集計から除外し警告ログを出力する

### P2（重要）

- **R4** When metrics キャッシュが有効性判定されるとき, the system shall キャッシュ内 `maxFinalizedAt` と現在の finalize 済み spec の最大 `finalizedAt` を比較して判定する
- **R5** If キャッシュに `maxFinalizedAt` フィールドが存在しなければ, the system shall そのキャッシュを無効とみなし再計算する
- **R6** When 本 spec の finalize が実行されたとき, the system shall 既存全 spec の flow.json へ `state.finalizedAt` を backfill する処理を一度だけ実行する

### P3（付随）

- **R7** When backfill が実行されるとき, the system shall 対象 spec の本流への merge 日時を優先使用し、取得できない場合は spec の初回追加日時をフォールバックとする
- **R8** When 既存テスト fixture が `state.finalizedAt` を欠いて失敗するとき, the system shall 本 spec の作業範囲内で fixture を修正する

## Acceptance Criteria

- `sdd-forge flow run finalize` 成功後、対象 spec の flow.json に ISO 8601 UTC 形式の `state.finalizedAt` が存在すること
- `sdd-forge metrics token` の出力日付列が mtime ではなく `state.finalizedAt` 由来の日付になっていること
- `state.finalizedAt` が無い flow.json は `metrics token` 出力に含まれず、警告メッセージが stderr/ログに出ること
- キャッシュに `maxFinalizedAt` が無い場合、次回 `metrics token` 実行で再計算されキャッシュが更新されること
- 本 spec の finalize 実行後、既存全 spec の flow.json に `state.finalizedAt` が書き込まれており、metrics token が以前と同等以上の spec カバレッジで動作すること
- 既存の metrics 関連テストが全て成功すること
- 新規 unit テストが 4 本（R1〜R5 をカバー）追加されパスすること

## Test Strategy

- **種別**: unit（公式 `tests/` 配下、public CLI コマンド契約の検証）
- **検証対象**:
  1. `metrics token` が `state.finalizedAt` を日付軸に使うこと (R2)
  2. `state.finalizedAt` 欠損 spec を除外し警告ログを出すこと (R3)
  3. `flow finalize` が `state.finalizedAt` を flow.json に書き込むこと (R1)
  4. キャッシュ無効化が `maxFinalizedAt` で動作すること (R4, R5)
- **既存 fixture 更新**: 既存テスト fixture に `state.finalizedAt` を追加し、R3 の欠損ケースは新規テストで明示的にセットアップする
- **配置判定**: 「将来変更で壊れた場合は常にバグ」に YES のため `tests/` 配下

## Open Questions

（なし）

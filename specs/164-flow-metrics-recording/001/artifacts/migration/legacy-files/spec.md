# Feature Specification: 164-flow-metrics-recording

**Feature Branch**: `feature/164-flow-metrics-recording`
**Created**: 2026-04-09
**Status**: Draft
**Input**: GitHub Issue #127
**Related**: #8690 (sdd-forge metrics — consumer of this feature)

## Goal

agent 呼び出し完了時に、token 数・コスト・レスポンス量を `flow.json` の `metrics.<phase>` へ累積記録する。これにより `sdd-forge metrics` ツールが `.tmp/logs/` に依存せず `flow.json` だけからメトリクスを読めるようにする。

## Scope

1. **P1 — コアロジック**: agent 呼び出し完了後の flow.json へのメトリクス累積
2. **P3 — 可視化**: `sdd-forge flow run report` へのトークン/コスト表示追加

## Out of Scope

- `sdd-forge metrics` ツール本体（#8690 で対応）
- codex の credits → USD 変換（単価が未確定のため）
- worktree 間の並行書き込み競合対策（排他ロック等）
- `.tmp/logs/` の廃止（本機能実装後も継続して書き込む）
- **P2 — 履歴復元バックフィルスクリプト**: `.tmp/migrate-metrics.js` として手動実装済みだが gitignored（使い捨てローカルツール）のため本 spec の gate 検証対象外とする

## Why This Approach

`flow.json` は git 管理下に置かれるため、環境をまたいでメトリクスが保持される。`.tmp/logs/` はプロジェクトローカルで git 管理外になることが多く、CI や別マシンでの参照には適さない。`flow.json` を唯一の信頼できる情報源にすることで、`sdd-forge metrics` ツールがどの環境でも同じデータを参照できるようになる。

## Requirements

### P1: agent 呼び出し後のメトリクス記録

**R1-1.** When: active な SDD flow 中（いずれかの step が `in_progress` 状態）に agent 呼び出しが正常完了した時
Shall: `flow.json` の `metrics.<currentPhase>` に以下を累積する:
- token 種別ごとの使用量（input・output・キャッシュ作成・キャッシュ読み取り）を加算
- USD コストが取得できた場合のみ、コスト合計を加算
- 呼び出し回数を 1 加算
- レスポンス文字数を加算
- 使用モデル名ごとの呼び出し回数を記録

**R1-2.** When: active な flow がない（`sddPhase` が null）時
Shall: flow.json へのメトリクス記録を行わない（処理をスキップする）

**R1-3.** When: agent が USD コストを返さない（`cost_usd` が null）時
Shall: コスト加算をスキップし、その他フィールド（token 数・回数・文字数・モデル名）は記録する

**R1-4.** When: flow.json へのメトリクス書き込みに失敗した時
Shall: エラーをサイレントに無視せず、stderr に出力する。ただし agent の呼び出し結果（text）の返却は妨げない（メトリクス失敗は非致命的）

### P2: 過去ログのバックフィル（gate 対象外）

バックフィルスクリプト（`.tmp/migrate-metrics.js`）は使い捨てのローカルツールとして手動実装済み。gitignored のため本 spec の gate 検証対象外。

### P3: report コマンドへの表示追加

**R3-1.** When: `sdd-forge flow run report` を実行した時
Shall: フェーズごとの以下をレポートに含める:
- input・output・キャッシュトークンの合計数
- USD コスト合計（記録がある場合）
- agent 呼び出し回数

**R3-2.** When: あるフェーズで USD コストが記録されていない時
Shall: コスト欄に `N/A` と表示し、`0` や空欄を表示しない

## Acceptance Criteria

- [ ] SDD flow 実行中に agent を呼び出すと、flow.json の metrics に token 数・回数・文字数が累積される
- [ ] flow 外（`sdd-forge docs build` 等）での agent 呼び出しは flow.json に記録されない
- [ ] cost_usd が null の agent 呼び出しでも token 数と回数は記録される
- [ ] flow.json への書き込みが失敗しても agent の戻り値（text）は正常に返る
- [ ] `sdd-forge flow run report` の出力にトークン数・コスト・呼び出し回数が含まれる
- [ ] コストが記録されていないフェーズのレポートで 0 が表示されない

## Test Strategy

**P1: ユニットテスト**（`tests/` 配置）

- `flow-state.js` に追加する `accumulateAgentMetrics()` 相当の関数の単体テスト:
  - 正常系: token/cost/callCount/responseChars が正しく累積されること
  - cost null 時: cost のみスキップされ他フィールドは記録されること
  - metrics が未初期化状態からの初回書き込みが正しく動くこと
  - 複数回呼び出しで値が加算されること（上書きではなく累積）

**P2: スクリプトの手動確認**（`specs/164-flow-metrics-recording/tests/`配置）

- バックフィルスクリプトを既知のフィクスチャで実行し、出力 flow.json の値を検証するテスト

**P3: report 出力の確認**

- 既存の report テスト（存在する場合）にトークン表示のアサーションを追加

**テスト除外の理由がある場合:**

- agent.js / log.js 側の統合: 実際の agent 呼び出しを伴うため E2E テストは対象外。agent 呼び出し完了後のフック呼び出しはユニットテストでモックして検証する。

## Impact on Existing Features

- **flow.json スキーマ**: `metrics` フィールドに token/cost/callCount/responseChars/models の各フィールドが追加される。既存の読み取り箇所（`flow get status`・`flow get context`）は既存キー（`question` 等）のみを参照するため影響なし
- **`.tmp/logs/` の継続**: 本機能実装後も `.tmp/logs/` へのログ出力は変わらず継続する
- **既存 flow.json**: バックフィル実行前は token 系フィールドが存在しない。`flow run report` はその状態でも既存フィールドの表示に影響しない

## Alternatives Considered

- **log.js のエンドイベント内で直接書き込む案**: `log.js` は既に `resolveFlowContext()` で flow-state を読んでおり、同箇所で書き込みも行うのは自然。ただし「ログ記録」と「状態変更」の責務が混在する
- **agent.js の呼び出し完了後に書き込む案**: agent.js は usage を返せるが、flow-state への書き込みはフロー層の責務であり分離できる
- → 最終的な実装判断は impl フェーズで行う（spec レベルでは「agent 呼び出し完了後に累積する」を要件とする）

## Open Questions

以下は impl フェーズで確定する設計判断（spec 承認のブロッカーではない）:

- `log.js` と `flow-state.js` の責務分離: メトリクス累積を log.js のエンドイベント内で行うか、agent.js 呼び出し元で行うかは impl フェーズで確定する
- backfill のモデル記録形式: モデル名ごとの呼び出し回数を記録する形か、最終モデル名のみを記録するかは実装時に確定する

## Clarifications (Q&A)

- Q: バックフィルスクリプトはこの spec のスコープか？
  - A: 含める。「flow.json を唯一の情報源にする」ゴールに必要なため。
- Q: report 表示は含めるか？
  - A: 含める。記録のみでは機能として不完全なため。
- Q: cost_usd が null の場合は？
  - A: コスト加算のみスキップ。モデル名と token 数は記録する。
- Q: active flow がない場合は？
  - A: スキップ（flow.json がなければ記録しない）。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-10
- Notes: P1/P2/P3 すべてのスコープで承認。Open Questions は impl フェーズで確定。

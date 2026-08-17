# Feature Specification: 102-spec-retrospective

**Feature Branch**: `feature/102-spec-retrospective`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #30

## Goal

実装完了後に spec の精度を自動評価し、`specs/NNN-xxx/retro.json` に保存する機能を追加する。将来の spec 精度向上のための振り返りデータを蓄積する。

## Scope

- `src/flow/run/retro.js` を新規作成し、retro 評価ロジックを実装する
- `src/flow/registry.js` に `run retro` エントリを追加する
- finalize パイプライン（スキル）の commit ステップ前に retro を自動実行するよう flow-finalize スキルを更新する
- `sdd-forge flow run retro` で手動実行も可能にする

## Out of Scope

- retro データの集計・可視化（将来の機能）
- retro 結果に基づく spec テンプレートの自動改善
- flow.json の metrics 転記（既に flow.json に保持されている）
- ユーザー承認フロー（自動評価のみ）

## Clarifications (Q&A)

- Q: retro の実行タイミングは？
  - A: finalize の最初（commit 前）に自動実行。retro.json を実装コミットに含められる。
- Q: 出力形式は？
  - A: JSON (`retro.json`)。集計・比較が容易。表示は別コマンドで整形可能。
- Q: ファイル名は `retrolog.json` ではなく `retro.json`？
  - A: retro はスナップショット（1回の評価結果）であり、ログ形式ではない。`redolog.json`（追記型）とは役割が異なるため、名前も区別する。
- Q: 記録項目は？
  - A: requirements（各要件の達成状況）、unplanned（spec にない追加変更）、summary（達成率・所見）。
- Q: 評価方法は？
  - A: AI が spec.md の requirements と git diff を比較して自動評価。ユーザー承認なし。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-30
- Notes: 承認済み。Q&A で合意した設計方針に基づく。

## Requirements

優先順位: P1 > P2（P1 が完了しないと P2 は機能しない）

### Phase 1: retro コマンド実装 (P1)

1. `src/flow/run/retro.js` を新規作成する
   - flow.json から spec パスと requirements 配列を読み込む
   - spec.md の Requirements セクションを解析する
   - `git diff <baseBranch>...HEAD` で実装差分を取得する
   - AI エージェントに spec requirements と diff を渡し、以下を評価させる:
     - 各要件の達成状況（done / partial / not_done）
     - spec に記載されていない追加変更（unplanned）
     - 全体の達成率と所見（summary）
   - 結果を `specs/NNN-xxx/retro.json` に保存する
   - flow envelope 形式（`ok()` / `fail()`）で結果を返す
   - flow.json が存在しない場合は `fail()` でエラーを返し、非ゼロ終了コードで終了する
   - AI エージェント呼び出しが失敗した場合は `fail()` でエラーを返し、非ゼロ終了コードで終了する（黙殺しない）
   - `retro.json` が既に存在する場合、`--force` オプション付きで上書きする。`--force` なしで既存ファイルがある場合はエラーを返す

2. `retro.json` のスキーマは以下とする:
   ```json
   {
     "spec": "specs/NNN-xxx/spec.md",
     "date": "2026-03-30T...",
     "requirements": [
       { "desc": "要件テキスト", "status": "done|partial|not_done", "note": "根拠" }
     ],
     "unplanned": [
       { "file": "path/to/file", "change": "変更の概要" }
     ],
     "summary": {
       "total": 5,
       "done": 4,
       "partial": 1,
       "not_done": 0,
       "rate": 0.9,
       "notes": "全体所見"
     }
   }
   ```

3. `src/flow/registry.js` に `retro` エントリを追加する
   ```
   retro: { script: "flow/run/retro.js", desc: { en: "...", ja: "..." } }
   ```

### Phase 2: finalize スキル統合 (P2)

4. flow-finalize スキル (`.claude/skills/sdd-forge.flow-finalize/`) を更新する
   - commit ステップの前に `sdd-forge flow run retro --force` を実行するステップを追加する
   - retro が `fail()` を返した場合（AI 未利用等）はエラーをユーザーに表示し、スキップして finalize を続行する（review.js と同じパターン）

### 既存機能への影響

- **finalize パイプライン**: commit 前に retro ステップが追加される。成功パスでは retro.json が生成されてから commit に進む。retro が失敗した場合はスキップして commit に進むため、既存の finalize フローの成功パスに影響しない
- **既存の CLI コマンド・オプション**: 変更なし。新規コマンド `flow run retro` の追加のみ
- **flow.json のスキーマ**: 変更なし
- **specs/ ディレクトリ**: retro.json が新たに生成される。既存ファイルへの変更なし

## Acceptance Criteria

- `sdd-forge flow run retro` を実行すると、アクティブなフローの spec と diff を比較して `retro.json` が生成される
- `retro.json` は spec ディレクトリ（`specs/NNN-xxx/`）に保存される
- `retro.json` の `requirements` 配列は spec の Requirements と 1:1 で対応する
- `retro.json` の `unplanned` には spec にない変更がリストされる
- `retro.json` の `summary.rate` は達成率を 0〜1 の数値で示す
- flow.json が存在しない場合は `fail()` で非ゼロ終了コードを返す
- finalize パイプライン（スキル経由）で commit 前に自動実行される
- `--dry-run` オプションで実行プレビューができる

## Open Questions

- [x] AI エージェントが利用できない環境での fallback 動作 → エラーを返す。スキル側で retro 失敗時はスキップして続行可能とする（review.js と同じパターン）。

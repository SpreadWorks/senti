# Draft: Auto-generate spec work report on finalize

## Goal
finalize の Step 6 `record`（プレースホルダー）を `report` に置き換え、作業レポートを自動生成する。

## Report Contents (7 items + sync)
1. 実装内容の要約（git diff --stat + コミットメッセージ）
2. retro 結果（要件達成率: done/partial/not_done）
3. 発見したバグ（redolog から抽出）
4. redo 回数（redolog エントリ数）
5. docs 参照数（metrics.*.docsRead）
6. ソースコード参照数（metrics.*.srcRead）
7. 質問数（metrics.*.question）
8. sync 結果（docs 変更ファイル一覧 + 章変更概要）

## Out of Scope
- テスト情報（テスト数・種類）→ 別 spec（ボード adb3）

## Output Format
- `steps.report.data` — 構造化 JSON
- `steps.report.text` — コマンド側で整形済みテキスト（AI に表示を任せない）
- `specs/NNN/report.json` にファイル保存

## Placement
- finalize パイプライン Step 6（既存 `record` を `report` に置き換え）

## Sync Info
- Step 4 (sync) で git diff --stat + git diff を取得して保持
- report ステップで docs 変更ファイル一覧 + 章変更概要を含める
- PR ルートで sync スキップの場合は "PR route: sync skipped" と記録

## Impact on Existing
- STEP_MAP の `6: "record"` → `6: "report"` に変更
- finalize JSON レスポンスの `steps.record` → `steps.report` に変更
- SKILL.md の retro 表示ステップを report 表示に置き換え
- alpha 版なので後方互換不要

## Decisions (Q&A)
1. 配置場所: Step 6 record → report に置き換え
2. sync 結果: 変更ファイル一覧 + 章変更概要を含める
3. 出力形式: JSON + コマンド整形テキスト（AI に表示を任せない）
4. 保存: specs/NNN/report.json に保存する
5. テスト情報: スコープ外（別 spec adb3）

- [x] User approved this draft (2026-04-02)

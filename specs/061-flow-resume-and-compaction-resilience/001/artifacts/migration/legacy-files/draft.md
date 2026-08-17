# Draft: flow-resume and compaction resilience

## Background

Claude Code の compaction が発動すると、AI はフロー途中の文脈を失う。
現在の `flow.json` はステップ状態（done/in_progress/pending）を持つが、AI が作業を再開するのに必要な文脈情報が不足している。

## Competitive Research

- **Tsumiki kairo-loop**: TodoWrite/TaskList で状態を外部化。工程分割 + 反復実行。
- **cc-sdd Steering**: product.md/tech.md/structure.md でプロジェクト知識を永続化。
- sdd-forge は CLI ツールとして独立しているため、flow.json 拡充 + CLI コマンドで同等機能を実現する。

## Requirements (from Q&A)

1. flow.json に `request`（元のリクエスト）と `notes[]`（選択肢結果・メモ）を追加
2. `sdd-forge flow status --request "..."` で request を保存
3. `sdd-forge flow status --note "..."` で notes に追記
4. `currentPhase` は保存しない（steps の in_progress から導出）
5. `sdd-forge flow resume` コマンドを新規作成（stdout にサマリー出力）
6. `/sdd-forge.flow-resume` スキルも提供
7. 既存スキル（flow-plan, flow-impl, flow-merge）の選択ポイントに `--note` 記録指示を追加
8. スキル側の自動再開検知はしない（ユーザーが手動で呼ぶ）

## Decisions

- `decisions` → `notes` に改名（分かりやすさ）
- `currentPhase` は保存不要（steps から導出可能）
- `--note` は AI がスキル実行中に自動的に呼ぶ。ユーザーが直接叩く場面はない
- 自動再開検知は信頼性が低いため不採用

## Approval

- [x] User approved this draft
- Confirmed: 2026-03-16

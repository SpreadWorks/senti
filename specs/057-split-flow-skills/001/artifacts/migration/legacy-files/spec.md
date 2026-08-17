# Feature Specification: 057-split-flow-skills

**Feature Branch**: `feature/057-split-flow-skills`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User request

## Goal
SDD フローのスキルを3つに分割し、各フェーズの責務を明確にする。
現在の flow-start（全ステップ一括）を plan / impl / merge の3フェーズに分離することで、
フローの途中再開やフェーズ単位の再実行を可能にする。

## Scope
- スキルファイルのリネーム・新規作成（.claude/skills/ 配下）
- `src/lib/flow-state.js` の `FLOW_STEPS` 更新
- `src/flow/commands/status.js` は `FLOW_STEPS` を参照しているため自動対応

## Out of Scope
- flow-status スキルの変更
- `src/flow/commands/start.js`, `src/flow/commands/review.js` の変更（CLI コマンドはスキルとは独立）
- フロー状態の永続化構造（flow.json）の変更（ステップ配列の内容が増えるだけ）

## Clarifications (Q&A)
- Q: FLOW_STEPS はスキルごとに独立した配列にするか、全ステップ1配列か？
  - A: 全ステップを1つの配列に維持。各スキルが担当範囲のステップだけを操作する。
- Q: flow-impl のステップ構成は？
  - A: 現行の `implement`, `review`, `finalize` をそのまま維持（refine は概念であり独立ステップにしない）。
- Q: flow-merge のステップ追跡は？
  - A: `docs-update`, `docs-review`, `commit`, `merge`, `branch-cleanup`, `archive` の6ステップを追加。
- Q: flow-impl の finalize で何をするか？
  - A: 現行と同じパターン。finalize 承認後に `/sdd-forge.flow-merge` を起動する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-15
- Notes: 実装承認

## Requirements
1. `.claude/skills/sdd-forge.flow-start/` を `.claude/skills/sdd-forge.flow-plan/` にリネームし、SKILL.md を更新（ステップ 1〜8: approach〜test のみ。implement/review/finalize を削除）
2. `.claude/skills/sdd-forge.flow-close/` を `.claude/skills/sdd-forge.flow-merge/` にリネームし、SKILL.md を更新（merge フェーズのステップ追跡 docs-update〜archive を追加）
3. `.claude/skills/sdd-forge.flow-impl/SKILL.md` を新規作成（ステップ: implement, review, finalize。finalize 承認後に flow-merge を起動）
4. `src/lib/flow-state.js` の `FLOW_STEPS` を以下の17ステップに更新: `approach`, `branch`, `spec`, `draft`, `fill-spec`, `approval`, `gate`, `test`, `implement`, `review`, `finalize`, `docs-update`, `docs-review`, `commit`, `merge`, `branch-cleanup`, `archive`（末尾6ステップを新規追加）
5. CLAUDE.md のスキル参照を新しい名前に更新（該当箇所がある場合）

## Acceptance Criteria
- `sdd-forge flow status --step docs-update --status done` 等の新ステップ ID が正常に動作する
- 既存テストが通る（`npm test`）
- 3つのスキルファイルが正しい名前で配置されている
- 各スキルの SKILL.md の Available step IDs が担当範囲のみを記載している

## Open Questions
- (none)

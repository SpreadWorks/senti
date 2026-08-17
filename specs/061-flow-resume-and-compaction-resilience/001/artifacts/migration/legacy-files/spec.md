# Feature Specification: 061-flow-resume-and-compaction-resilience

**Feature Branch**: `feature/061-flow-resume-and-compaction-resilience`
**Created**: 2026-03-16
**Status**: Draft
**Input**: flow.json を元に途中から再開できる flow-resume コマンドを作りたい。compaction 耐性が必要。

## Goal

Claude Code の compaction 発動後でも、SDD フローの文脈を復元して作業を再開できるようにする。flow.json に文脈情報を追加し、それを読み出す `flow resume` コマンドと `/sdd-forge.flow-resume` スキルを提供する。

## Scope

1. flow.json スキーマ拡張（`request`, `notes[]` フィールド追加）
2. `sdd-forge flow status` に `--request`, `--note` オプション追加
3. `sdd-forge flow resume` コマンド新規作成
4. `/sdd-forge.flow-resume` スキル新規作成
5. 既存スキル（flow-plan, flow-impl, flow-merge）に `--note` 記録指示追加
6. help / locale 更新

## Out of Scope

- スキル側の自動再開検知（信頼性が低いため不採用）
- `currentPhase` フィールドの保存（steps から導出可能）
- flow.json のマイグレーション（既存 flow.json は notes/request が無くても動く）

## Approach

### Why this approach

Tsumiki の kairo-loop は Claude Code 固有の TodoWrite/TaskList に依存する。sdd-forge は CLI ツールとして独立しているため、flow.json の拡充 + CLI コマンドで同等の compaction 耐性を実現する。データ層（A）→ 出力層（B）の積み上げ構造とし、各層が独立してテスト可能にする。

### A. flow.json スキーマ拡張

`flow-state.js` に以下を追加：

```javascript
/**
 * @typedef {Object} FlowState
 * @property {string} spec
 * @property {string} baseBranch
 * @property {string} featureBranch
 * @property {string} [request]       // ← NEW: ユーザーの元のリクエスト
 * @property {string[]} [notes]       // ← NEW: 選択肢結果・メモの配列
 * @property {StepEntry[]} [steps]
 * @property {RequirementEntry[]} [requirements]
 * ...
 */
```

### B. status.js へのオプション追加

```
sdd-forge flow status --request "flow-resume コマンドを作りたい"
sdd-forge flow status --note "要件を整理してから仕様書を作成する"
```

- `--request`: flow.json の `request` フィールドを設定（上書き）
- `--note`: flow.json の `notes[]` 配列に末尾追加

### C. flow resume コマンド

`src/flow/commands/resume.js` を新規作成。

入力：
- `.sdd-forge/flow.json`
- `specs/NNN-xxx/spec.md`（flow.json の spec パスから）
- `specs/NNN-xxx/draft.md`（存在すれば）

出力（stdout）は以下のような構造化 Markdown：

- `# Flow Resume` ヘッダー
- `## Request` — 元のリクエスト
- `## Current Progress` — フェーズ、現在ステップ、完了ステップ
- `## Spec Summary` — Goal と Requirements（完了状態付き）
- `## Notes` — 記録されたメモ一覧
- `## Next Action` — 次に取るべきアクション

### D. flow-resume スキル

`.claude/skills/sdd-forge.flow-resume/SKILL.md` を新規作成。
- `sdd-forge flow resume` を実行
- 出力を読んで、適切なフロースキル（flow-plan / flow-impl / flow-merge）の該当ステップから再開するようユーザーに案内

### E. 既存スキルへの --note 記録指示

flow-plan, flow-impl, flow-merge の各選択ポイントに、AI が結果を `--note` で記録する指示を追加。

例（flow-plan ステップ 1）：
```
After user selects, record: sdd-forge flow status --note "approach: 要件を整理してから仕様書を作成する"
```

## Clarifications (Q&A)

- Q: `decisions` と `notes` どちらの名前にするか？
  - A: `notes` を採用。`decisions` は分かりづらい。
- Q: `currentPhase` を保存するか？
  - A: 保存しない。steps の in_progress 状態から導出する。
- Q: ユーザーが直接 `--note` を叩く場面はあるか？
  - A: ない。AI がスキル実行中に自動的に記録する。
- Q: スキル側で自動再開検知するか？
  - A: しない。compaction を AI が正確に検知できないため信頼性が低い。ユーザーが手動で `/sdd-forge.flow-resume` を呼ぶ。
- Q: `flow resume` の出力先は？
  - A: stdout にプレーンテキスト出力。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-16
- Notes: ドラフト Q&A 完了後、そのまま承認

## Requirements

1. `flow-state.js` の FlowState 型定義に `request` (string) フィールドを追加。`--request` で呼ばれたとき `setRequest()` が flow.json に書き込む
2. `flow-state.js` の FlowState 型定義に `notes` (string[]) フィールドを追加。`--note` で呼ばれたとき `addNote()` が flow.json の配列末尾に追記する
3. `flow-state.js` に `setRequest(workRoot, text)` 関数を追加。flow.json を読み込み、`request` フィールドを設定して保存する
4. `flow-state.js` に `addNote(workRoot, text)` 関数を追加。flow.json を読み込み、`notes` 配列の末尾に text を追加して保存する
5. `status.js` に `--request <text>` オプションを追加。受け取ったら `setRequest()` を呼び出す
6. `status.js` に `--note <text>` オプションを追加。受け取ったら `addNote()` を呼び出す
7. `resume.js` を新規作成し、flow.json + spec.md + draft.md からサマリーを stdout 出力
8. `flow.js` ディスパッチャに `resume` サブコマンドを追加
9. `help.js` に resume コマンドを追加
10. locale ファイル（en, ja）に resume 関連メッセージを追加
11. `/sdd-forge.flow-resume` スキルを新規作成
12. 既存スキル（flow-plan, flow-impl, flow-merge）の選択ポイントに `--note` 記録指示を追加

## Acceptance Criteria

- `sdd-forge flow status --request "text"` で flow.json に request が保存される
- `sdd-forge flow status --note "text"` で flow.json の notes 配列に追記される
- `sdd-forge flow resume` が flow.json 存在時にサマリーを stdout 出力する
- `sdd-forge flow resume` が flow.json 不在時にエラーメッセージを出して exit 1 する
- resume 出力に request, 進捗, spec 要約, notes, next action が含まれる
- `/sdd-forge.flow-resume` スキルが利用可能である
- 既存テストが壊れない

## Open Questions

(none)

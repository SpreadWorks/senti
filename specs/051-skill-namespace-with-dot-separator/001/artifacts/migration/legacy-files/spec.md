# Feature Specification: 051-skill-namespace-with-dot-separator

**Feature Branch**: `feature/051-skill-namespace-with-dot-separator`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User request

## Goal
スキル名にドット区切りの名前空間 (`sdd-forge.`) を導入し、シンボリックリンクを廃止して直接配置に変更する。AGENTS.md / CLAUDE.md もエージェントごとに独立管理する。

## Scope
1. スキル名・ディレクトリ名を `sdd-forge.<name>` 形式にリネーム
2. スキル配置からシンボリックリンクを排除し、直接コピーに変更
3. AGENTS.md ↔ CLAUDE.md のシンボリックリンクを廃止し、独立管理に変更
4. `setup.js` のスキル配置ロジックとシンボリックリンク作成ロジックを修正
5. sdd-forge リポジトリ自体の `.agents/skills/` 削除、`.claude/skills/` を新名前で直接配置

## Out of Scope
- setup 時の複数エージェント選択 UI（次の spec）
- タスク別エージェント/モデル設定（別 spec、`.tmp/multi-agent-task-config.md` 参照）
- 他エージェント（Gemini 等）への対応

## Clarifications (Q&A)
- Q: スキルのディレクトリ名もドット入りにするか？
  - A: はい。`sdd-forge.flow-start/SKILL.md` の形式
- Q: SKILL.md のプロンプト本文は変更するか？
  - A: 変更なし。`name:` フィールドのみ更新
- Q: AGENTS.md と CLAUDE.md の関係は？
  - A: エージェントごとに独立管理。Claude → CLAUDE.md、Codex → AGENTS.md
- Q: 両ファイルが存在する場合は？
  - A: それぞれに独立して差し込み/更新

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-14
- Notes: ドラフト承認済み。実装へ進む。

## Requirements

### R1: スキル名の名前空間化
- When: この spec の実装作業の一環として、開発者が `src/templates/skills/` 配下のディレクトリとファイルをリネームする
- `src/templates/skills/` 配下のディレクトリ名を変更:
  - `sdd-flow-start/` → `sdd-forge.flow-start/`
  - `sdd-flow-close/` → `sdd-forge.flow-close/`
  - `sdd-flow-status/` → `sdd-forge.flow-status/`
- 各 SKILL.md の `name:` フィールドを更新:
  - `sdd-flow-start` → `sdd-forge.flow-start`
  - `sdd-flow-close` → `sdd-forge.flow-close`
  - `sdd-flow-status` → `sdd-forge.flow-status`

### R2: スキル配置のシンボリックリンク廃止
- When: `sdd-forge setup` が実行されたとき
- `setup.js` の `deploySkills()` を修正:
  - `.agents/skills/<name>/SKILL.md` に直接コピーする
  - `.claude/skills/<name>/SKILL.md` に直接コピーする
  - シンボリックリンク作成ロジックを削除する

### R3: AGENTS.md / CLAUDE.md の独立管理
- When: `sdd-forge setup` が実行されたとき
- `setup.js` の `setupClaudeMdSymlink()` を `setupAgentFiles()` に置き換える
- シンボリックリンク作成ロジックをすべて削除する
- エージェントと対応ファイル: Claude → CLAUDE.md、Codex → AGENTS.md
- 現時点の setup ではエージェント選択 UI がないため、デフォルトで両方（CLAUDE.md + AGENTS.md）を対象とする
- エージェント選択 UI は次の spec で対応
- 各ファイルに対する setup 時の配置ロジック:
  - ファイルが存在しない → `sdd-forge agents` コマンドと同等のテンプレートから生成し配置する
  - ファイルが既に存在する → 既存ファイルを維持する（ディレクティブの差し込み・更新は `sdd-forge agents` コマンドの責務であり setup では行わない）
- `agents.js` の複数エージェントファイル対応（AGENTS.md 以外への拡張）は別 spec で対応する

### R4: sdd-forge リポジトリ自体の整理
- When: この spec の実装作業の一環として、開発者が手動で以下のファイル操作を行う
- `.agents/skills/` ディレクトリを git rm で削除する
- `.claude/skills/` 配下の既存スキル（シンボリックリンク）を削除し、`sdd-forge.flow-start/`, `sdd-forge.flow-close/`, `sdd-forge.flow-status/` の SKILL.md を `src/templates/skills/` からコピーして直接配置する

## Acceptance Criteria
- [ ] `src/templates/skills/` のディレクトリ名・SKILL.md の name が `sdd-forge.*` 形式になっている
- [ ] `setup.js` がシンボリックリンクを一切作成しない
- [ ] `setup.js` が `.claude/skills/` と `.agents/skills/` に直接コピーする
- [ ] AGENTS.md / CLAUDE.md がシンボリックリンクではなく独立ファイルとして管理される
- [ ] 既存の CLAUDE.md / AGENTS.md に対してディレクティブの差し込み・更新が正しく動作する
- [ ] sdd-forge リポジトリの `.agents/skills/` が削除されている
- [ ] sdd-forge リポジトリの `.claude/skills/` が新名前で直接配置されている
- [ ] 既存テストが通る

## Open Questions
- (なし)

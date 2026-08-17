# Feature Specification: 052-task-specific-agent-and-model-config

**Feature Branch**: `feature/052-task-specific-agent-and-model-config`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User request

## Goal
コマンドごとにエージェントとモデル（profile）を設定できるようにする。config.json の `providers` に `profiles`（名前付き args プリセット）を追加し、`commands` セクションでコマンド単位の agent + profile マッピングを定義する。

## Scope
- config.json に `profiles`（providers 内）と `commands` セクションを追加
- `resolveAgent` を拡張し、COMMAND_ID による階層探索をサポート
- 各コマンドファイルに `COMMAND_ID` 定数を追加し resolveAgent に渡す
- `--agent` CLI オプションを廃止
- setup でデフォルトエージェント選択時に、両 providers + 全 commands を default profile で自動生成
- setup の agent 選択から skip 選択肢を削除
- config.json カスタマイズのドキュメント整備

## Out of Scope
- upgrade コマンドでの config マイグレーション（既存 config への profiles/commands 追加）
- agents.js での複数ファイル出力（CLAUDE.md + AGENTS.md 独立管理）

## Clarifications (Q&A)
- Q: コマンドの粒度は？
  - A: トップレベル（`docs`）とサブコマンド（`docs.review`）の両方。フラットキーで `"docs.review"` と表記。

- Q: 解決順序は？
  - A: `commands["docs.review"]` → `commands["docs"]` → `providers[defaultAgent]`。profile も同様にフォールバック。

- Q: resolveAgent を新設か拡張か？
  - A: 既存を拡張。第2引数に COMMAND_ID 文字列を受け取る。

- Q: setup で細かく聞くか？
  - A: デフォルトエージェントのみ。profiles/commands のカスタマイズは config.json 手動編集。

- Q: 推奨設定でエージェントを混ぜるか？
  - A: 混ぜない。全て defaultAgent + default profile で生成。

- Q: args マージルールは？
  - A: `profiles[name]` + `provider.args` を concat。agent が変わったら変更先 provider の設定をベースにする。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-14
- Notes: ドラフト Q&A 完了後、承認

## Requirements

### R1: providers に profiles を追加
- When: config.json を読み込むとき
- What: `providers.<name>.profiles` に名前付き args プリセットを定義できる
- Then: 最終 args は `profiles[profileName]` + `provider.args` を concat して生成される

### R2: commands セクション新設
- When: config.json を読み込むとき
- What: `commands` セクションにフラットキー（`"docs.review"`）でコマンドごとの `agent` と `profile` を定義できる
- Then: `resolveAgent` がコマンドに応じた設定を返す

### R3: resolveAgent の階層探索
- When: `resolveAgent(config, COMMAND_ID)` が呼ばれたとき
- What: COMMAND_ID を `.` で分割し、`commands["docs.review"]` → `commands["docs"]` → `providers[defaultAgent]` の順に探索する
- Then: 最初にマッチした設定から agent + profile を解決し、provider オブジェクトに profile args をマージして返す

### R4: 各コマンドに COMMAND_ID を定義
- When: agent を使用する各コマンドファイルで
- What: ファイル上部に `const COMMAND_ID = "docs.review"` のような定数を定義し、`resolveAgent(config, COMMAND_ID)` に渡す
- Then: コマンドごとの設定が正しく解決される

### R5: --agent CLI オプション廃止
- When: `--agent` CLI オプションを使用するコマンド（forge, enrich 等）で
- What: `--agent` オプションとその処理コードを削除する
- Then: agent の指定は config.json の commands セクションのみで行われる

### R6: setup の変更
- When: `sdd-forge setup` を実行したとき
- What: デフォルトエージェント（claude / codex）のみ質問し、skip 選択肢を削除。両方の providers（profiles 含む）+ 全 commands を default profile で config.json に生成する
- Then: ユーザーはすぐに全コマンドを使え、カスタマイズは config.json 編集で行える

### R7: ドキュメント整備
- When: setup 完了後の config.json カスタマイズ時
- What: profiles の追加方法、commands の設定例、解決順序の説明をドキュメントに記載する
- Then: ユーザーが自力でカスタマイズできる

## Acceptance Criteria
- [ ] `resolveAgent(config, "docs.review")` が commands.docs.review → commands.docs → defaultAgent の順に解決する
- [ ] profile 指定時に `profiles[name]` + `provider.args` が正しく concat される
- [ ] profile 未指定時に親コマンド → default profile にフォールバックする
- [ ] `--agent` CLI オプションが全コマンドから削除されている
- [ ] setup で claude 選択時に両 providers + 全 commands（default profile）が生成される
- [ ] setup で codex 選択時に両 providers + 全 commands（default profile）が生成される
- [ ] setup の agent 選択に skip 選択肢がない
- [ ] 既存の agent 呼び出し箇所が全て COMMAND_ID 経由で resolveAgent を呼んでいる

## Open Questions
- (なし)

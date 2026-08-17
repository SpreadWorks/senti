# Feature Specification: 060-fix-help-layout-and-validate-config

**Feature Branch**: `feature/060-fix-help-layout-and-validate-config`
**Created**: 2026-03-16
**Status**: Draft
**Input**: docs とソースコードの不整合調査で発覚した2つの問題を修正する

## Goal

- `sdd-forge help` に未登録の flow サブコマンド（review, merge, cleanup）を追加し、全コマンドが help で発見可能にする
- `validateConfig()` を現在の config.json ネスト構造（`agent.*`）に対応させ、バリデーションの抜け穴を塞ぐ

## Scope

### A: help.js に flow サブコマンドを追加
- `src/help.js` LAYOUT 配列に `flow review`, `flow merge`, `flow cleanup` を追加
- `src/locale/en/ui.json` の `help.commands` に3件追加
- `src/locale/ja/ui.json` の `help.commands` に3件追加

### B: validateConfig() をネスト構造に対応
- `src/lib/types.js` validateConfig():
  - 旧フラット構造（`raw.providers`, `raw.defaultAgent`）のバリデーションを削除
  - `raw.agent` セクションのバリデーションを追加: `agent.default`, `agent.workDir`, `agent.timeout`, `agent.providers`, `agent.commands`
  - `agent.providers.{name}.command` (required), `agent.providers.{name}.args` (required) を検証
- `src/lib/types.js` JSDoc typedef を実際の構造に合わせて更新
- 既存テストの修正（テストが旧構造を使っている場合）

## Out of Scope

- `resolveAgent()` の変更（既に両構造に対応済み。今回は validateConfig のみ）
- config.json のマイグレーションツール（alpha 版ポリシー: 後方互換は不要）
- `agent.providers.{name}.profiles` のバリデーション追加（任意フィールドのため）

## Clarifications (Q&A)

- Q: 旧フラット構造のバリデーションは残すか？
  - A: alpha 版ポリシーに従い削除する。後方互換コードは書かない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-16
- Notes: 実装承認済み

## Requirements

1. `sdd-forge help` で flow review, flow merge, flow cleanup が表示される
2. validateConfig() が `agent.providers.{name}.command` と `agent.providers.{name}.args` を検証する
3. validateConfig() が旧フラット構造（`raw.providers`）を検証しない
4. 既存テストが全て通る（テスト修正が必要な場合は対応する）

## Acceptance Criteria

- `sdd-forge help` の出力に `flow review`, `flow merge`, `flow cleanup` が含まれる
- ネスト構造の config.json で validateConfig() がエラーなく通る
- `agent.providers` に `command` がないエントリでバリデーションエラーが出る
- `npm test` が全て PASS

## Open Questions

（なし）

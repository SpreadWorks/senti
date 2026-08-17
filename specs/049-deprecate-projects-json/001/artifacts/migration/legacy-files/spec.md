# Feature Specification: 049-deprecate-projects-json

**Feature Branch**: `feature/049-deprecate-projects-json`
**Created**: 2026-03-13
**Status**: Draft
**Input**: User request

## Goal
projects.json によるマルチプロジェクト管理機能を廃止する。各プロジェクトで `npm link` + 直接実行する運用に移行するため、不要になった仕組みを削除する。

## Scope
- `src/lib/projects.js` の削除
- `src/docs/commands/default-project.js` の削除
- `src/sdd-forge.js` から `--project` フラグ処理と `resolveProject` / `workRootFor` 依存を除去
- `src/docs/commands/setup.js` からマルチプロジェクト分岐（`addProject`, `workRootFor`, `loadProjects`）を除去
- `src/docs.js` のディスパッチテーブルから `default` を除去
- `src/help.js` から `default` コマンドの記述を除去
- locale ファイル（`ja/`, `en/`）から `default` コマンド関連メッセージを除去
- `PROJECT_MGMT` セットから `default` を除去

## Out of Scope
- `SDD_SOURCE_ROOT` / `SDD_WORK_ROOT` 環境変数による動作は維持する（外部からの設定手段として残す）
- `setup` コマンド自体の廃止（setup はプロジェクト初期設定として引き続き必要）

## Clarifications (Q&A)
- Q: setup コマンドの projects.json 書き込みロジックはどうするか？
  - A: projects.json への書き込みを完全に削除。setup は config.json / テンプレート / AGENTS.md の生成のみに集中する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-13
- Notes: ユーザー承認済み

## Requirements
1. `src/lib/projects.js` を削除する
2. `src/docs/commands/default-project.js` を削除する
3. `src/sdd-forge.js` から `--project` フラグ解析と `resolveProject` / `workRootFor` 呼び出しを除去する
4. `src/docs/commands/setup.js` から `projects.js` への依存と `registerProject` のマルチプロジェクト分岐を除去する
5. `src/docs.js` と `src/help.js` から `default` コマンドを除去する
6. locale ファイルから `default` コマンド関連のメッセージを除去する

## Acceptance Criteria
- `sdd-forge` の全コマンドが `projects.js` なしで正常動作する
- `sdd-forge default` コマンドが存在しない（unknown command エラーになる）
- `--project` フラグが解析されない
- `npm test` が全て通る
- `setup` コマンドが projects.json を作成しない

## Open Questions
- [ ]

# Draft: en templates for webapp presets

## Background

webapp 系プリセット（webapp, laravel, symfony, cakephp2）の章テンプレートは ja にしか存在しない。
`languages: ["en"]` 単一指定だと base の 4 章（overview, development, project_structure, stack_and_ops）しか生成されず、webapp 固有の章が欠落する。

## Approach

ja テンプレートの構造を保持しつつ、以下を英語化する:
- Markdown 見出し・固定テキスト
- `{{text}}` プロンプト内の指示文
- `{{data}}` ディレクティブのラベル（テーブルヘッダー）
- `<!-- @block -->` 等のテンプレート継承構文はそのまま保持

## Scope

| preset | files | total |
|---|---|---|
| webapp | auth_and_session, batch_and_shell, business_logic, controller_routes, database_architecture, db_tables, README | 7 |
| laravel | auth_and_session, controller_routes, db_tables, project_structure, stack_and_ops | 5 |
| symfony | auth_and_session, controller_routes, db_tables, project_structure, stack_and_ops | 5 |
| cakephp2 | auth_and_session, controller_routes, db_tables, development, project_structure, stack_and_ops | 6 |
| **total** | | **23** |

## Translation Rules

1. `{{data: source.method("Label1|Label2")}}` → ラベル部分のみ英語化
2. `{{text: ...}}` → プロンプト文を英語化（指示の意味を正確に保持）
3. `{{text[mode=deep]: ...}}` → パラメータはそのまま、プロンプト文のみ英語化
4. `<!-- @block: name -->` / `<!-- @endblock -->` / `<!-- @extends -->` → 変更なし
5. `<!-- {{data: docs.langSwitcher(...)}} -->` → 変更なし
6. 章番号（# 07. など）はそのまま保持

## Confirmation

- [x] User approved this draft
- Confirmed at: 2026-03-18

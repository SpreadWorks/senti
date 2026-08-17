# Feature Specification: 174-add-mysql-guardrails

**Feature Branch**: `feature/174-add-mysql-guardrails`
**Created**: 2026-04-14
**Status**: Draft
**Input**: Issue #143 — [ENHANCE] Add framework-specific guardrails to mysql preset

## Goal

mysql プリセットを新規作成し、MySQL/InnoDB 固有のベストプラクティスに基づく guardrail を追加する。あわせて webapp プリセットに RDBMS 汎用のデータアクセス guardrail を追加する。これにより、mysql タイプのプロジェクトで sdd-forge を使用するユーザーが spec/impl フェーズでデータベース設計・クエリ品質に関するガイダンスを受けられるようにする。

## Scope

- `src/presets/mysql/` の新規作成（`preset.json`, `guardrail.json`, `NOTICE`）
- `src/presets/webapp/guardrail.json` に RDBMS 汎用 guardrail 3 件を追記
- `src/presets/webapp/NOTICE` を新規作成（出典帰属）

## Out of Scope

- 既存の `database` プリセット guardrail の変更
- mysql プリセット向け docs テンプレート（`templates/`, `data/` 配下）の追加
- laravel / symfony など mysql を利用する他プリセットの変更
- webapp 以外のプリセットへの guardrail 追加

## Clarifications (Q&A)

- Q: mysql プリセットの親プリセットは何にすべきか？
  - A: `database` プリセットを親にする。postgres プリセットと同じ継承パターンであり、既存の database guardrail（migration-required-for-schema-changes 等 5 件）を自動で継承できる。

- Q: Issue の "review" フェーズを sdd-forge のどのフェーズにマッピングするか？
  - A: `impl` にマッピングする。コードを書く・レビューする段階で確認すべきルールであり、既存の guardrail（database/webapp）が同様に `impl` を使っているパターンと一致する。

- Q: NOTICE ファイルのフォーマットは？
  - A: 既存プリセット（nextjs 等）の NOTICE フォーマットに合わせる。一貫性のために独自フォーマットを採用しない。

- Q: `sickn33/antigravity-awesome-skills` を NOTICE に含めるか？
  - A: 含めない。採用した全 guardrail の出典が planetscale/database-skills または jarulraj/sqlcheck であり、同リポジトリから派生したルールは存在しない。

## Alternatives Considered

- **mysql を webapp の子にする案**: webapp は Web フレームワーク向けの guardrail を持ち、mysql プリセットとの関心が異なる。database を親にすることで DB 共通 guardrail を継承しつつ MySQL 固有の guardrail を重複なく追加できる。
- **database プリセットに MySQL 固有 guardrail を追加する案**: database プリセットは DB エンジン非依存の汎用プリセットであり、MySQL 固有技術（InnoDB, utf8mb4 等）の記述は不適切。mysql 専用プリセットとして分離する。

## Why This Approach

Issue #143 で既存 guardrail との重複分析（5 件の完全重複を排除）および出典調査が完了している。各 guardrail の phase 配置・ID も決定済みであり、新規プリセット作成と既存プリセット追記という最小変更で実現できる。継承構造（database → mysql）により既存 DB 共通 guardrail を再定義する必要がない。

## Requirements

**優先度 1（必須 — mysql プリセットの新規作成）**

1. When mysql タイプのプロジェクトで sdd-forge guardrail が参照される場合、sdd-forge は mysql プリセットとして定義された guardrail を提供すること。mysql プリセットは database プリセットを親として継承すること。
2. When mysql プロジェクトのユーザーが spec / impl フェーズで設計・実装レビューを行う場合、sdd-forge は MySQL/InnoDB 固有のベストプラクティスに基づく guardrail を提供すること。Issue #143 の M-1〜M-13 に定義された以下 13 件をすべて含むこと：
   - `monotonic-primary-key`（phase: spec）
   - `utf8mb4-charset-required`（phase: spec, impl）
   - `no-enum-column-type`（phase: spec, impl）
   - `datetime-over-timestamp`（phase: spec）
   - `composite-index-column-order`（phase: impl）
   - `explain-verify-query-plan`（phase: impl）
   - `no-function-on-indexed-column`（phase: impl）
   - `online-ddl-preferred`（phase: spec, impl）
   - `deadlock-retry-with-backoff`（phase: impl）
   - `batch-write-sizing`（phase: impl）
   - `prefer-union-all`（phase: impl）
   - `not-null-by-default`（phase: spec）
   - `no-multi-valued-attribute`（phase: spec, impl）
3. When mysql プリセットが外部ソースに基づく guardrail を含む場合、既存の NOTICE フォーマットに従った NOTICE ファイルを配置し、出典（planetscale/database-skills, jarulraj/sqlcheck）を帰属すること。

**優先度 2（必須 — webapp プリセットの拡張）**

4. When webapp ベースのプロジェクトユーザーが spec / impl フェーズでデータアクセス設計を行う場合、sdd-forge は RDBMS 汎用の guardrail を提供すること。Issue #143 の W-1〜W-3 に定義された以下 3 件を webapp guardrail に追加すること：
   - `no-select-star`（phase: impl）
   - `cursor-pagination-over-offset`（phase: spec, impl）
   - `transaction-scope-minimization`（phase: spec, impl）
5. When webapp プリセットが外部ソースに基づく guardrail を含む場合、既存の NOTICE フォーマットに従った NOTICE ファイルを新規作成し、出典を帰属すること。

**優先度 3（品質保証）**

6. When プリセットが変更・追加された場合、既存の preset 整合性テストが引き続き pass すること。

## Acceptance Criteria

- `src/presets/mysql/preset.json` が存在し、`parent: "database"` を持つこと
- `src/presets/mysql/guardrail.json` が M-1〜M-13 の 13 件を含むこと（ID・phase・title・body が Issue #143 の定義に準拠）
- `src/presets/mysql/NOTICE` が存在し、planetscale/database-skills と jarulraj/sqlcheck を帰属していること
- `src/presets/webapp/guardrail.json` に `no-select-star`, `cursor-pagination-over-offset`, `transaction-scope-minimization` の 3 件が追記されていること
- `src/presets/webapp/NOTICE` が存在し、上記 2 出典を帰属していること
- `npm test` が pass すること

## Test Strategy

`npm test` の preset 整合性テストで以下を検証する：
- 新規追加した mysql プリセットの `guardrail.json` が正しい JSON 構造を持つこと
- `parent: "database"` の継承チェーンが正しく解決されること
- webapp プリセットの追記後も既存 guardrail が変更されていないこと

テスト失敗時はプロダクトコードを修正する（テストコードの修正は禁止）。

## Open Questions

（なし）

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-14
- Notes: Issue #143 の内容に基づき承認。

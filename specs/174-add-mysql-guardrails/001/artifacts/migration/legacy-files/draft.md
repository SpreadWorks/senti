# Draft: add-mysql-guardrails

**開発種別:** 機能追加（プリセット新規作成 + 既存プリセット拡張）

**目的:** mysql プリセットを新規作成し MySQL/InnoDB 固有の guardrail を追加する。また webapp プリセットに RDBMS 汎用の guardrail を追加する。

## Q&A

### Q1: mysql プリセットの親プリセットは何にするか？
**A:** database プリセットを親にする。postgres プリセットと同じ継承パターン。

### Q2: Issue の "review" フェーズを sdd-forge のどのフェーズにマッピングするか？
**A:** `impl` にマッピングする。コードを書く/レビューする段階で確認すべきルールであり、既存の guardrail パターンと一致する。

### Q3: NOTICE ファイルのフォーマットは？
**A:** 既存プリセット（nextjs 等）の NOTICE フォーマットに合わせて統一する。

### Q4: `sickn33/antigravity-awesome-skills` を NOTICE に含めるか？
**A:** 含めない。実際に採用した guardrail の出典がすべて planetscale/database-skills または jarulraj/sqlcheck であるため、Issue の NOTICE 指定どおり記載しない。

## 要件（優先順位順）

**優先度 1（必須 — mysql プリセットの新規作成）**

1. When mysql プリセットが存在しない場合、sdd-forge は mysql タイプのプロジェクトに guardrail を提供できない。したがって、mysql プリセットを新規作成し、database プリセットを親として継承すること。
2. When mysql プロジェクトのユーザーが spec / impl フェーズで MySQL/InnoDB 固有のベストプラクティスを参照する場合、sdd-forge は schema 設計・インデックス・クエリ最適化・トランザクション・DDL に関する guardrail を提供すること。Issue #143 に定義された 13 件をすべて含むこと。
3. When mysql プリセットが外部ソースに基づく guardrail を含む場合、NOTICE ファイルに出典と帰属情報を記載すること（`Original sources:` 形式）。

**優先度 2（必須 — webapp プリセットの拡張）**

4. When webapp ベースのプロジェクトユーザーが spec / impl フェーズでデータアクセスパターンを設計・レビューする場合、sdd-forge は RDBMS 汎用（特定 DB エンジンに依存しない）の guardrail を提供すること。Issue #143 に定義された 3 件（SELECT * 禁止・カーソルページネーション・トランザクションスコープ最小化）を webapp guardrail に追加すること。
5. When webapp プリセットが外部ソースに基づく guardrail を含む場合、NOTICE ファイルを新規作成し出典を帰属すること。

**優先度 3（品質保証）**

6. When プリセットが変更・追加された場合、既存の preset 整合性テストが引き続き pass すること。

## 影響範囲

- mysql プリセット新規作成（他の既存プリセット・コードへの影響なし）
- webapp プリセットの guardrail に 3 件追記
- webapp プリセットに NOTICE ファイルを新規追加

---

- [x] User approved this draft

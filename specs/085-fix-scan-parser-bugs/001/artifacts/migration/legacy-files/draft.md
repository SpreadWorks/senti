# Draft: fix-scan-parser-bugs

## 背景

acceptance テストで発覚した scan parser の3つのバグを修正する（issue #10）。

## Q&A

### バグ 1: Laravel routes parser (`src/presets/laravel/scan/routes.js`)

**Q:** `Route::resource` 展開時の3つの問題（URI パラメータ欠落、only/except 無視、ネストリソース）をすべて修正する方針でよいか？
**A:** はい。

修正内容:
1. show/edit/update/destroy の URI に `/{resource}` パラメータを付加（例: `/threads/{thread}`）
2. `->only([...])` / `->except([...])` メソッドチェーンを解析してアクションをフィルタ
3. ネストリソース `threads.posts` → `/threads/{thread}/posts/{post}` に正しく展開

### バグ 2: Laravel config parser (`src/presets/laravel/scan/config.js`)

**Q:** Laravel 11 の `bootstrap/app.php` 対応だけか、Kernel.php のグループ解析も含めるか？
**A:** 両方含める。

修正内容:
1. `bootstrap/app.php` が存在する場合 → Laravel 11 スタイルとして `->withMiddleware()` 内の `->append()` / `->prepend()` / `->alias()` / `->group()` を解析
2. `app/Http/Kernel.php` が存在する場合 → Laravel 10 以前として `$middleware` / `$middlewareGroups` / `$middlewareAliases` を解析
3. 統一した出力形式で返す

### バグ 3: Symfony entities キー不一致

**Q:** `webapp.models.relations` が Symfony プロジェクトで null になる原因と修正方針は？
**A:** webapp の `business_logic.md` を Symfony が継承しており、`model-relations` ブロック内の `webapp.models.relations` が `analysis.models.models` を参照するが、Symfony は `analysis.entities.symfonyEntities` に書くためキー不一致。Symfony プリセットに `business_logic.md` を追加し `model-relations` ブロックを override する。

## 対象ファイル

- `src/presets/laravel/scan/routes.js` — バグ 1
- `src/presets/laravel/scan/config.js` — バグ 2
- `src/presets/symfony/templates/ja/business_logic.md` — バグ 3（新規）
- `src/presets/symfony/templates/en/business_logic.md` — バグ 3（新規）

- [x] User approved this draft (2026-03-22)

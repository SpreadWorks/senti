# Feature Specification: 085-fix-scan-parser-bugs

**Feature Branch**: `feature/085-fix-scan-parser-bugs`
**Created**: 2026-03-22
**Status**: Draft
**Input**: GitHub issue #10

## Goal

acceptance テストで発覚した3つの scan parser バグを修正し、Laravel および Symfony プリセットのドキュメント生成精度を向上させる。

## Scope

### Bug 1: Laravel routes parser (`src/presets/laravel/scan/routes.js`)

`Route::resource` / `Route::apiResource` の展開ロジックを修正する。

### Bug 2: Laravel config parser (`src/presets/laravel/scan/config.js`)

ミドルウェア登録情報の解析を追加する。Laravel 10 以前（Kernel.php）と Laravel 11（bootstrap/app.php）の両方に対応する。

### Bug 3: Symfony entities キー不一致

Symfony プリセットに `business_logic.md` テンプレートを追加し、webapp から継承した `model-relations` ブロックを override して `symfony.entities.relations` を参照するようにする。

## Out of Scope

- Laravel routes の `Route::group` や `Route::prefix` のスコープ解析
- ミドルウェアの実行順序やパイプラインの解析
- Symfony 以外のプリセットの `business_logic.md` override

## Clarifications (Q&A)

- Q: バグ 3 の原因は webapp の models DataSource と Symfony の entities DataSource のキー不一致か？
  - A: はい。webapp の `business_logic.md` テンプレートが `webapp.models.relations`（`analysis.models.models`）を参照するが、Symfony scan は `analysis.entities.symfonyEntities` に書き込むため null になる。Symfony テンプレートで `model-relations` ブロックを override して解決する。

- Q: Laravel 11 の middleware 対応だけか、Kernel.php のグループ解析も含めるか？
  - A: 両方含める。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-22
- Notes: 3つのバグすべての修正方針を承認

## Requirements

優先順位: R1 = R2 = R3 > R6 > R4 = R5（routes バグが最も影響大、Symfony キー不一致が次点、middleware 解析は新機能追加のため最後）

### R1: Route::resource の URI パラメータ付加

- `show`, `edit`, `update`, `destroy` アクションの URI にリソース名から導出したパラメータを付加する
- 例: `Route::resource('threads', ...)` → show の URI は `/threads/{thread}`

### R2: Route::resource の only/except 対応

- `->only([...])` が指定された場合、指定されたアクションのみ展開する
- `->except([...])` が指定された場合、指定されたアクションを除外して展開する
- メソッドチェーンを正規表現で解析する

### R3: ネストリソースの URI 展開

- `Route::resource('threads.posts', ...)` を `/threads/{thread}/posts/{post}` 形式に展開する
- ドット区切りの各セグメントに対してリソース名とパラメータを交互に配置する

### R4: Laravel 11 ミドルウェア解析

- `bootstrap/app.php` が存在し `->withMiddleware()` を含む場合、コールバック内の `->append()`, `->prepend()`, `->alias()`, `->group()` を解析する
- `bootstrap/app.php` が存在しない、または `->withMiddleware()` を含まない場合はスキップする（空の結果を返す）
- 解析結果を `extras.middlewareRegistration` として返す

### R5: Laravel 10 以前のミドルウェアグループ解析

- `app/Http/Kernel.php` が存在する場合、`$middleware`, `$middlewareGroups`, `$middlewareAliases` プロパティを解析する
- `app/Http/Kernel.php` が存在しない場合はスキップする（空の結果を返す）
- 両ファイルが共存する場合は両方を解析し結果をマージする（Laravel 移行中のプロジェクト対応）
- どちらも存在しない場合、`extras.middlewareRegistration` は空オブジェクトになる
- 解析結果を R4 と統一した形式で `extras.middlewareRegistration` として返す

### R6: Symfony business_logic.md テンプレート追加

- `src/presets/symfony/templates/ja/business_logic.md` と `en/business_logic.md` を新規作成する
- `{%extends%}` で webapp のテンプレートを継承する
- `model-relations` ブロックを override し、`symfony.entities.relations` を参照する

## Acceptance Criteria

- AC1: `Route::resource('threads', ...)` の show アクション URI が `/threads/{thread}` になる
- AC2: `Route::resource('threads', ...)->only(['index', 'show'])` で index と show のみ展開される
- AC3: `Route::resource('threads', ...)->except(['destroy'])` で destroy 以外が展開される
- AC4: `Route::resource('threads.posts', ...)` の show URI が `/threads/{thread}/posts/{post}` になる
- AC5: `bootstrap/app.php` に `->withMiddleware()` がある Laravel 11 プロジェクトでミドルウェア登録情報が解析される
- AC6: `app/Http/Kernel.php` がある Laravel 10 以前のプロジェクトでミドルウェアグループが解析される
- AC7: Symfony プロジェクトで `business_logic.md` のモデル関連セクションが `symfony.entities.relations` から正しくデータを取得する

## Open Questions

（なし）

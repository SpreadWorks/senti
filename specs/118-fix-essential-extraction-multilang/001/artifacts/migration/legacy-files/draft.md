# Draft: 118-fix-essential-extraction-multilang

## 背景
Essential 抽出が JS 専用パターンのみだったため、PHP プロジェクトで enrich が 0 件になるバグが発生。
先ほどのコミットで minify.js に PHP/Python パターンを直書きしたが、設計に反する。

## 決定事項

### 設計方針
- lang ハンドラ（src/docs/lib/lang/*.js）に extractEssential メソッドを追加する
- minify.js はディスパッチャに徹する。extractEssential のロジックを持たない
- handler.extractEssential があれば使い、なければ通常 minify にフォールバック
- YAML 等のデータファイルは Essential 抽出の対象外（通常 minify で渡す）

### 実装対象
- js.js: JS/TS 用（import/export/function/class/return/throw/await/new/fs.*/path.*/JSON.*/process.*）
- php.js: PHP 用（require/include/use/namespace/public function/class/return/throw/new）
- py.js: Python 用（from import/def/class/return/raise/yield）
- yaml.js: 実装しない（通常 minify フォールバック）

### minify.js の変更
- extractEssential 関数を削除
- mode: "essential" の場合: handler.extractEssential → 通常 minify のフォールバック
- 先ほどのコミットの PHP/Python 直書きと 5% フォールバックを削除

- [x] User approved this draft (2026-04-02)

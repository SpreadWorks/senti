# Draft: Mechanical extraction of structural info and Factory pattern for language handlers

## Issue

GitHub Issue #38: 構造情報の機械的抽出（imports/exports/usedBy）+ 言語ハンドラの Factory パターン導入

## 決定事項

### 1. Factory 化の範囲
- parse + minify + extractImports をすべて Factory に統合
- 既存の scanner.js の parseJSFile/parsePHPFile と minify.js の minifyJsLike/minifyPhp を lang/ 配下に移動
- scanner.js と minify.js は lang-factory.js 経由で呼ぶように変更

### 2. ファイル構成
```
src/docs/lib/lang/
  js.js   → { parse, minify, extractImports, extractExports }
  php.js  → { parse, minify, extractImports, extractExports }
  py.js   → { minify }
  yaml.js → { minify }
src/docs/lib/lang-factory.js
  getLangHandler(filePath) → 拡張子から言語ハンドラを返す
```

### 3. 追加フィールド
ModuleEntry に以下の 4 フィールドを追加:
- imports: 依存先パス配列
- exports: 公開名配列
- usedBy: 逆引きパス配列（scan 完了後に算出）
- extends: 継承元クラス名

### 4. usedBy の算出タイミング
- scan.js のファイルループ完了後に、全 entry の imports を走査して usedBy を算出
- hook 機構は不要。scan.js に直接記述

### 5. ドキュメント
- src/AGENTS.md に言語ハンドラの開発方法（新しい言語の追加手順、インターフェース仕様）を記載

## 承認

- [x] User approved this draft (2026-03-31)

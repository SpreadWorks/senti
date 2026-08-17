# Draft: StructureSource.directories() フォールバック

## 要件まとめ

### 問題
トップレベルディレクトリが1つしかないプロジェクト（CakePHP の app/、Node.js の src/ 等）で、directories() テーブルが1行だけになり構造把握に役立たない。

### 解決策
トップレベル集約の結果が1エントリの場合、子ディレクトリで再集約する。再集約後もまだ1エントリなら、さらに深い階層で繰り返す。

### 展開の深さ
- 再帰的に展開する（結果が1行なら繰り返す）
- 上限はコード内定数で5
- config.json には追加しない

### 変更対象
- `src/presets/base/data/structure.js` の `directories()` メソッドのみ
- `tree()` は対象外（全ディレクトリをフラット表示するため問題なし）

## Q&A ログ

1. **展開の深さ?** → 再帰的に展開、上限5（コード内定数）
2. **上限の管理?** → コード内定数。config.json 不要
3. **変更対象?** → directories() のみ。tree() は対象外

- [x] User approved this draft (2026-03-28)

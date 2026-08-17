# Tests for 183-prefix-comments

## What was tested

- プリフィックス付き単一行コメント（`WHY:` / `HACK:` / `SECURITY:`）が minify で保持されること
- プリフィックスなし・書式違い（`why:`, `Why:`）・未定義プリフィックス（`TODO:` 等）のコメントが削除されること
- コード末尾に付与されたプリフィックス付きコメントが削除されること
- 各言語ハンドラ（JS / PHP / Python / YAML）で上記挙動が一貫していること
- shebang 行は引き続き保持されること（PHP / Python / YAML）

## Where tests live

**`tests/unit/docs/lib/minify.test.js`** (formal tests, run by `npm test`)

プリフィックスコメント保持は公開関数 `minify()` の挙動契約であり、将来 minify がこの仕様を破壊した場合は常にバグである。したがって spec スコープでなく formal tests に配置した。

追加された describe ブロック:
- `prefix comment preservation (JS)`
- `prefix comment preservation (PHP)`
- `prefix comment preservation (Python)`
- `prefix comment preservation (YAML)`

## How to run

```
node tests/run.js --scope unit
```

または特定のテストファイルのみ:

```
node --test tests/unit/docs/lib/minify.test.js
```

## Expected results

- 全 unit テストが PASS（追加した 24 個の prefix テストを含む）
- 既存 minify テストは引き続き PASS

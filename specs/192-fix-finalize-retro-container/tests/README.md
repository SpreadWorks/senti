# Tests for spec 192

## 対象

Issue #179（finalize の retro が `container.get is not a function` で失敗する）の回帰防止テスト。

## 配置

- 正式配置: `tests/unit/flow/run-finalize-retro-invocation.test.js`
  - spec 文脈に依存せず、退行は常にバグとして扱うため formal 配置
- 本ディレクトリにはテストコードを置かず、所在と目的を記録するのみ

## 検証内容

1. `src/flow/lib/run-finalize.js` が `src/lib/container.js` の module-level `container` シングルトンを import していること
2. `new RetroCommand().run(...)` の第1引数が `container` であり、`{ ...ctx }` の展開ではないこと
3. `executeCommitPost` 実行時に `container.get is not a function` エラーが発生しないこと

## 実行方法

```bash
# 当該テストのみ
node --test tests/unit/flow/run-finalize-retro-invocation.test.js

# 全テスト
npm test
```

## 期待される結果

- 修正前: 3 件すべて失敗（特に "executeCommitPost does not raise 'container.get is not a function'" が `actual: 'container.get is not a function'` で失敗）
- 修正後: 3 件すべてパス

# Spec 151: テスト

## テスト内容

Log 基底クラス・AgentLog 継承・logger 関数・resolveLogDir のユニットテスト。

## テスト配置

- `tests/unit/lib/log.test.js` — 汎用ログ基盤のテスト（`npm test` で実行される正式テスト）

## 実行方法

```bash
npm test -- --scope unit
# または個別実行
node --test tests/unit/lib/log.test.js
```

## テスト対象

| テスト | 対応する要件 |
|---|---|
| Log base class | R1: Log 基底クラスの作成 |
| AgentLog extends Log | R3: AgentLog の Log 継承化 |
| logger | R2: logger 関数の作成 |
| resolveLogDir | R5: resolveLogDir の移動 |

## 期待結果

- 実装前: import 失敗により stub が使われ、一部テストが FAIL する
- 実装後: 全テストが PASS する

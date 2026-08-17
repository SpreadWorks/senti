# Spec 189 Tests

## 何をテストするか

spec 189「CodexProvider JSON parse 失敗の修正」の要件検証:

- **R1.1, R1.3**: builtin profile の args に JSON フラグが literal に含まれる
- **R2.1**: ユーザー config の profile args がそのまま CLI に渡り、追加の JSON フラグが注入されない
- **R2.2**: ユーザーが独自の JSON フラグ名を args に書けば、パッケージは追加注入せずそれを尊重する
- **R2.3**: Provider 抽象から `jsonFlag()` メソッドが除去されている

## 場所

`specs/189-fix-codex-json-parse/tests/spec.test.js` — spec 検証用。`npm test` では実行されない。

## 実行方法

```bash
node --test specs/189-fix-codex-json-parse/tests/spec.test.js
```

## 期待結果

実装完了後はすべて PASS。実装前は以下で FAIL:
- `R1.1` — `--json` が args に含まれていない
- `R2.3` — `jsonFlag()` が存在する
- `R1.3` — `--json` が finalArgs に含まれない

## 関連する formal tests

`tests/unit/lib/provider.test.js` と `tests/unit/lib/agent-service.test.js` は、実装変更に合わせて `jsonFlag`/`injectJsonFlag` 依存部分を更新する（implementation フェーズで扱う）。

# Tests for spec 183-repair-json-backtick

## Overview

Issue #159 の R1〜R5 を検証する 5 本の unit テストを `tests/unit/lib/json-parse.test.js` の末尾に追記している。
公開 API `repairJson` の契約検証であり、将来変更で壊れたら常にバグ → 公式 `tests/` 配下に配置。

## Test Cases

- R1/R2 ハイブリッド: open backtick / close double-quote（現実の retro 失敗パターン）
- R5: open backtick / close backtick
- R3: 値本文中の backtick がそのまま保持されること
- R5: 複数の backtick-opened value を含むオブジェクト
- R1/R2: backtick-opened value + 後続フィールド（hybrid close）

## Running

```bash
node tests/run.js --scope unit --filter json-parse
```

## Expected

実装前: 5 件 fail。実装完了後: 全 pass、既存 21 件にも回帰なし。

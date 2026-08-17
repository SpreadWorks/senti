# Tests for 193-raw-post-hook-exit-code

## 対象
Issue #177「raw mode の post hook 失敗が exit code に反映されない」の修正検証。

## 配置
dispatcher の公開契約（post hook 失敗時の exit code 挙動）は、破綻すれば常にバグであるため formal test として扱う。

- `tests/unit/lib/dispatcher.test.js` 内の describe `"post hook failure exit code (issue #177)"` に 6 ケースを追加。

## 検証内容
1. envelope mode × post hook 同期失敗 → exit 1、`ok=true`、`warnings` に POST_HOOK_FAILED 記録保持。
2. raw mode × post hook 同期失敗 → exit 1、stderr に失敗メッセージ。
3. envelope mode × post hook 非同期失敗（Promise reject）→ exit 1。
4. raw mode × post hook 非同期失敗 → exit 1。
5. envelope mode × post hook 成功 → exit 0（現状維持）。
6. raw mode × post hook 未定義 × Command 本体成功 → `setExitCode(1)` は呼ばれない（現状維持）。

## 実行方法
```
node --test tests/unit/lib/dispatcher.test.js
# または
npm test
```

## 期待結果
- 修正前: 1〜4 が失敗、5〜6 は成功。
- 修正後: 全ケース成功。

# Test Strategy: 184-flow-manager-refactor

## What is tested

このリファクタは振る舞い不変が前提のため、新規ユニットテストは追加しない。
代わりに既存テスト (`tests/` 配下で `flow-state` を import している 24 ファイル) を新 API (`container.flowManager.xxx()`) に書き換え、全 pass を保証する。

| Spec Requirement | 検証手段 |
|---|---|
| R1: Container 経由で状態管理 | `grep -r "from .*lib/flow-state" src/ tests/` の結果が pure helper モジュールのみを返す (AC1) |
| R2: workRoot 引数の全廃 | 新 API メソッドシグネチャに `workRoot` が現れない (AC2) |
| R3: 全機能カバー | 既存テストが新 API 上で全 pass (AC3) |
| R4: 既存テスト全 pass | `node tests/run.js` が 0 終了 (AC4) |
| R5: 内部 3 クラス分割 + ファサード | コードレビューで確認 (AC5) |
| R6: pure helper 据置 | pure helper を使う既存テストが書き換えなしで通る (AC6) |
| R7: git spawn 重複排除 | コードレビューで確認、Container 解決済み値の参照を確認 (AC7) |

## Where tests are located

- 既存テスト全て (場所維持): `tests/unit/lib/flow-state-*.test.js`, `tests/unit/flow/**`, `tests/e2e/flow/**` 等
- 該当テストはリネーム (`flow-state-*.test.js` → `flow-manager-*.test.js`) を実装フェーズで判断
- spec 固有テスト: なし (このディレクトリは README のみ)

## How to run

```bash
cd /home/nakano/workspace/sdd-forge/.sdd-forge/worktree/feature-184-flow-manager-refactor
node tests/run.js > .tmp/logs/test-output.log 2>&1
grep -E "PASS|FAIL|ok|not ok" .tmp/logs/test-output.log
```

## Expected results

- 全テスト pass (期待値変更なし、API 呼び出し形式のみ書換)
- カバレッジは現状維持

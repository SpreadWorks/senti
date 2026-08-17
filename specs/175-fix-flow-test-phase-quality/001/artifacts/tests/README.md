# Tests for spec 175: fix-flow-test-phase-quality

## What was tested and why

| テスト | 場所 | 理由 |
|---|---|---|
| `plan.test-mode` の description・labels 変更 | `tests/unit/flow/prompt-test-mode.test.js` | 公開 CLI インターフェースの契約テスト。将来の変更で壊れれば常にバグ |
| `flow get test-result` 新コマンド | `tests/unit/flow/get-test-result.test.js` | 公開 CLI インターフェースの契約テスト。将来の変更で壊れれば常にバグ |
| SKILL.md テンプレートへの CRITICAL STOP 追加 | `specs/175-fix-flow-test-phase-quality/tests/test-phase-quality.test.js` | この spec の要件検証。長期メンテナンス対象外 |

## テストの場所

- **formal tests** (npm test に含まれる):
  - `tests/unit/flow/prompt-test-mode.test.js` — `plan.test-mode` の description/labels 検証（既存テストに追記）
  - `tests/unit/flow/get-test-result.test.js` — `flow get test-result` の JSON envelope・summary・log 返却・非ゼロ exit
- **spec verification tests** (npm test に含まれない):
  - `specs/175-fix-flow-test-phase-quality/tests/test-phase-quality.test.js` — SKILL.md の CRITICAL STOP 存在確認、実装ファイルの存在確認

## 実行方法

```bash
# formal tests
npm test -- --filter "prompt-test-mode|get-test-result"

# spec verification tests（worktree 内から）
node specs/175-fix-flow-test-phase-quality/tests/test-phase-quality.test.js
```

## 期待結果

実装完了後:
- `prompt-test-mode.test.js` の全4テストが PASS
- `get-test-result.test.js` の全5テストが PASS
- `test-phase-quality.test.js` の全2テストが PASS

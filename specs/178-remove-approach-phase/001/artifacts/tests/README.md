# Spec 178 Tests

## What is tested

本スクリプトは spec 178（`approach` フェーズ廃止）の受け入れ基準のうち、静的に検証可能な項目を網羅する。

- **R1 / R5**: `FLOW_STEPS` および `PHASE_MAP` から `approach` が除去されていること
- **R9 / R10**: `sdd-forge.flow-auto` / `sdd-forge.flow-status` の SKILL.md テンプレートに `approach` が含まれないこと
- **R12**: `sdd-forge.flow-plan` の SKILL.md description フィールドに `approach` が含まれないこと

このテストは spec 固有の静的チェックであり、`npm test` には含めない（将来 `approach` を別目的で再導入した場合に自動的に壊れる性質のため、formal tests には適さない）。

## Location

- `specs/178-remove-approach-phase/tests/verify-spec-requirements.js`

## How to run

```bash
node specs/178-remove-approach-phase/tests/verify-spec-requirements.js
```

## Expected result

実装完了後:

```
PASS: spec 178 requirements verified
```

実装前（現状）または未完の場合は `FAIL:` と該当理由が出力され、プロセスは非0で終了する。

## 補完されるテスト

本 spec に関連する振る舞い検証のうち、永続的な契約テストは `tests/unit/` および `tests/e2e/` の既存テストを実装フェーズで更新して対応する:

- `tests/unit/flow/flow-steps.test.js`: FLOW_STEPS 配列のアサーションを新モデルに合わせて更新
- `tests/unit/flow/set-step.test.js`: `approach` を使っていたテストケースを新規の有効ステップ（例: `branch`）に差し替え
- `tests/e2e/flow/commands/resume.test.js`: notes の例文から `approach` を別文言に差し替え
- 新規: `sdd-forge flow set init --issue N --request "..."` が preparing-flow に値を保存し、`sdd-forge flow prepare` が引き継ぐことを検証する unit/e2e テスト（R3 / R4）を追加

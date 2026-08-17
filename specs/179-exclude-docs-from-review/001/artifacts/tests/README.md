# Spec 179 Tests

## What is tested

本スクリプトは spec 179（review diff から自動生成ファイルを除外）の要件を静的に検証する。

- **R1-R4**: `review.js` に除外パターン（`docs/`, `README.md`, `AGENTS.md`, `.sdd-forge/output/`）が含まれること
- **R5**: 除外が fallback 経路（filePath なし）でのみ適用されること

## Location

- `specs/179-exclude-docs-from-review/tests/verify-spec-requirements.js`

## How to run

```bash
node specs/179-exclude-docs-from-review/tests/verify-spec-requirements.js
```

## Expected result

実装完了後: `PASS: spec 179 requirements verified`
実装前: `FAIL:` + 該当理由

# Tests: 173-fix-upgrade-exp-skill-path

## What was tested and why

`src/upgrade.js` の experimental スキルテンプレートパスが `PKG_DIR` 基準で正しく解決されることを検証する。Issue #142 のバグ修正を確認するためのテスト。

## Test location

- `specs/173-fix-upgrade-exp-skill-path/tests/exp-skill-path.test.js`

## How to run

```bash
node --test specs/173-fix-upgrade-exp-skill-path/tests/exp-skill-path.test.js
```

## Expected results

- `expDir` が `root` ではなく `PKG_DIR` 基準で解決されていること
- experimental テンプレートディレクトリが実在すること
- `upgrade.js` に `PKG_DIR` が import されていること

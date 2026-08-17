# Draft: fix-flow-status-output

## Issues Identified

### Issue 1: flow status output uses markdown format
- `status.js` の `displayStatus()` がマークダウンテーブル (`| Item | Value |`) を出力
- コンソール出力なので罫線・箇条書きで表現すべき
- 合意済みフォーマット: 罫線区切り + インデント付き箇条書き

### Issue 2: No flow.json archive command
- sdd-flow-close SKILL.md Step 8 に「flow.json を spec フォルダに移動」の指示あり
- コードとして実装されていない（AI の行動依存）
- `sdd-forge flow status --archive` を追加して確実に実行可能にする

### Issue 3: Outdated local skill files
- `.claude/skills/sdd-flow-start/SKILL.md` に `current-spec` 参照が残存
- `src/templates/skills/` の最新版では `flow.json` に更新済み
- ローカルスキルファイルを最新版に更新する

### Issue 4: Flow progress tracking missing in local skill
- ローカル SKILL.md に `sdd-forge flow status --step ...` の指示がない
- Issue 3 の修正（最新版への更新）で解消

## Decisions

- コンソール出力は罫線 + インデント形式
- `--archive` コマンドで flow.json を spec ディレクトリに移動 + 削除
- ローカルスキルを `src/templates/skills/` の最新版に同期
- 旧 spec ファイルの `current-spec` 参照は歴史的記録として残す

- [x] User approved this draft (2026-03-13)

# Draft: fix-flow-set-redo-error

**開発種別:** バグ修正（不要コード削除）
**目的:** `flow set redo` 実行時に `entry.command is not a function` でクラッシュするバグを、原因となる redo エントリの削除で解消する

## 背景

`flow set redo` は spec-129 で `issue-log` にリネームされた際、互換メッセージを返す shim として registry に残されていた。しかし shim の実装が `execute` プロパティを使っており、ディスパッチャが期待する `command` プロパティと不整合でクラッシュする。

## Q&A

### Q1: 修正方針 — 互換 shim を修正するか、削除するか？

alpha 版ポリシー「後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する」に従い、redo エントリ自体を削除する。`flow set redo` を呼んでいるコードは `src/` 内に存在しないことを確認済み。

### Q2: スコープ — 他に修正すべき箇所はあるか？

- `set-metric.js` の `VALID_COUNTERS` に `"redo"` があるが、これは `flow set metric <phase> redo` 用のカウンター名であり、`flow set redo` コマンドとは別。修正不要。
- `docs/cli_commands.md` に旧記載が残っているが、今回のスコープ外。
- registry の redo エントリ削除のみ。

### Q3: テスト方針

エントリ削除のみの変更であり、テスト不要と判断。

## 変更対象

| ファイル | 変更内容 |
|---|---|
| `src/flow/registry.js` | `redo` エントリ（L233-236）を削除 |

## 影響範囲

- 既存機能への影響なし（redo は現在クラッシュしており機能していない）
- `flow set issue-log` は影響を受けない
- `flow set metric <phase> redo` は影響を受けない

- [x] User approved this draft

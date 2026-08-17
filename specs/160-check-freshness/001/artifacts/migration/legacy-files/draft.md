# Draft: sdd-forge check freshness

**開発種別:** 機能追加（新規コマンド）
**目的:** `docs/` とソースコードの更新日時を比較し、`sdd-forge build` が必要かどうかを診断する `sdd-forge check freshness` コマンドを実装する。

## 背景

`docs/` は `sdd-forge build` によってソースコードから生成される。ソースコードが更新されたにもかかわらず build が実行されていない場合、docs とソースコードの間に乖離が生じる。

ユーザーが build の実行要否を判断するためには、現在は目視で確認するしかない。このコマンドはその診断を自動化する。

## Q&A

### Q1: 比較対象のファイルは何か？

**A:** ソース側は `SDD_SOURCE_ROOT`（scan 対象ディレクトリ）配下の全ファイル。docs 側は `docs/` 配下の全ファイル（生成物）。比較は各側の「最新 mtime」で行う。

### Q2: analysis.json（`.sdd-forge/output/analysis.json`）を使うか？

**A:** analysis.json の mtime は `sdd-forge scan` の最終実行時刻を示すが、これは build の一部に過ぎない。docs/ ファイルの mtime を直接見る方が「最後に build が完了した時刻」として正確。analysis.json は参考情報として表示してもよいが、判定には使わない。

### Q3: 鮮度判定のロジック

**A:**
- `docs/` が存在しない → `never built`（build が一度も実行されていない）
- `docs/` が存在し、ソースの最新 mtime > docs の最新 mtime → `stale`（build が必要）
- `docs/` が存在し、docs の最新 mtime >= ソースの最新 mtime → `fresh`（最新）

### Q4: 出力フォーマット

**A:** 他の check コマンド（config.js）と同様に `--format text|json` をサポートする。
- text: ステータス文字列（`fresh` / `stale` / `never built`）＋簡易メッセージ
- json: `{ ok, result, srcNewest, docsNewest }` の機械可読出力

### Q5: スコープ外の事項

**A:**
- `--watch` オプション（継続的な監視）は対象外
- scan include パターンによるファイルフィルタリングは対象外（全ファイルを対象とする）
- analysis.json の存在確認は対象外

## 既存機能への影響

- `src/check.js` の `SCRIPTS` マップに `freshness` エントリを追加する
- `src/check/commands/config.js`、`scan.js` への変更なし
- その他のファイルへの影響なし

## 制約

- Node.js 組み込みモジュールのみ使用（`fs`, `path`）
- 過剰な防御コードを書かない
- 他の check コマンドと同じ実装パターンに従う

---

- [x] User approved this draft (autoApprove)
- Date: 2026-04-08

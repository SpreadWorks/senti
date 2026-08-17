# Draft: scan カバレッジレポート

**開発種別:** 新機能（新コマンド追加）
**目的:** `sdd-forge check scan` コマンドを追加し、scan 設定がプロジェクトのどの割合をカバーしているかを2段階で可視化する。プリセット選定の妥当性と DataSource の網羅性を客観的に診断できるようにする。

---

## Q&A

**Q1. カバレッジの定義は？**
A. 2段階で表示する。
- Level 1（include カバレッジ）: src 配下の全ファイル数 vs `scan.include` にマッチしたファイル数（プリセット選定の妥当性評価）
- Level 2（DataSource カバレッジ）: `scan.include` マッチ数 vs DataSource で実際に解析されたファイル数（DataSource の網羅性評価）

**Q2. コマンド形式は？**
A. `sdd-forge check scan` として実装。`sdd-forge check`（引数なし）はグループディスパッチャの骨格を作成。`freshness` / `config` は別 spec（ボード 1ce3 / 60d8）。

**Q3. 出力フォーマットは？**
A. `--format text|json|md`（デフォルト text）。未カバーファイルはデフォルト10件まで表示し、超過時は `--list` フラグを使うよう案内する。text レイアウトは `src/flow/commands/report.js` の `pushSection` / `formatText` パターンと共通化する（共通モジュールに抽出）。

**Q4. 「全ファイル」の除外ルールは？**
A. 既存の `scan.exclude` + デフォルト除外リスト（`node_modules`, `.git`, `dist`, `*.lock` 等）を適用する。

---

## 影響範囲（優先順）

1. **新規: `src/lib/formatter.js`**（`pushSection` / `formatText` 共通モジュール抽出）— 他の変更の前提
2. **更新: `src/flow/commands/report.js`**（共通モジュールを利用するようリファクタ）— formatter 作成後に実施
3. **新規: `src/check.js`**（check ディスパッチャ骨格）
4. **新規: `src/check/commands/scan.js`**（scan カバレッジ実装）— コア機能
5. **更新: `src/sdd-forge.js`**（`check` サブコマンドのルーティング追加）
6. **更新: help テキスト**（i18n locale）

既存の `sdd-forge docs scan` の動作は変更しない。

`src/lib/formatter.js` の抽出について：現時点で `pushSection` / `formatText` パターンを使用しているのは `src/flow/commands/report.js` のみ（`src/lib/log.js`、`src/lib/flow-state.js` は区切り文字を別目的で使用）。波及リスクは低く、`report.js` のリファクタのみで完結する。将来 `check freshness` / `check config` 等も同モジュールを利用する想定。

---

- [x] User approved this draft

**開発種別:** 機能改善（既存コマンドの出力改善）

**目的:** `sdd-forge check scan` の出力をアクション可能な情報に絞り込み、ユーザーが「何をすべきか」を即座に判断できるようにする。

## Q&A

**Q1: 「DataSourceがないもの」として表示したいのはどちら？**
A: 拡張子ごとに「この拡張子を処理するDataSourceが存在しない」というサマリー表示（選択肢2）。サマリーはファイルリストより上に表示する。

**Q2: Level 1 の「件数とカバレッジ率」の表示はどうするか？**
A: 件数・カバレッジ率は残す、ファイルリストだけ削除する（選択肢1）。
→ さらにQ&Aで精査した結果、Include の数値自体も削除する（選択肢1）。
理由: uncoveredリストを削除すると Include の数値はアクション不可能な情報になるため。

**Q3: 出力レイアウトはどうするか？**
A: 以下のレイアウトで合意:
```
  Scan Coverage

  DataSource:  40 / 45 files (89%)

  ── Uncovered by extension ──
  .php  12 files
  .js    3 files

  ── Uncovered files ──
  - src/Foo.php
  - src/Bar.php
```

## 変更内容まとめ

### 削除
- Level 1 (Include Coverage) セクション全体：件数・パーセンテージ・uncoveredリストをすべて削除
- `walkAllFiles` / `allFiles` の計算（Include Coverage 用）も不要になる

### 変更
- DataSource Coverage の数値を先頭に表示
- `--list` フラグは DataSource uncovered のファイルリストに対してのみ適用

### 追加
- DataSource uncovered ファイルを拡張子でグルーピングしたサマリーを表示（ファイルリストより上）
- 拡張子サマリーは `{ ".php": 12, ".js": 3 }` 形式で集計、件数降順でソート

## 実装対象ファイル

- `src/check/commands/scan.js`（主な変更）

## テスト戦略

- `check scan` コマンドの出力フォーマットが変わるため、既存の出力テストがあれば更新
- 拡張子グルーピングロジックの単体テスト（新規）

---

- [x] User approved this draft

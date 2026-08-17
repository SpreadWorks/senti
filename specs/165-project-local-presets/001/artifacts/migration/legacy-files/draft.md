# Draft: project-local-presets

**開発種別:** 機能拡張
**目的:** プロジェクト固有プリセットを統一された探索機構で解決できるようにし、`.sdd-forge/data/` を廃止する

## 背景

現在 `.sdd-forge/data/` がプロジェクト固有 DataSource のみを上書きする中途半端な仕組みとして存在する。
`.sdd-forge/presets/<name>/` を built-in の探索機構に統合することで、DataSource だけでなく templates/ や preset.json も置ける統一されたプロジェクト固有プリセットの仕組みを提供する。

## スコープ

**今回の対象（4ea8 不要）:** プリセット探索・ロード経路の変更のみ。
**スコープ外（4ea8 完了後に対応）:** `.sdd-forge/presets/` 内 DataSource による `sdd-forge` パッケージの import。

## 要件（優先順）

1. **（必須）** `config.type` にプリセット名が指定されている場合、プリセット解決機構は `.sdd-forge/presets/<name>/` を built-in より優先して探索しなければならない。

2. **（必須）** `.sdd-forge/presets/<name>/preset.json` が存在する場合、そのプリセット定義（parent, scan, chapters）を使用しなければならない。

3. **（必須）** `.sdd-forge/presets/<name>/` が存在し `preset.json` が省略された場合:
   - built-in に同名プリセットがあれば、built-in の設定を引き継ぎつつ `data/` のみを上書きしなければならない。
   - built-in に同名がなければ bare プリセット（parent なし、DataSource のみ）として機能しなければならない。

4. **（必須）** `.sdd-forge/presets/<name>/data/` 内の DataSource は、scan フェーズおよび data 解決フェーズの両方でロードされなければならない。

5. **（推奨）** `.sdd-forge/data/` が存在する場合、実行時に警告を出して `.sdd-forge/presets/<type>/data/` への移行を促さなければならない。

6. **（必須）** `.sdd-forge/data/` からの DataSource ロードはこのバージョンで廃止する。ディレクトリが存在しても DataSource としてロードされてはならない。

## 既存機能への影響

- `.sdd-forge/data/` を使っているプロジェクト: 警告で移行を案内。移行先は `.sdd-forge/presets/<type>/data/`
- built-in プリセットの解決: 変更なし（探索の前段に `.sdd-forge/presets/` が追加されるだけ）
- `sdd-forge check config`: `.sdd-forge/presets/` のプリセットも有効として認識する必要あり
- `~/.sdd-forge/presets/`: add3 で実装予定のため今回はスコープ外

## Q&A

**Q1: 前提条件 4ea8 との関係は？**
A: 4ea8（sdd-forge/api 公開エントリポイント）と並列開発中。DataSource の import 解決は 4ea8 に委ねる。今回は探索・ロード経路のみ実装する。

**Q2: `.sdd-forge/presets/<name>/` の優先順位は？**
A: 探索順は `.sdd-forge/presets/<name>/` → `src/presets/<name>/`。`~/.sdd-forge/presets/` は add3 で対応。

**Q3: `preset.json` 省略時の挙動は？**
A: built-in 同名があれば設定を引き継ぎ DataSource のみ上書き。同名がなければ bare プリセットとして機能。

**Q4: `.sdd-forge/data/` の廃止通知はどこに出すか？**
A: コマンド実行時に標準エラーへ警告メッセージを出力する。既存の deprecated 警告と同じ形式・チャネルに合わせる。

---

- [x] User approved this draft

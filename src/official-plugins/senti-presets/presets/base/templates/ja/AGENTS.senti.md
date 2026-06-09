## Spec-Driven Development (Spec-Driven Development)

本プロジェクトは senti による Spec-Driven Development を採用している。

- **MUST: ユーザーから機能追加・修正のリクエストを受けた場合、内容を判定して「直接修正」か「Spec-Driven Development フロー (`/senti.flow`)」のどちらで進めるかを AskUserQuestion で 2 択提示すること。確認なしにコードを変更してはならない。**
  - **直接修正寄り**（typo・コメント・docs 文言・単一ファイル単一行の置換・意味変化のない rename・設定値調整）→「直接修正」を Recommended にする
  - **flow 寄り**（振る舞いを変える修正・複数ファイル横断・テスト/仕様影響・新機能・新 API）→「flow」を Recommended にする
  - **判定が迷う場合は flow を Recommended にする**（review / gate / docs sync の安全弁を default 側に置く）
  - 直接修正を選んだ場合、commit 前に `git diff` を提示してユーザー確認を取ること。docs sync は走らないため、必要なら `senti docs build` を別途案内する
- **MUST: Spec-Driven Development の主経路（計画・実装・最終化）は `/senti.flow` 一つで駆動される。docs 同期のみを行う場合は `/senti.flow-sync` を使用する。Spec-Driven Development フロー経路を選んだ場合、実装完了後に finalize まで到達させること。**
- スキルが利用できない環境では `senti flow --request "<要望>"` を使用すること

### Worktree の境界を越えない（MUST）

`flow prepare --worktree` で作成した worktree で作業している間、以下を厳守する:

- **MUST: worktree パス外に `cd` してはならない。** 唯一の正当な離脱は `senti flow run finalize` の cleanup 完了後（finalize skill がその遷移を明示的に案内する）のみ。
- **MUST: active flow 中に main リポジトリで `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` を実行してはならない。** 別ブランチ由来の stale な stash が復元されてコンフリクトを引き起こすなど、共有状態を破壊するリスクがある。
- **ベースライン比較（base branch でのテスト結果比較など）が必要な場合は main に戻らず、短命の detached worktree (`git worktree add --detach <tmp> <baseBranch>` → 計測 → `git worktree remove <tmp>`) を使う。** もしくは既存の `issue-log.json` の evidence を再利用する。

### docs/ について

`docs/` はプロジェクトの設計・構造・ビジネスロジックを体系的にまとめた知識ベースである。
実装・修正時は docs を読んでプロジェクトの全体像を理解した上で作業すること。

**docs とソースコードに矛盾がある場合はソースコードを正とする。**

作業開始前に docs/ とソースコードの更新日時を比較すること。
ソースが新しい場合は `senti build` の実行をユーザーに提案すること。

### 開発ワークフロー

- `src/skills/`, `src/presets/`, `src/official-plugins/` のスキル・プリセット・テンプレートを変更した場合は `senti upgrade` を実行して、プロジェクトのスキル・設定・公式 plugin 有効化に反映すること。
- `src/official-plugins/` は npm package に同梱する互換用 copy であり、公式 plugin repository migration の完了証跡ではない。公式 plugin 移行は実 repository の clean な Git HEAD と contribution path で検証すること。

### docs/ 編集ルール

- docs/ は原則としてソースコード解析から自動生成される
- `{{data}}` / `{{text}}` ディレクティブの内部は自動生成で上書きされる
- ディレクティブの外に記述した内容は上書きされない
- 章の並び順は `preset.json` の `chapters` 配列で定義される

## Senrail Flow

本プロジェクトは senrail による Spec-Driven Development を採用している。

- **MUST: Spec-Driven Development flow は、ユーザーが明示的に開始を指示した場合のみ開始する。** 通常の機能追加・修正・コード変更・調査・相談では、flow 起動確認・flow 利用提案・「直接修正か flow か」の選択肢提示を自動表示せず、通常対応すること。
  - flow の利用提案や選択肢提示は、ユーザーが flow 開始・flow 利用検討・選択肢提示を明示した場合に限る。依頼内容から有用性を推測して提案しない。
  - ユーザーが flow 開始を明示した場合は、計画・実装・最終化まで主経路を進める。
- **MUST: docs 同期のみを行う場合は専用の flow-sync skill を使用する。**
- スキルが利用できない環境では、`senrail flow set init --request "<要望>"` で preparing flow を作成すること。返却された runId を以後の `senrail flow prepare ... --run-id <runId>` と `senrail flow run dispatch --expect-run-id <runId>` に必ず指定し、詳細は各コマンドの `--help` を参照すること。

### Worktree の境界を越えない（MUST）

`flow prepare --worktree` で作成した worktree で作業している間、以下を厳守する:

- **MUST: worktree パス外に `cd` してはならない。** 唯一の正当な離脱は `senrail flow run finalize-cleanup` の cleanup 完了後（finalize skill がその遷移を明示的に案内する）のみ。
- **MUST: active flow 中に main リポジトリで `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` を実行してはならない。** 別ブランチ由来の stale な stash が復元されてコンフリクトを引き起こすなど、共有状態を破壊するリスクがある。
- **ベースライン比較（base branch でのテスト結果比較など）が必要な場合は main に戻らず、短命の detached worktree (`git worktree add --detach <tmp> <baseBranch>` → 計測 → `git worktree remove <tmp>`) を使う。** もしくは既存の `issue-log.json` の evidence を再利用する。

### docs/ について

`docs/` はプロジェクトの設計・構造・ビジネスロジックを体系的にまとめた知識ベースである。
実装・修正時は docs を読んでプロジェクトの全体像を理解した上で作業すること。

**docs とソースコードに矛盾がある場合はソースコードを正とする。**

作業開始前に `senrail check freshness` を実行すること。
結果が `stale` または `never-built` の場合は、`senrail docs build` の実行をユーザーに提案すること。`indeterminate` の場合は制限内容を伝え、docs が最新であるとは扱わないこと。

### 開発ワークフロー

- `src/skills/` または `src/presets/` のスキル・プリセット成果物を変更した場合は `senrail upgrade` を実行して、プロジェクトのスキル、AGENTS/CLAUDE の SDD セクション、および preset copy を更新すること。
- docs 用テンプレートの変更を生成済み docs に反映する場合は `senrail docs build` を実行すること。
- 公式 preset migration は実 plugin repository の clean な Git HEAD と contribution path で検証すること。

### docs/ 編集ルール

- docs/ は原則としてソースコード解析から自動生成される
- `{{data}}` / `{{text}}` ディレクティブの内部は自動生成で上書きされる
- ディレクティブの外に記述した内容は上書きされない
- 章の並び順は `preset.json` の `chapters` 配列で定義される

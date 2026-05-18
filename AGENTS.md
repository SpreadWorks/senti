# sdd-forge

ソースコード解析に基づくドキュメント自動生成と、Spec-Driven Development ワークフローを提供する CLI ツール。

## タスク管理

ボード操作は skill `sdd-forge.exp.workflow` を使うこと。

## プロジェクトルール

### 開発ワークフロー

- `src/templates/` や `src/presets/` のテンプレートを変更した場合は `sdd-forge upgrade` を実行して、プロジェクトのスキル・設定に反映すること。
- `sdd-forge upgrade` はスキル（`.claude/skills/`, `.agents/skills/`）やテンプレートの差分を検出し、変更があったファイルのみ更新する。

### コーディング

- **外部依存なし**: Node.js 組み込みモジュールのみ使用。依存追加は禁止。
- **alpha 版ポリシー**: 後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する。
- 過剰な防御コードを書かない。内部インターフェースは信頼し、バリデーションはシステム境界でのみ行う。
- **OOP による型表現**: TypeScript を採用しない方針のため、値の構造的制約はクラス設計で表現すること。意味のある値（テーブル、レンダリング可能な断片、解析エントリ等）はオブジェクトリテラルや `{ type: "..." }` 形式の discriminated union もどきではなく、専用クラスとして定義する。クラスはコンストラクタで invariant を強制し、振る舞い（`toMarkdown()` 等）を型自身に所属させる。これにより `instanceof` による確実な型判別、Open/Closed 原則に従った拡張、IDE 補完が得られる。

### コード品質の維持

- 実装時に既存コードと同じパターンが2箇所以上で繰り返される場合、共通ヘルパーに抽出すること。3回目の出現を待つ必要はない。
- 新しいコードは既存のコードパターン・命名規約・モジュール構造に合わせること。既存パターンから逸脱する場合はその理由を明記すること。
- spec のスコープ外であっても、変更したファイル内の明らかな一貫性の問題（同一ファイル内で命名が混在している等）は修正してよい。
- 「シンプルなインターフェースに十分な実装を隠す」モジュール設計を優先すること。薄いラッパーより深いモジュールを作る。

### `src/` の禁止事項

- **MUST: `src/` 以下のファイルには、特定のプロジェクトや環境に固有の情報を含めてはならない。** `src/` は npm パッケージとして全ユーザーに配布されるコードである。
- `{{text}}` プロンプト: 汎用的な指示にすること。具体的なフィールド名を列挙しない。
- 固定テキスト: プロジェクト固有の値を直接書かない。`{{data}}` または `{{text}}` で動的に取得する。
- DataSource / ライブラリ: 特定プロジェクトの構造を前提としたロジックを書かない。

### テスト

- **MUST: テストを通すためにテストコードを修正してはならない。** テスト失敗時はまずシナリオの妥当性を確認し、妥当であればプロダクトコードを修正する。
- **AI 実行を伴うテスト**: 実 `claude` CLI を呼ぶテストは `tests/agent/` 配下に集約されている。`npm test` のデフォルト実行からは除外されるため、`src/lib/agent.js`, `src/docs/commands/enrich.js`, `src/docs/commands/text.js` など AI コマンド関連を変更した場合は `npm run test:agent` を実行して回帰検知すること。CI 等でフル検証が必要な場合は `npm run test:all`。

### コマンド実行

- **MUST: 必要な場合を除き、`/bin/bash -lc "<command>"` 形式でコマンドを実行してはならない。** `git status --short` や `sed -n '1,120p' AGENTS.md` のように、実行したいコマンドをそのまま指定すること。作業ディレクトリの指定、承認 prefix の一致、単なる習慣を理由に `/bin/bash -lc` を使わない。
- `/bin/bash -lc` を使ってよいのは、Bash 固有の構文・サブシェル・複雑なクォート処理など、通常の直接実行では表現できない場合に限る。使う場合は、Bash が必要な理由を理解し、コマンド列を最小化すること。

### コマンド実行結果の確認

- **MUST: 長時間かかるコマンド（テスト実行等）の結果を確認する場合、出力をファイルにリダイレクトしてから読むこと。** `command > /tmp/output.log 2>&1` で保存し、`grep` や `Read` で必要な箇所を確認する。同じコマンドを再実行して出力をパイプで絞り込む方法は、不要な再実行コストが発生するため禁止。

### コミット

- **MUST: コミットメッセージは英語で書くこと。**
- sign-off 行や co-authored-by トレーラーを付けないこと。

### バージョニング（alpha 期間）

- alpha 期間中のバージョン番号は `0.1.0-alpha.N` 形式。N は `git rev-list --count HEAD` の値（総コミット数）とする。

### npm 公開
- **MUST: `npm publish` / `npm dist-tag` はユーザーがリリースの意図を明示した場合のみ実行する。** バージョン上げ・コミット・push の指示はリリース指示ではない。
- pre-release は `npm publish --tag alpha` → `npm dist-tag add sdd-forge@<version> latest` の 2 ステップ。
- 公開前に `npm pack --dry-run` で機密情報がないことを確認する。

## ソースコード（src/）

`src/` のアーキテクチャ・プリセット作成ルール・コーディングルールは `src/AGENTS.md` を参照すること。

<!-- {{data("agents.sdd")}} -->
## SDD (Spec-Driven Development)

本プロジェクトは sdd-forge による Spec-Driven Development を採用している。

- **MUST: ユーザーから機能追加・修正のリクエストを受けた場合、SDD フロー (`/sdd-forge.flow`) を使用するかユーザーに確認すること。確認なしにコードを変更してはならない。**
- **MUST: 実装完了後は `/sdd-forge.flow` で finalize まで進めること。**
- スキルが利用できない環境では `sdd-forge flow --request "<要望>"` を使用すること

### Worktree の境界を越えない（MUST）

`flow prepare --worktree` で作成した worktree で作業している間、以下を厳守する:

- **MUST: worktree パス外に `cd` してはならない。** 唯一の正当な離脱は `sdd-forge flow run finalize` の cleanup 完了後（finalize skill がその遷移を明示的に案内する）のみ。
- **MUST: active flow 中に main リポジトリで `git stash` / `git stash pop` / `git stash apply` / `git reset --hard` / `git checkout -- <path>` を実行してはならない。** 別ブランチ由来の stale な stash が復元されてコンフリクトを引き起こすなど、共有状態を破壊するリスクがある。
- **ベースライン比較（base branch でのテスト結果比較など）が必要な場合は main に戻らず、短命の detached worktree (`git worktree add --detach <tmp> <baseBranch>` → 計測 → `git worktree remove <tmp>`) を使う。** もしくは既存の `issue-log.json` の evidence を再利用する。

### docs/ について

`docs/` はプロジェクトの設計・構造・ビジネスロジックを体系的にまとめた知識ベースである。
実装・修正時は docs を読んでプロジェクトの全体像を理解した上で作業すること。

**docs とソースコードに矛盾がある場合はソースコードを正とする。**

作業開始前に docs/ とソースコードの更新日時を比較すること。
ソースが新しい場合は `sdd-forge build` の実行をユーザーに提案すること。

### 開発ワークフロー

- `src/templates/` や `src/presets/` 等のテンプレートを変更した場合は `sdd-forge upgrade` を実行して、プロジェクトのスキル・設定に反映すること。

### docs/ 編集ルール

- docs/ は原則としてソースコード解析から自動生成される
- `{{data}}` / `{{text}}` ディレクティブの内部は自動生成で上書きされる
- ディレクティブの外に記述した内容は上書きされない
- 章の並び順は `preset.json` の `chapters` 配列で定義される
<!-- {{/data}} -->

<!-- {{data("agents.project")}} -->
<!-- {{/data}} -->

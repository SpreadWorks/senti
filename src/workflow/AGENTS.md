# workflow (`sdd-forge workflow`)

このディレクトリは `sdd-forge workflow <subcommand>` コマンドの実装である。GitHub Projects ボードのドラフト管理と issue 化を提供する。

## [EXPERIMENTAL]

`sdd-forge workflow` は **experimental** である。実装は安定しているが、運用方法論（methodology）が未確定であり、usage patterns may change（使い方は今後変わる可能性がある）。

- 実装の安定性: サブコマンド（`add` / `update` / `show` / `search` / `list` / `publish`）の振る舞いは安定している。
- 未確定なのは「運用方法論」: ボードに何を載せるか、Ideas ステータスからの繰り上げ昇格判断、published issue との突き合わせ等の運用ルール。

experimental ラベルは `sdd-forge workflow --help` の冒頭と top-level `sdd-forge help` に表示される。

## アーキテクチャ

- `index.js` — ディスパッチャ。config を読み、registry でサブコマンドを解決し、コマンドクラスの `execute(ctx)` を呼ぶ。出力は JSON envelope。
- `registry.js` — サブコマンドのメタデータ（command / help / args）。
- `lib/` — 共有ロジック（config, graphql, board-helpers, hash, validation, category, base-command）。
- `lib/commands/` — 各サブコマンドの実装クラス。

config キーは `workflow.languages.{source,publish}`（省略時は `config.lang`）。有効化ゲートは持たない（常時利用可能）。

## Graduation Criteria（experimental ラベルを外せる条件）

以下を **すべて** 満たしたとき、experimental ラベルを外すことを検討する:

1. **methodology の文書化** — 運用方法論（Ideas からの繰り上げ昇格、ボードの章立て、published issue との突き合わせ）が docs / skill に再現可能な手順として明文化されている。
2. **契約の固定** — サブコマンド名・フィールド名・status enum の契約に未確定箇所がない（status enum を含む）。
3. **安定した利用パターン** — ideas からの publish フロー（ideas → publish）が skill に手順化され、サブコマンド契約を変えずに実行できる状態が継続している。
4. **breaking change なし** — 既存ユーザー向けに breaking change を伴わない API になっている。

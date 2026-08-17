# Feature Specification: 215-remove-merge-strategy-arg

**Feature Branch**: `feature/215-remove-merge-strategy-arg`
**Created**: 2026-04-22
**Status**: Draft
**Input**: GitHub Issue #223

## Goal
`sdd-forge flow run finalize` の `--merge-strategy` 引数を廃止し、merge 戦略の決定権を config (`commands.gh`) のみに一本化する。CLI 引数で config の意図をバイパスできる経路を完全に閉じ、Issue #220 で発生した「意図しない PR 作成事故」の再発を防ぐ。

## Background
- Issue #223 の提起: finalize の `--merge-strategy pr|squash|auto` 引数は、config ベースの判定ルール（`commands.gh === "enable"` AND `gh` 利用可能のみ PR ルート）を引数で上書きできるエスケープハッチになっていた。
- Issue #220 の実装（PR #221）で、AI エージェントが `--merge-strategy pr` を明示指定したことにより、`commands.gh` が未設定のプロジェクトで意図しない PR が作成された。config ベースの guard は存在したが、明示引数で無効化された。
- 設計原則: 「ルールであるならコードで強制する」「エスケープハッチはルールを無効化する」。memory（AI の記憶）に期待する運用では再発を防げないため、CLI 側で静的に保証する。

## Scope
- `sdd-forge flow run finalize` の CLI 引数仕様から旧 merge 戦略指定引数を削除する
- merge 戦略決定ロジックを config (`commands.gh`) 単独ベースに変更する
- スキル（配布テンプレート）と内部プロンプトの呼び出し例から旧引数への言及を削除する
- 関連ユニットテストを新仕様に合わせて更新する

## Out of Scope
- フロー状態ファイル上の戦略記録フィールド自体の削除（後続 sync ステップが参照するため保持）
- `config.commands.gh` のスキーマ変更、新しい config キー追加
- 自動生成される docs 配下のドキュメント更新（`sdd-forge build` で反映される）
- 過去 spec（specs/081, 100, 104, 170 等）の遡及修正

## Constraints
- CLAUDE.md alpha 版ポリシー: 後方互換コードを書かない。旧フォーマット・非推奨パスは保持せず削除する。
- CLAUDE.md コーディングルール: 外部依存なし。内部インターフェースは信頼し、過剰な防御コードを書かない。
- `src/` 以下にプロジェクト固有の情報を含めない。

## Design Principles
- **Config is the single source of truth for merge strategy.** CLI 引数やユーザー対話はこれを上書きしない。
- **Silent no-op より即エラー.** 旧引数はそもそも受け付けずに unknown option で落とす（CLI argparser のデフォルト挙動に委ねる）。
- **死にコードを残さない.** 旧引数専用の enum 定数と唯一のバリデーション参照を同時に削除する。

## Overview
### Modules
- finalize コマンド実行層（引数定義、入力バリデーション、戦略ディスパッチ）
- merge 実行層（戦略決定、squash / PR ルート分岐）
- フロー状態書き込み層（解決後戦略の記録）
- スキル・プロンプト層（ユーザー向け呼び出し例とステップ案内）
- 定数層（CLI 入力バリデーション専用の enum）

### Data Flow
1. ユーザー: `sdd-forge flow run finalize --mode all` を実行（旧引数なし）。
2. finalize: merge ステップが有効なら merge 実行層を呼び出す。戦略選択の入力は受け取らない。
3. merge 実行層: `config.commands.gh` と `gh` 可用性のみを見て PR か squash かを判定。
4. merge 実行層: 実行戦略をフロー状態ファイルに記録。
5. 後続 sync ステップ: 記録された戦略値を読み、PR ルート時はスキップする。

### Decisions
- 旧引数は削除する。deprecation 警告を経由しない（alpha 版ポリシー）。
- 戦略選択ユーザー対話は完全に廃止する。
- 戦略記録フィールドは保持する（sync が参照するため）。
- 旧引数 enum 用定数は削除する（死にコード化するため）。

## Clarifications
- Q: 旧引数で CI を運用していたユーザーへの影響は？
  - A: 即エラーで CI が落ちる。alpha 版ポリシーの通り後方互換は保持しない。リリースノートで告知。
- Q: フロー状態の戦略記録フィールドは削除しないのか？
  - A: 後続 sync ステップが参照している。戦略決定ロジックと戦略記録は別責務のため、本 spec のスコープは決定ロジックのみに限定。
- Q: 戦略選択ユーザー対話を残す選択肢は？
  - A: 対話自体が config バイパス経路を正当化していた。「ルールであるならコードで強制する」原則に矛盾するため廃止。
- Q: enum 定数を残す価値は？
  - A: CLI 入力バリデーション以外の参照がない。残すと死にコードになるため削除する。

## Migration Plan

対象ユーザー: これまで旧 `--merge-strategy pr` 引数で PR ルートを明示していたユーザー、および CI スクリプトでこの引数を埋め込んでいたプロジェクト。

移行手順:
1. プロジェクト config の `commands.gh` を `"enable"` に設定する（PR ルートを使いたい場合）。
2. `gh` コマンドをインストールし、`gh auth status` で認証済みであることを確認する。
3. CI スクリプト・ローカル運用スクリプトから `--merge-strategy` の指定を削除する。
4. sdd-forge を `sdd-forge upgrade` でアップデートし、スキル側の呼び出し例も新仕様に揃える。

非互換の明示:
- alpha 版ポリシーにより後方互換は保持しない。旧引数は警告ではなく即エラー（非ゼロ exit code）となる。
- スキル側の呼び出し例からも完全に消える。
- deprecation フェーズは設けない。

リリースノート候補:
> `sdd-forge flow run finalize` の `--merge-strategy` 引数は削除されました。merge 戦略は `config.commands.gh` のみで決定されます。PR ルートを利用するには `commands.gh: "enable"` を設定し、`gh` コマンドを利用可能にしてください。

## Alternatives Considered
- **Deprecation 警告で段階移行**: alpha 版ポリシーに反する。旧フォーマット・非推奨パスは保持せず削除する方針。即エラーの方が運用事故の告知として機能する。
- **引数を受け付けつつ config を優先させる**: 結局 config 以外の入力源が残ると「なぜ無視されるのか」の混乱を招く。未知オプションとして即エラーにする方がルールが明瞭。
- **戦略選択の対話プロンプトを残す**: config バイパス経路を正当化するため、設計原則と矛盾する。廃止が一貫。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-22
- Notes: auto-check eligible (score 20/24), autoApprove mode enabled by user.

## Requirements

### [P1] must

- **R1**: finalize コマンドはユーザーから merge 戦略を指定する CLI 引数を受け付けないこと。
  - When: ユーザーが finalize コマンドに従来の merge 戦略指定引数を付けて実行する。
  - Shall: 未知オプションとしてエラー終了し、非ゼロ exit code を返す。
- **R2**: merge 戦略は config と `gh` コマンド可用性のみで決定されること。
  - When: finalize の merge 処理が開始される。
  - Shall: config が PR 運用を有効化していて かつ `gh` コマンドが実行可能な場合のみ PR ルートを選ぶ。それ以外は squash merge ルートを選ぶ。
- **R3**: finalize 実行フロー内に「merge 戦略をユーザーに選ばせる対話」が存在しないこと。
  - When: ユーザーが finalize の merge ステップを含む実行を開始する。
  - Shall: 戦略選択の対話プロンプトは表示されず、R2 の決定ロジックのみで進行する。

### [P2] should

- **R4**: finalize 完了時に、解決された戦略値を後続ステップから参照可能な状態で永続化すること。
  - When: merge ステップが成功で終了する。
  - Shall: 解決結果（`"squash"` または `"pr"`）をフロー状態に記録し、後続の sync ステップがその値を参照できるようにする。
- **R5**: ユーザー配布物であるスキル・プロンプトの呼び出し例から、旧 merge 戦略指定引数への言及が消えていること。
  - When: ユーザーが `sdd-forge upgrade` でスキルを更新する。
  - Shall: 更新後のスキル・プロンプト文書に旧引数の記述がひとつも残らない。

### [P3] could

- **R6**: 旧 CLI 引数 enum 専用に存在していた内部定数と、その唯一の参照 import を同時に削除すること。
  - When: 本 spec の実装完了時。
  - Shall: 定数定義と import 参照がコードベースから見つからない状態になる。

## Acceptance Criteria

1. `sdd-forge flow run finalize --merge-strategy pr` を実行すると unknown option エラーで非ゼロ exit code を返す。
2. `config.commands.gh !== "enable"` のプロジェクトで `sdd-forge flow run finalize` を実行しても PR が作成されず、常に squash merge ルートが選ばれる。
3. `config.commands.gh === "enable"` かつ `gh` 利用可能のプロジェクトで `sdd-forge flow run finalize` を実行すると PR ルートが選ばれる。
4. finalize の select モードで merge ステップを選んでも、戦略選択の対話プロンプト（旧 `finalize.merge-strategy` prompt 等）は出現しない。
5. `sdd-forge upgrade` 後のスキル・プロンプト文書から旧引数の文字列が grep で 0 件になる。
6. `grep -rn "VALID_MERGE_STRATEGIES" src/` が 0 件になる（R6）。
7. `npm test` の既存テストが全 PASS する。`--merge-strategy` 関連のユニットテストは新仕様に追従している。

## Implementation Targets

- `src/flow/registry.js` — finalize コマンドの `options` / `help` から旧引数の記述を削除
- `src/flow/lib/run-finalize.js` — 旧引数入力の読み取り・バリデーション・デフォルト解決を削除、下位層への受け渡しを削除
- `src/flow/commands/merge.js` — `runMerge` の `mergeStrategy` パラメータを削除し、戦略決定を config のみに簡素化
- `src/flow/lib/get-prompt.js` — `finalize.merge-strategy` prompt 定義（ja / en）を削除
- `src/flow/prompts/impl/finalize.md` — 旧引数を含む案内記述を削除
- `src/templates/skills/sdd-forge.flow/SKILL.md` — finalize 呼び出し例から旧引数を削除
- `src/lib/constants.js` — `VALID_MERGE_STRATEGIES` 定数を削除
- `tests/unit/flow/get-prompt.test.js` — `finalize.merge-strategy` 参照テストを削除または新仕様に追従

## Open Questions
- なし

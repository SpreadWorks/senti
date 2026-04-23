# Draft: 215-remove-merge-strategy-arg

**開発種別:** refactor
**目的:** `sdd-forge flow run finalize` の `--merge-strategy` 引数を廃止し、merge 戦略の決定権を config (`commands.gh`) のみに一本化する。CLI 引数による config バイパスを不可能にすることで、Issue #220 で発生した「意図しない PR 作成事故」の再発を防ぐ。

## Requirements (prioritized)

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
  - Shall: 解決結果（squash または PR）をフロー状態に記録し、後続の sync ステップがその値を参照できるようにする。
- **R5**: ユーザー配布物であるスキル・プロンプトの呼び出し例から、旧 merge 戦略指定引数への言及が消えていること。
  - When: ユーザーが `sdd-forge upgrade` でスキルを更新する。
  - Shall: 更新後のスキル・プロンプト文書に旧引数の記述がひとつも残らない。

### [P3] could

- **R6**: 旧 CLI 引数 enum 専用に存在していた内部定数と、その唯一の参照 import を同時に削除すること。
  - When: 本 spec の実装完了時。
  - Shall: 定数定義と import 参照がコードベースから見つからない状態になる。

## Scope Verification

- In scope:
  - `sdd-forge flow run finalize` の CLI 引数仕様変更
  - merge 戦略決定ロジックの config 一本化
  - スキル（配布テンプレート）と内部プロンプトの追従
  - 関連ユニットテストの更新
- Out of scope:
  - フロー状態ファイル上の戦略記録フィールド自体の削除（R4 のため保持）
  - config スキーマ変更・新キー追加
  - 自動生成される docs 配下のドキュメント更新（`sdd-forge build` で反映）
  - 過去 spec の遡及修正

## Impact on Existing Features

- 影響あり:
  - finalize を旧引数付きで呼び出していた運用はすべてエラーになる。
  - skill の finalize 対話から「戦略選択」のステップが消える。
  - PR ルートを使える条件が「config で有効化 AND gh 利用可能」のみに厳格化される（旧引数による片方バイパスが不可能になる）。
- 影響なし:
  - squash route と PR route それぞれの実マージ実装（rebase・conflict 処理・PR 本文組み立て等）。
  - finalize の step 構成（commit / merge / sync / cleanup 等の並びとステップ番号）。
  - フロー状態ファイルへの戦略記録と、sync からの参照動作。

## Migration Plan

対象ユーザー: これまで旧 `--merge-strategy pr` 引数で PR ルートを明示していたユーザー、および CI スクリプトでこの引数を埋め込んでいたプロジェクト。

- 移行手順:
  1. プロジェクト config の `commands.gh` を有効化する（PR ルートを使いたい場合）。
  2. `gh` コマンドをインストール・認証する。
  3. CI スクリプトから旧引数の指定を削除する。
- 非互換の明示:
  - alpha 版ポリシーにより後方互換は保持しない。旧引数は警告ではなく即エラーとなる。
  - スキル側の呼び出し例からも完全に消える。
- リリースノート候補:
  > finalize コマンドの merge 戦略指定引数は廃止されました。戦略は config のみで決定されます。PR ルートを利用するには config で PR 運用を有効化し、`gh` コマンドを利用可能にしてください。

## Q&A

- Q: 旧引数を付けて既存 CI が走っている場合の影響は？
  - A: 即エラーで CI が落ちる。これは CLAUDE.md の alpha 版ポリシー（「後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する」）に基づく意図された挙動であり、Issue #223 本文の設計原則「エスケープハッチはルールを無効化する」と一致する。
- Q: フロー状態の戦略記録フィールドも同時に削除しないのはなぜ？
  - A: 既存の sync ステップが PR ルート時のスキップ判定にこの記録値を参照している。戦略決定ロジックと戦略記録は別責務であり、本 spec のスコープは決定ロジックのみに限定する。
- Q: skill の戦略選択対話をなくすと、ユーザーに選択肢を提示する機会を失わないか？
  - A: Issue #223 本文「エスケープハッチはルールを無効化する」の通り、対話自体が config バイパス経路を正当化していた。config を正とするのが設計原則（「ルールであるならコードで強制する」）であり、対話を残すほうが矛盾する。
- Q: 内部の enum 定数を残す価値は？
  - A: CLAUDE.md / src/AGENTS.md の「過剰な防御コードを書かない」「内部インターフェースは信頼する」に従う。唯一の参照だった CLI 入力バリデーションが消えるため、残すと死にコードになる。

## Open Questions
- なし

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-22
- Notes: auto-check eligible (score 20/24), autoApprove mode enabled by user.

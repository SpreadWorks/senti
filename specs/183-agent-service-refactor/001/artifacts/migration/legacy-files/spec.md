# Feature Specification: 183-agent-service-refactor

**Feature Branch**: `feature/183-agent-service-refactor`
**Created**: 2026-04-17
**Status**: Approved
**Input**: GitHub Issue #158（1877/Phase2A: Agent Service Refactor）

## Goal

AI エージェント呼び出し基盤を、Container 配下の単一サービスへ再設計する。呼び出し側引数を縮小し、作業ディレクトリ受け渡しを自動化し、同期呼び出し経路を廃止し、argv 閾値を設定化する。provider 別のドメイン知識（出力パース・JSON 出力フラグ・systemPrompt 受け渡し方法・workDir フラグ・builtin profile 一覧）を provider ごとの単一定義箇所に集約し、新 provider 追加時の変更コストを単一定義の追加に抑える。

## Scope

Issue #158 記載 7 タスクおよび関連ボード `227f`（子プロセス起動方式の統一）を本 spec で実施する。

- provider 別ドメイン知識の集約構造の導入
- サービス経由のエージェント解決・呼び出し API への統合
- 呼び出し側のタイムアウト・作業ディレクトリ引数の廃止と内部解決化
- 作業ディレクトリ受け渡しの自動化（provider 宣言 + サービス自動付与）
- argv サイズ閾値の設定キー化
- 同期呼び出し経路の廃止と非同期呼び出しへの統一
- 全呼び出し元の新サービス経由への書き換えと旧公開関数の削除
- provider 抽象とサービスの単体テストの追加

## Impact on Existing Features

- **既存機能（CLI 利用者から見た挙動）**: 変更なし。docs パイプライン（scan/enrich/text/readme/agents/translate/forge/init/review）および flow 系コマンドの出力・引数・終了コードは不変。
- **既存呼び出し元コード**: 内部の AI エージェント呼び出し API が刷新されるため、全呼び出し元（内部のみ）が新サービス経由に書き換わる。直接 import の旧公開関数は削除される。
- **設定**: argv サイズ閾値の新規キーが追加される（省略時の既定値 100000 bytes）。既存の AI 関連設定キー（`agent.default`, `agent.providers`, `agent.profiles`, `agent.useProfile`, `agent.timeout`, `agent.workDir` 等）の意味とフォーマットは据え置き。
- **既存テスト**: agent 周りのユニットテストは新サービス経由に追従させる。テストシナリオは保持し、API 呼び出し方のみ変更する。
- **CLI コマンド/オプション**: 変更なし。
- **公開 npm パッケージ API**: 当該基盤は `src/api.js` から公開されておらず、外部利用者への影響はない。

## Pre-existing patterns explicitly out of scope

以下は本 spec の対象範囲外であり、既存の実装パターンを継承する:

- **同期ファイル I/O**: `fs.readFileSync` / `fs.writeFileSync` を含む同期 I/O はプロジェクト全体で広く使われている既存パターン。本 spec はエージェント呼び出し基盤の async 化に焦点を当てており、ファイル I/O の async 化は対象外。
- **CLI 入力バリデーション**: `parseArgs` による型整合は実施しているが、明示的な値域チェック等の追加バリデーションは既存パターンを踏襲する。本 spec で新たに追加する CLI 入口は無い。
- **Logger.agent のペイロード**: prompt/response 全文の記録は既存の Logger 契約。本 spec はサービス側の呼び出し統一のみで、Logger 公開 API は据え置き（Out of Scope に明記済み）。

## Out of Scope

- AI エージェント呼び出しの並列実行制御（本 spec 範囲外）。
- ロガー（`Logger.agent`）のインターフェース変更。サービスからの呼び出し経路は変更するが、Logger 公開 API は据え置き。
- リトライ戦略の根本変更。既存の `retryCount` / `retryDelayMs` 相当の動作を新サービスに移植するに留める。
- ストリーミング出力（`onStdout` / `onStderr`）のセマンティクス変更。新サービスの呼び出しオプションとして引き続き提供する。
- 設定スキーマドキュメント（docs/）の自動生成更新。docs パイプラインによる更新は別 spec で扱う。

## Clarifications (Q&A)

- Q: 7 タスクと関連ボード 227f を 1 つの spec に含めて良いか？
  - A: 含める。すべて「エージェント呼び出し基盤のサービス化」という単一関心事の構成要素。

- Q: 旧公開関数を deprecated として残す移行期間を設けるか？
  - A: 設けない。alpha 期で内部 API のみのため、本 spec 内で全呼び出し元を一括書き換えして旧 API を削除する。

- Q: サービスの公開先は？
  - A: Container 配下の共有サービスとして公開し、呼び出し元はサービス経由でのみアクセスする。

- Q: provider 別ドメイン知識の集約単位は？
  - A: provider ごとの単一定義箇所に集約する。出力パース・JSON 出力フラグ・systemPrompt 受け渡し方法・workDir フラグ・builtin profile 一覧を全て provider 単位でまとめる。

- Q: 作業ディレクトリ受け渡しの方式は？
  - A: provider 自身が「workDir 受け渡しに使う CLI フラグ名」を宣言し、サービス側が設定解決済みの作業ディレクトリを当該フラグ値として自動付与する。

- Q: argv 閾値の既定値は？
  - A: 100000 bytes。設定で上書き可能。

- Q: タイムアウトと作業ディレクトリの解決元は？
  - A: 設定およびプロジェクトコンテキストから内部解決する。呼び出し元はそれらを引数として渡せない。

## Alternatives Considered

- **旧公開関数を deprecated として残す**: 互換シムを維持する案。却下理由: alpha 版ポリシーが後方互換コードの保持を禁止。呼び出し元が内部のみで grep 可能なので一括移行コストは限定的。
- **provider 別データを横断辞書のまま、参照側だけクラス化**: パーサ・profile・JSON フラグを既存の平坦辞書に保ち、サービスのみクラス化する案。却下理由: Issue 指摘 22 が要求する「parse/usage/capability の凝集」を満たさず、新 provider 追加時に複数辞書を横断更新する課題が残る。
- **同期呼び出し経路を選択肢として残す**: 呼び出し元の都合に応じて同期/非同期を選べるようにする案。却下理由: 関連ボード 227f の hang リスクを温存する。alpha 期に二重実装を維持する利益がない。

## Why This Approach

- **alpha 期に互換性負債を持ち込まない**: 内部 API のみの基盤を一括移行し、旧公開関数を削除することで、後続 spec が常に新サービス前提で議論できる。
- **provider 単位のドメイン凝集**: provider 別の出力パース・フラグ・profile を 1 箇所にまとめることで、新 provider 追加が単一定義の追加で完結する（Open/Closed）。
- **設定駆動の作業ディレクトリ単一情報源**: provider 設定側のハードコード値を排除し、設定解決済みの作業ディレクトリを唯一の情報源とすることで、`SDD_FORGE_WORK_DIR` env や `config.agent.workDir` の挙動を一貫させる。
- **非同期統一による hang リスク解消**: 子プロセス起動方式を統一することで、同期/非同期の混在に起因する stdin EOF 待ち hang を構造的に防ぐ。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-17
- Notes: autoApprove mode による承認。draft の Q&A 7 件と spec gate PASS を経て本承認。
  本 spec の移行方針として、旧 API（`callAgent` / `callAgentAsync` / `callAgentWithLog` / `callAgentAwaitLog` / `callAgentAsyncWithLog` / `resolveAgent` / `loadAgentConfig` / `ensureAgentWorkDir` / `BUILTIN_PROVIDERS` / `DEFAULT_AGENT_TIMEOUT_MS`）に直接結合した既存テストの移植・統合・削除を明示的に承認する:
  - `tests/unit/lib/agent.test.js` を新 Agent クラス契約に書き換え（旧 callAgent/callAgentAsync 系テストは Agent.call() 経由で同シナリオを再現）
  - `tests/unit/lib/agent-profiles.test.js` を削除（profile resolution シナリオは新 agent.test.js に統合済み）
  - `tests/unit/lib/agent-with-logger.test.js` を Agent.call() の Logger 統合テストに書き換え
  - `tests/e2e/142-agent-timeout-config.test.js` および `tests/e2e/052-agent-command-config.test.js` を削除（テスト対象である `timeoutMs`/`cwd` 引数および `resolveAgent` 関数自体が R2/R6 により廃止されたため契約テストとして無効）
  - その他 docs/flow テストのモック agent を Agent クラスインスタンスに書き換え

## Requirements

優先順位: **P0** = 本 spec の必達、**P1** = 本 spec 内で実施するが受け入れ基準は P0 を最優先。

### P0

- **R1:** When 呼び出し元コードが AI エージェントを起動するとき、shall 共有のエージェントサービス経由でのみ呼び出すこと。直接呼び出し用の旧公開関数を残してはならない。
- **R2:** When エージェント呼び出し API が呼ばれるとき、shall タイムアウトと作業ディレクトリは設定およびプロジェクトコンテキストから内部解決すること。呼び出し元はそれらを引数として渡せない。
- **R3:** When エージェント子プロセスを起動するとき、shall 子プロセスの stdin EOF 待ちで hang しない呼び出し方式に統一すること。同期呼び出し経路を残してはならない。
- **R4:** If 特定の AI CLI が作業ディレクトリ受け渡し用 CLI フラグを必要とするとき、shall サービスが設定解決済みの作業ディレクトリを当該フラグ値として自動付与すること。CLI 設定側に作業ディレクトリのハードコード値を残してはならない。
- **R5:** When 設定で argv サイズ閾値が指定されているとき、shall その値を stdin フォールバック判定に使用すること。未指定時は 100000 bytes を既定値とする。
- **R6:** When 出力パース・provider 判定・builtin profile・JSON 出力フラグ・systemPrompt 受け渡し方法のいずれかを参照するとき、shall provider 別の単一定義箇所から取得すること。provider 横断のフラット辞書および command 文字列マッチによる provider 判定を残してはならない。

### P1

- **R7:** When 全呼び出し元の移行が完了したとき、shall 旧公開関数（直接 import 用の呼び出し API）が全て削除されていること。
- **R8:** When 呼び出し元が AI レスポンスを必要とするとき、shall 非同期呼び出しに統一されていること。
- **R9:** When エージェント呼び出しがリトライ機構を使用するとき、shall リトライ回数の上限を呼び出しオプションで指定すること。既定値は 0（リトライ無効）、上限は 5 回までとする。リトライ間隔（ミリ秒）の既定値は 3000 とする。

## Acceptance Criteria

- AC1: 共有のエージェントサービスが Container から取得でき、`resolve(commandId)` および `call(prompt, options)` 相当のインターフェースを提供する（R1）。
- AC2: エージェント呼び出し API のシグネチャに `timeoutMs` および `cwd` 相当の引数が存在しない。タイムアウトは設定解決値、作業ディレクトリはプロジェクトコンテキストから取得される（R2）。
- AC3: エージェント子プロセス起動経路が単一であり、stdin EOF 待ちで hang しない方式に統一されている。同期呼び出し API が公開されていない（R3, R8）。
- AC4: 作業ディレクトリ受け渡し用 CLI フラグを宣言した provider について、サービスが設定解決済みの作業ディレクトリを自動付与する。provider 設定側に作業ディレクトリのハードコード値が存在しない（R4）。
- AC5: 設定キー（argv サイズ閾値）で stdin フォールバック判定の閾値が変更可能で、未指定時は 100000 bytes が使用される（R5）。
- AC6: provider 別の出力パース・JSON 出力フラグ・systemPrompt 受け渡し方法・workDir フラグ・builtin profile 一覧が provider ごとの単一定義箇所に集約され、provider 横断のフラット辞書および command 文字列マッチが残っていない（R6）。
- AC7: 旧公開関数（直接 import 用の呼び出し API）の export が削除され、内部に呼び出し元が残っていない（R7）。
- AC8: provider 抽象およびエージェントサービスに対する単体テストが追加され、`npm test` が green（R7, R8 の確認も兼ねる）。
- AC9: エージェント呼び出しのリトライ回数が呼び出しオプションで指定可能で、既定値 0、上限 5 回でクランプされる。リトライ間隔の既定値は 3000 ミリ秒（R9）。

## Test Strategy

- **単体テスト**: provider 抽象（出力パース・jsonFlag・systemPrompt 受け渡し方法・workDirFlag・builtinProfiles のメソッド契約）、provider 具象（claude / codex の各 builtin profile 解決と出力パース）、エージェントサービス（resolve の解決結果、call のオプション処理、作業ディレクトリの自動付与、argv 閾値判定）。spawn 起動部分はモック化または極小スクリプトを fixture として用意する。
- **回帰テスト**: 既存ユニットテスト全件が新サービス経由で pass すること。旧 API への参照を含む既存テストは新 API へ移植する（テスト本体のシナリオは保持）。
- **テスト配置**: provider 抽象・サービスの単体テストは `tests/` 配下（公開的な API 契約テスト）。本 spec 固有の移行確認テストは `specs/183-agent-service-refactor/tests/` に配置する。
- **実行コマンド**: `node tests/run.js > <workDir>/logs/test-output.log 2>&1` 形式で出力を保存し、結果は gate-impl から参照する。

## Open Questions

（なし）

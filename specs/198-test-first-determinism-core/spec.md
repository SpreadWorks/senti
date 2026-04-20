# Feature Specification: 198-test-first-determinism-core

**Feature Branch**: `feature/198-test-first-determinism-core`
**Created**: 2026-04-20
**Status**: Draft
**Input**: GitHub Issue #186
**Parent Initiative**: cac6/T4 Phase 2 (Phase 1 は #185 で merge 済み)

## Goal

**単一の関心事:** test-first で SDD flow が同じ入力から同じ結果を生む「決定論」を担保する。

cac6/T4 Phase 1 (#185) で確立した step 構造と phase 割当の骨格は、決定論を成立させるための *枠* にすぎない。本 spec はその枠の上で、決定論を実際に成立させる 4 つの不可分な振る舞いを実装する。各項目は単独では決定論を成立させられず、同一 spec でまとめて扱う必然がある。

- テスト実行の確定化 — 結果値を AI 自己申告から切り離す (入力 → 結果の写像を確定化)。
- テスト記述段階の実装差分 hard wall — テストが実装に依存しない状態を強制 (先に実装を見ないと書けないテストを禁じる)。
- 追加タスク draft の自律生成と gate 信頼点化 — 追加タスク挿入時の分岐点で AI 判断の揺らぎを排し、gate のみを判定点にする。
- 統合 step の skip 初期化 — tasks を持たない flow で step 列が確定的に短縮されるようにする (不定の pending 残留を排除)。

これら 4 つは「AI 判断のブレを構造的に排除して flow 挙動を同じ入力から同じ結果にする」という単一の関心事の 4 つの側面であり、いずれを欠いても決定論は部分的にしか成立しない。

## Scope

- テスト実行を AI から切り離した確定的ツールの導入。実行コマンドの決定 (明示設定 or スクリプト推論)、子プロセス起動、結果保存、サマリ記録を含む。
- テスト記述段階で、該当 spec が宣言した実装対象ファイルへの context アクセスを拒否する hard wall の実装。
- 追加タスク挿入時に、親 spec / 既存タスク / 上位要求文書を context としてツール主導で draft を生成する経路の新設。gate のみを信頼点とし、既存 retry policy と同値でリトライしてから利用者に escalate する。
- 新規 flow 初期化時、spec が tasks を持たない場合に統合系 step を `skipped` 状態で登録する。

## Out of Scope

- 旧形式からの後方互換シム導入 (alpha 方針)。
- 統合 step skip 初期化の既存 flow への遡及適用 (migration は実装しない)。
- タスク step 命名の整理 (Issue 本文で別タスクと明記)。
- replan 機構 (Issue 本文で別タスクと明記)。
- plan origin 向けの自律 draft 生成 (本 spec では追加タスクのみを対象)。
- テスト結果ログ解析の preset 別 parser 実装 (将来拡張余地として扱う)。
- 追加タスク draft 生成における guardrail AI 準拠の full gate 統合 (本 spec は構造検証ベースの内部 gate でゲート経路を成立させる最小スコープ — guardrail 評価軸を含む `run gate` 相当の完全統合は後続 spec)。
- 追加タスク draft 生成ツールの production AI provider 実配線詳細 (本 spec は container 経由 agent 呼び出しと `SDD_FORGE_AGENT_STUB` env 経由のテスト用経路を導入。provider 側のプロンプト最適化やレスポンス検証の強化は後続)。

## Clarifications (Q&A)

- Q: テスト実行コマンドの設定配置先は？
  - A: top-level の「コマンド設定」配下に `test` を追加し、task/parent 両スコープを構造化して持つ。省略時は既存のテストスクリプトから推論。
- Q: テスト記述段階の「実装対象ファイル」の宣言場所は？
  - A: spec の構造化データ (spec.json 進行中の schema) に専用フィールドとして追加する。プロジェクト全体設定への配置は意味がないため不採用。
- Q: 追加タスクの自律 draft 生成はツール主導か skill 主導か？
  - A: ツール主導。gate のみが信頼点 / retry 上限同値で escalate の要件は skill 任せでは満たせないため。
- Q: 統合 step skip 初期化は既存 flow にも遡及適用するか？
  - A: 新規 flow のみ。alpha 方針に従う。
- Q: テストはどこに配置するか？
  - A: 恒久回帰価値のあるものはプロジェクト共通のテスト配置場所、spec 固有 end-to-end シナリオは spec 直下。

## Impact on Existing Features

- **既存 flow 状態**: tasks を持たない既存 flow では統合 step が pending のまま残る。本 spec の実装はこの既存状態を書き換えない (REQ-P4-2)。skill 側は統合 step を未参照のため実害はない。新規 flow 以降のみ影響を受ける。
- **プロジェクト設定スキーマ**: テストコマンド設定が 1 つ追加されるが省略可能であり、既存 config はそのまま動作する。未指定時は従来通り既存テストスクリプトからの推論にフォールバック。
- **spec 構造化データ**: 実装対象を表すフィールドが spec 構造化データに 1 つ追加される。既存 spec (本フィールド未宣言) では hard wall が無効化され、従来と同じ挙動となる。
- **context 取得 API**: テスト記述段階かつ実装対象宣言ありの組み合わせに限り除外が適用される。他 phase、および実装対象宣言の無い spec では挙動は変わらない。
- **追加タスク経路**: skill レイヤから独自 AI 呼び出しで draft を生成していた経路は廃止され、ツール経路に一本化される (REQ-P3-5)。
- **skill テンプレート**: テスト記述段階の方針明記と追加タスク分岐の書き換えが必要。配布メカニズム経由でユーザーに届く (upgrade 要)。
- **既存 CLI 命令**: 既存コマンドの削除や意味変更はない (追加のみ)。

## Alternatives Considered

- テスト実行結果を AI に自己申告させる案: 決定論が崩れるため却下 (Issue の主要動機)。
- 実装対象 glob を spec.md の自由記述に書く案: 構造化検証不可で進行中の spec 構造化方針とも矛盾するため却下。
- 追加タスク draft 生成を skill 改変のみで実現する案: retry/escalate の一貫性が AI 判断依存になり、Issue 要件「gate のみが信頼点」を満たせないため却下。
- 統合 step skip 初期化の既存 flow 遡及適用: alpha 方針 (後方互換シム禁止) に反するため却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: Q1-Q6 + spec.md full content 承認。以降 auto モードで進行。

## Requirements

要件は優先度順 (P1 が最優先)。

### P1 — テスト実行の確定化

- **REQ-P1-1 (shall)**: **When** 利用者がスコープ付きでテスト実行を要求したとき、ツールはそのスコープに対応するテストコマンドを決定し、子プロセスとして起動して結果を保存すること。
- **REQ-P1-2 (shall)**: **When** flow 状態に現在対象のタスクが存在するとき、ツールはタスク単位のスコープとして解釈すること。**If** 現在対象タスクが存在しない場合は親レベルのスコープとすること。
- **REQ-P1-3 (shall)**: **When** プロジェクト設定にテストコマンドが明示されているとき、ツールはその設定を採用すること。**If** 設定が無い場合は利用可能なテストスクリプトから推論すること。
- **REQ-P1-4 (shall)**: **When** テスト実行が完了したとき、ツールは終了コードおよびテスト種別 (unit / integration / acceptance) ごとの件数サマリを flow 状態に記録すること。
- **REQ-P1-5 (shall)**: **When** AI プロセスがテスト結果サマリの書き換えを試みたとき、ツールが書き込み経路を独占し、AI 側からの書き換えを成立させないこと。
- **REQ-P1-6 (shall)**: **When** テスト実行がエラーで停止したとき、ツールは非 0 exit code を返すこと。

### P2 — テスト記述段階の実装差分 hard wall

- **REQ-P2-1 (shall)**: **When** flow がテスト記述段階にあり、spec が実装対象ファイルを宣言しているとき、ツールは当該ファイル群への context アクセスを遮断すること。
- **REQ-P2-2 (shall)**: **When** 実装対象を spec が列挙するとき、spec の構造化データ上に専用フィールドとして glob 列挙が可能であること。
- **REQ-P2-3 (shall)**: **When** 実装対象へのパス指定 context 取得が要求されたとき、ツールはエラーを返し、取得を拒否すること。
- **REQ-P2-4 (shall)**: **When** 一覧型もしくは検索型の context 取得が要求されたとき、ツールは実装対象に該当するエントリーを結果から除外すること。
- **REQ-P2-5 (shall)**: **When** テスト記述段階向けの skill / プロンプトが利用者に配布されるとき、「実装差分を参照しない」方針が文書上に明記されていること (ツール側 hard wall の補強目的)。

### P3 — 追加タスク origin の自律 draft 生成

- **REQ-P3-1 (shall)**: **When** 追加タスクが挿入されたとき、ツールは親 spec / 既存タスク群 / 上位要求文書を context として AI を呼び出し、追加タスク用の draft を生成すること。
- **REQ-P3-2 (shall)**: **When** 生成された draft が gate に掛けられたとき、採否判定は gate の結果のみを信頼点とし、AI 自己判断による承認/却下を行わないこと。
- **REQ-P3-3 (shall)**: **When** gate が FAIL したとき、ツールは既存 flow の retry 上限と同値の回数までリトライすること。**If** 上限に達した場合は利用者に escalate すること。リトライ上限は有限とする (無限ループ禁止)。
- **REQ-P3-4 (shall)**: **When** `autoApprove` が有効で gate が PASS したとき、ツールは draft を自動承認して次段階に進めること。
- **REQ-P3-5 (shall)**: **When** skill レイヤから追加タスク draft が要求されたとき、必ずこのツール経路を経由させ、skill 内での独自生成経路を廃すること。

### P4 — 統合 step の skip 初期化

- **REQ-P4-1 (shall)**: **When** 新規 flow を初期化する時点で、**If** 対象 spec が tasks を持たない場合、統合系 step を `skipped` 状態で登録すること。
- **REQ-P4-2 (shall)**: **When** 既に存在する flow が本 spec の実装前から pending 状態を保持しているとき、本 spec の実装は当該既存 flow の状態を書き換えないこと (遡及的マイグレーションを行わない、alpha 方針)。
- **REQ-P4-3 (shall)**: **When** skill が step 列から次アクションを判定するとき、`skipped` 状態の統合 step は処理対象から除外され、次の非 skipped step へ遷移すること。

## Acceptance Criteria

- **AC-1**: プロジェクト設定にテストコマンドを明示した状態で本ツールを実行すると、明示コマンドが子プロセスとして起動し、結果ログが workDir 配下に保存され、終了コードとテスト種別件数サマリが flow 状態に記録される (REQ-P1-1, P1-3, P1-4)。
- **AC-2**: プロジェクト設定を省略した状態で本ツールを実行すると、利用可能なテストスクリプトから推論されたコマンドが起動する。スクリプトが無い環境では明示エラーとなる (REQ-P1-3, Edge case 2)。
- **AC-3**: 現在対象タスクの有無によって、ツールが task スコープ / parent スコープを切り替える (REQ-P1-2)。
- **AC-4**: テスト実行が失敗したとき、ツールは非 0 exit code を返し、flow 状態には終了コードが記録される (REQ-P1-6)。
- **AC-5**: spec が実装対象を宣言している状態で、テスト記述段階に入っている flow から context 取得 (パス指定 / 一覧 / 検索) を行うと、実装対象へのアクセスだけが遮断され、他の context は従来通り取得できる (REQ-P2-1, P2-3, P2-4)。
- **AC-6**: spec が実装対象を宣言していない flow では、テスト記述段階でも context 取得は従来通り動作する (Edge case 4)。
- **AC-7**: 追加タスクを挿入すると、ツール経路で draft が生成され、gate を経て採否が決定される。gate FAIL 時はリトライ上限まで自動再試行し、上限到達時に利用者に escalate される (REQ-P3-1, P3-2, P3-3)。
- **AC-8**: `autoApprove` 有効かつ gate PASS で、ツールが追加タスク draft を自動承認して次段階へ進める (REQ-P3-4)。
- **AC-9**: 新規 flow の初期化時、spec が tasks を持たない場合、flow 状態の統合系 step は `skipped` で登録されている (REQ-P4-1)。
- **AC-10**: `skipped` 状態の統合 step は skill からの次アクション判定で読み飛ばされ、他の非 skipped step へ遷移する (REQ-P4-3)。

## Why this approach

- **AI とツールの責務分離**: test-first 決定論化の核は「AI が結果値を自己申告しないこと」。これを実現するには、結果記録経路をツールが独占する必要があり、REQ-P1-5 の独占制約は必然。
- **hard wall の配置**: テスト記述段階で実装差分を見ない規律を AI の自己統制に任せると決定論が崩れる。ツール側での context 遮断 (REQ-P2-3, P2-4) によって AI 側の意図に依存しない強制力を与える。
- **追加タスク経路のツール主導化**: 「gate のみが信頼点」「retry 上限同値で escalate」は AI が各自判断すると挙動がブレる。ツールが retry/escalate を制御する既存 gate/review と同形の設計にすることで、挙動の一貫性が得られる。
- **新規 flow のみへの適用**: alpha 方針で後方互換シムを書かない合意に従う。既存 flow の pending 残留は skill 側で参照されず実害がない。
- **spec 構造化データへの実装対象宣言**: 進行中の spec 構造化方針 (#196 周辺) と揃え、構造化検証可能な形で宣言する。プロジェクト全体設定への配置は、実装対象が spec ごとに固有であるため不適切。

## Test Strategy

- **恒久回帰テスト (プロジェクト共通のテスト配置場所)**:
  - テスト実行ツールの起動・終了コード伝搬・件数サマリ記録・設定と推論の優先順位。
  - テストコマンド設定のスキーマ検証 (正常 / 異常入力)。
  - 初期 step 構築ロジックにおける tasks 有無の分岐 (P4)。
  - context 除外フィルタのパス判定 (パス指定 / 一覧 / 検索 の各経路)。
  - 追加タスク draft 生成の AI 呼び出し (stub) → gate → retry 上限 → escalate の振る舞い。
- **spec 固有シナリオ (spec 配下のテスト配置)**:
  - 1 タスクを完走させ、step 順序と親サマリ合算を end-to-end で検証。
  - 検証内容・実行方法を記した README。

## Open Questions

なし — Q1-Q6 で全ての設計判断が合意済み。実装段階で設計詳細が発生した場合は issue-log に記録する。

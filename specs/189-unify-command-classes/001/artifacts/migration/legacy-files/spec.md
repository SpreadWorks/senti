# Feature Specification: 189-unify-command-classes

**Feature Branch**: `feature/189-unify-command-classes`
**Created**: 2026-04-18
**Status**: Draft
**Input**: GitHub Issue #168 — spec 188 Phase D: 15 コマンドの Command クラス化 + docs build 共通契約化

## Goal

spec 188 で導入した統一実行機構 (Command 基底クラス + 単一 dispatcher + コマンドレジストリ + 共有 Container) に対し、過渡的な橋渡しアダプタ経由で接続されている旧スタイルのコマンド実装を、統一機構の標準形（Command 派生クラスによる直接実装）へ全面移行する。併せてディスパッチャ内に残っている build 専用経路を共通契約に寄せ、橋渡し用の一時コードを除去する。これにより spec 188 の R2「単一コンテキスト取得」と AC1「静的検査 0 件違反」を完全達成する。

## Scope

1. docs / check / metrics 3 ドメイン配下の対象コマンド実装ファイル群を、統一機構の標準形（Command 派生クラスとして `execute(ctx)` を持つ）へ移行する。
2. 移行対象ファイル内部での共有状態の直再解決（実行ルート解決・設定ロードの直呼び）を、共有 Container 経由の取得に置換する。
3. ディスパッチャ内に残存する build 専用オーケストレーション経路を、統一機構上の通常コマンドとして扱えるよう再構成する。内部のサブコマンド順次呼び出しは共通契約経由に統一する。
4. 過渡期の橋渡しモジュール（legacy main をラップする adapter）をリポジトリから削除する。
5. 過渡期の runner モジュール（legacy main 起動用ユーティリティ）の残存参照を除去する。未参照化後の当該モジュールの扱い（削除 / 予約）は実装フェーズで最終判断する。
6. 上記移行の合否を機械判定するための静的検査テストを spec 配下に追加する。

## Out of Scope

- コマンドが提供する業務ロジックの意味論変更（scan / enrich / build / gate 等が行う処理内容）。
- CLI 外部インターフェースの意図的変更（サブコマンド名・flag/option 名・正常系出力 semantics・終了コード）。R4 に従い原則として完全互換。
- spec 188 で既に導入済みの Container / dispatcher / registry / 基底 Command クラスの再設計。
- 新ドメインのコマンド追加、および本 spec で対象外のコマンドに対するリファクタ。
- ユーティリティ目的で named export されている関数（`main` 以外）の可視性変更。

## Clarifications (Q&A)

### Q1: Issue #168 の意図確認
- **A:** 15 コマンドの Command クラス直移行、build 専用経路の共通契約化、橋渡しコード除去という 3 軸で spec 188 R2 / AC1 を完全達成する follow-up として落とす。
- **根拠:** Issue #168 に 5 項目スコープが明記されており、spec 188 の issue-log に follow-up として記録済み。

### Q2: 移行粒度・コミット戦略
- **A:** 本件を 1 spec に集約し、ドメイン単位（docs / check / metrics / docs-build / adapter-removal）でコミット分割する。
- **根拠:** alpha ポリシー「後方互換コード不要」により中間状態を長く保つ必要はなく、adapter 削除を最終コミットに集約することで AC1 PASS のタイミングが明確化する。

### Q3: テスト戦略
- **A:** spec 188 の静的検査テストを本 spec の合否判定に流用し、本 spec 固有テストは「橋渡しコード不在」を検証する静的検査のみとする。外部振る舞いの回帰は既存 acceptance 資産および `npm test` 全体で担保する。
- **根拠:** 既存静的検査を別 spec に複製するとメンテが二重化する。橋渡しコード除去は本 spec 固有事象のため spec 配下に配置する。

### Q4: build 専用経路の共通契約化
- **A:** 現行のディスパッチャ内 build 専用経路を廃し、build を統一機構上の通常コマンドとして扱う。内部のサブコマンド順次呼び出しは共通契約経由に統一する。多言語・再生成の分岐は Command 内のロジックとして保持する。
- **根拠:** spec 188 R7「パイプライン内呼び出しの共通契約」準拠。ディスパッチャを純粋ルーティングに収束させる。

### Q5: リスク認識と完了条件
- **A:** ユーティリティ用途の named export は残置可。旧 main への外部依存が存在する場合は呼出側を同時更新する。外部互換は既存 acceptance で担保。完了は「対象コマンド全てが標準形・橋渡しコード参照 0・spec 188 静的検査 PASS・本 spec 固有静的検査 PASS・既存テスト全体が baseline から後退しない」で判定する。
- **根拠:** alpha ポリシーと spec 188 R2 / R8 / AC1 要求に整合。

## Alternatives Considered

1. **各コマンドごとに別 spec を切る**: spec 数が増え、adapter 削除タイミングが分散して AC1 PASS のマイルストーンが不明確になる。却下。
2. **build 専用経路を温存し、leaf コマンドのみ移行**: spec 188 R1「単一実行機構」および R7「パイプライン共通契約」から乖離する残債になる。却下。
3. **橋渡し adapter を残しつつ leaf コマンドを Command クラス化**: adapter が恒久化し、spec 188 AC1 の静的検査が PASS に到達しない。却下。
4. **spec 188 の静的検査を本 spec 配下に複製して差分運用**: テスト定義が二重化しメンテコストが増える。却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-18
- Notes: Q1-Q5 承認済み。spec 188 R2 / AC1 完全達成を目標とする follow-up として承認。

## Requirements

優先度は上位ほど高い。

### R1 (最優先): コマンド実装の標準形化
When 本 spec の対象コマンド実装ファイルを静的検査したとき、shall コマンド実装は統一機構の標準形（Command 派生クラスとして `execute(ctx)` を実装し、共有状態を Container 経由でのみ取得する形）であり、旧 main export および共有状態の直再解決パターンは 0 件である。CLI エントリポイントおよび共有コンテキスト初期化モジュールはこの制約の対象外とする。

### R2: 橋渡しコードの除去
When 移行完了後にソースツリー全体を静的検査したとき、shall 過渡期の橋渡しアダプタモジュールは削除されており、その関数名への `import` / 呼出参照は 0 件である。When 過渡期の runner モジュールの関数名を検査したとき、shall その関数名への `import` / 呼出参照は 0 件である。If runner モジュール本体の扱いに関して削除 / 予約の判断が必要な場合、shall 実装フェーズで決定する。

### R3: ディスパッチャ内専用経路の共通契約化
When 統一機構のディスパッチャソースを検査したとき、shall 特定コマンドに固有の専用オーケストレーション経路は存在せず、全コマンドが共通契約経由で解決される。When 当該コマンドが内部で他コマンドを順次呼び出すとき、shall その呼び出しは spec 188 R7 の共通契約経由で行われ、呼び出しごとの局所 override（出力言語・出力先等）は同契約で指定可能である。

### R4: 外部互換の維持
When 移行前後で同一 CLI 引数列により対象コマンドを実行したとき、shall 以下の観測可能な挙動が一致する:
1. 受理されるサブコマンド名および flag/option 名。
2. 正常系の stdout 出力内容。
3. エラー系の stderr 出力と終了コード。
4. ファイルシステム副作用（生成ファイル・配置パス）。

If いずれかに差分が発生する場合、shall 本 spec に差分内容とマイグレーション方針を明示列挙する。

### R5: 終了コード契約
When 対象コマンドが正常終了するとき、shall 終了コードは 0 である。When 対象コマンドが異常終了するとき、shall 終了コードは 0 以外である。When 統一機構が例外を捕捉して envelope を出力するとき、shall 終了コードも失敗を示す 0 以外に設定される。

### R6: エラーの可視化
When 移行後のコマンド実行中に例外が発生するとき、shall 統一機構の既存契約に従い envelope の `errors` フィールドまたは stderr のいずれかで必ず可視化される。未知のエラーを無言で握り潰す実装は導入しない。

### R7: 静的検査テストの追加
When 本 spec 固有の静的検査テストを実行したとき、shall 以下を検証する:
1. 過渡期の橋渡しアダプタモジュールファイルが存在しない。
2. 過渡期の runner モジュールに含まれていた関数名への `import` / 呼出参照が src ツリー全体で 0 件である。

テストは子プロセスを起動せず直接 import で実行できる形式とし、spec 配下に配置する。

### R8: 既存テストの維持
When 移行完了後に `npm test` を実行したとき、shall テスト結果は本 spec 作業開始時点の baseline から後退しない。baseline で既に failing のテスト（pre-existing failures）は許容するが、本 spec に起因する新規 failure は許容しない。

### R9: リソース境界の維持
When 本移行の実装を行うとき、shall 新たな再帰・リトライ・一括読込は導入しない。When 既存のリソース境界（件数・深さ・サイズ上限）に遭遇したとき、shall 移行前後でその境界値を変更しない。If 既存境界を意図せず変更したことが判明した場合、shall spec にその変更と理由を明示列挙する。

## Acceptance Criteria

### AC1 (R1)
spec 188 配下の既存静的検査テスト (`specs/188-unify-command-architecture/tests/static-checks.test.js`) が PASS する。具体的には、commands/ 配下に旧 main export が 0 件、共有状態直再解決が 0 件、ディスパッチャでの `process.argv` 書換が 0 件、command registry が subtree を公開している状態である。

### AC2 (R2)
本 spec 配下の静的検査テスト (`specs/189-unify-command-classes/tests/`) が PASS する。具体的には、過渡期の橋渡しアダプタファイルが存在せず、runner モジュールに含まれていた関数名への参照が src 全体で 0 件である。

### AC3 (R3)
`sdd-forge docs build` が以下 3 モードで、移行前と同じ stdout・生成ファイル・終了コードを産出する:
- (a) single-lang モード
- (b) multi-lang モード（default + 1 言語以上の非 default）
- (c) `--regenerate` モード

同時に、ディスパッチャソースに build 専用分岐ブロックが存在しないことを目視レビューで確認する。

### AC4 (R4)
移行前後で以下が一致することを検証する:
- `sdd-forge docs --help`, `sdd-forge check --help`, `sdd-forge metrics --help` の stdout と終了コード。
- 正常系: 各対象コマンドの stdout および終了コード 0。
- エラー系: 未知サブコマンド・必須引数不足時の stderr と 0 以外の終了コード。

検証は既存 acceptance テストの実行、および必要に応じた目視確認で行う。

### AC5 (R5, R6)
統一機構の既存ライフサイクル・出力モード契約（envelope / raw）が対象コマンドにも適用されていることを、コマンド単位の `outputMode` メタデータ宣言と既存 unit テストの継続 PASS により確認する。

### AC6 (R8)
`npm test` 全体を実行し、本 spec 作業開始時点の baseline と比較して新規 failure が発生していない。既存 pre-existing failures（例: tests/acceptance/lib/pipeline.js の os import 欠如に起因する既知の acceptance 失敗）は除外する。

### AC7 (R9)
差分レビューにおいて、再帰・リトライ・一括読込の新規導入および既存境界値の変更が無いことを確認する。

## Open Questions

- [x] `command-runner.js` モジュール本体を削除するか予約として残すか — 実装フェーズで、参照除去後の当該ファイルの扱い（削除推奨）を最終判断する。参照 0 件であれば alpha ポリシー上は削除が妥当。
- [x] build コマンド移行後のディスパッチャ側 help 表示経路 — 実装フェーズで、統一機構の help 契約上で自然な表示になるよう最終化する。外部 stdout の help 文言は AC4 により前後一致を要求する。

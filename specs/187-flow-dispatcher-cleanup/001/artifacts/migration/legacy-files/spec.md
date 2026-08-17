# Feature Specification: 187-flow-dispatcher-cleanup

**Feature Branch**: `feature/187-flow-dispatcher-cleanup`
**Created**: 2026-04-17
**Status**: Spec
**Input**: User request — issue #166 (5a25): flow ディスパッチャ・registry・hook 層の整理 (Phase3)

## Goal

Container + FlowManager 基盤上で flow レイヤーの dispatcher / registry / hook / envelope を整理し、責務分離・エラー処理・OOP 方針との整合性を改善する。`.tmp/1877.md` の指摘 12, 13, 14, 23, 24, 25, 26, 27, 31 に対応する Phase3 リファクタリング。

## Scope

- `src/lib/flow-envelope.js`: 関数 export を `Envelope` クラス（`static ok/fail/warn` + インスタンスメソッド `toJSON()` / `output()`）に置換。
- `src/flow.js`: dispatcher の `runEntry` で post hook を envelope 出力前に同期実行し、post hook の失敗を envelope の warn として反映。未使用 `finally` スロットの分岐を削除。
- `src/flow/lib/base-command.js`: `FlowCommand.run(container)` シグネチャに変更。サブクラスは `this.container` 経由で依存を解決する形にする。
- `src/flow/lib/*.js`（FlowCommand サブクラス全般）: 上記シグネチャ変更に追従。`execute()` は ctx を引数に取る既存契約を維持し、`run()` 内で container から ctx を組み立てる方針とする（基底側集約）。
- `src/flow/registry.js`: `gate` の post / onError hook 内に直書きされている issue-log 書き込みを `run-gate.js` 側ヘルパーに移動。`finally` スロットを削除。`tryUpdateStepStatus` のエラー処理を `ERR_MISSING_FILE` のみキャッチに変更。
- `src/flow/lib/run-gate.js`: registry hook から移管された issue-log 書き込みヘルパーを export し、registry から呼び出せるようにする。
- `experimental/workflow.js`: `flow-envelope.js` の API 変更に追従。
- `tests/unit/envelope.test.js` 新規追加: `Envelope.ok/fail/warn` の invariant、`toJSON()` の構造、`output()` の副作用（stdout / exitCode）を検証。

## Out of Scope

- docs / check / metrics 系コマンドへの共通ライフサイクル展開（指摘13）。Phase3 では flow 層に閉じる。
- `flow-state.js` → `FlowManager` 分割（指摘28）は別 Phase / 既存対応済み。
- IssueLog を Container サービス化する判断（指摘26 の派生）。Phase3 では `run-gate.js` 内ヘルパーへの移動に留める。
- gate コマンドの仕様変更。あくまで内部実装の再整理。

## Clarifications (Q&A)

- Q: 6項目を1つの spec で実施するか分割するか
  - A: 1 spec で実施（親タスク 1877 で Phase3 として明示的にグルーピング、結合度高、alpha なので一括変更しやすい）。
- Q: post hook の実行タイミング
  - A: dispatcher の output 前に同期実行し、post hook の失敗は `Envelope.warn` で envelope に含める。コマンド本体の成否判定は変えない。
- Q: テスト戦略
  - A: 既存テスト緑維持 + Envelope 型の unit test 追加。`tests/unit/envelope.test.js`（formal test, `npm test` 対象）。
- Q: FlowCommand サブクラスの execute シグネチャ
  - A: 基底クラス `run(container)` で container を保持し、ctx は基底側で組み立てて `execute(ctx)` に渡す。サブクラスの execute は既存通り ctx を受け取り変更最小化。

## Alternatives Considered

- **Envelope を関数のまま残す**: OOP 方針 (`src/CLAUDE.md`) と整合しない。alpha 期間ポリシーに従い旧 API 削除を選択。
- **post hook 失敗を exitCode のみに反映**: 呼び出し側は JSON envelope のみで成否判定するため、stderr 副情報を見落とす誤判定の余地が残る。Envelope.warn 反映を選択。
- **FlowCommand サブクラスの execute まで container 受け取りに変更**: ~20 ファイルへの侵襲が大きい。基底側で container → ctx 組み立てを担い、execute シグネチャは維持する保守的アプローチを選択。
- **issue-log を Container サービス化**: 設計判断としては妥当だが、Phase3 のスコープを超える。run-gate.js 内ヘルパーへの移動に留め、サービス化は別 Phase の検討対象とする。

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-17
- Notes: ユーザー指示「後は頼む」により autoApprove で承認

## Requirements

### Priority Order

実装は依存関係に従い以下の順で進める。前段が後段の前提となる。

1. **R5 (高)** — Envelope の OOP 化。R4 の前提（warn 経路を提供する）。
2. **R4 (高)** — post hook 実行タイミング。R5 を前提に dispatcher のライフサイクルを変更。
3. **R1 (中)** — FlowCommand の Container 接続。基底クラス変更で全サブクラスが追従。
4. **R2 (中)** — registry hook から domain logic 分離。R1 と独立だが registry 整理として連続して実施。
5. **R3 (中)** — 非定型エラーの再 throw。R2 の影響範囲内で同時適用。
6. **R6 (低)** — 未使用 finally スロット削除。最終クリーンアップ。

### R1: FlowCommand の Container 接続

- **When** 任意の FlowCommand サブクラスがコマンドとして実行される、
- **shall** 基底クラスは依存コンテナを引数として受け取り、サブクラスから container 経由で flowManager / config / paths などの依存にアクセスできる構造を提供する。
- **shall** dispatcher は ctx を組み立てずに container を直接基底クラスに渡し、ctx 組み立て責務は基底クラスに集約される。

### R2: registry hook から domain logic 分離

- **When** `flow run gate` の post hook または onError hook が起動する、
- **shall** issue-log の I/O は registry の hook 関数内に直書きされず、`run-gate.js` 内の export されたヘルパー関数に集約される。
- **shall** registry の hook 関数は flow 状態の内部構造（`flowState.spec` 等）への直接アクセスを持たない。

### R3: 非定型エラーの再 throw

- **When** ステップ状態更新または issue-log 書き込み中にエラーが発生する、
- **shall** flow.json 不在に相当する欠落エラー（`ERR_MISSING_FILE`）のみキャッチして警告ログを stderr に記録し継続する。
- **shall** 上記以外のエラーは呼び出し元へ再 throw され、サイレント失敗を起こさない。

### R4: post hook 実行タイミング

- **When** dispatcher (`runEntry`) がコマンド本体の実行を完了する、
- **shall** post hook は envelope の標準出力前に同期実行される。
- **shall** post hook の失敗は `Envelope.warn` として envelope の warnings 経路に含まれ、stdout の JSON で観測可能となる。
- **shall** post hook 失敗時もコマンド本体の成否（exitCode）は変更しない。

### R5: Envelope の OOP 化

- **When** flow コマンドが結果を返す、
- **shall** envelope は `Envelope` クラスのインスタンスとして表現され、`Envelope.ok(type, key, data)` / `Envelope.fail(type, key, code, messages)` / `Envelope.warn(type, key, data, code, messages)` の static factory 経由でインスタンス化される。
- **shall** `toJSON()` でシリアライズ可能な構造を返し、`output()` で stdout 出力と `process.exitCode` 設定をインスタンスメソッドとして提供する。
- **shall** alpha 版ポリシーに従い、旧 API（`ok` / `fail` / `warn` / `output` 関数 export）は削除される。

### R6: 未使用 finally スロット削除

- **When** registry エントリが定義される、
- **shall** `finally` フィールドは予約せず、dispatcher 側 `runEntry` の `if (entry.finally)` 分岐も削除される。

## Acceptance Criteria

1. `npm test` が緑（既存ユニット / E2E が回帰せず通過）。
2. `tests/unit/envelope.test.js` が存在し、`Envelope.ok/fail/warn` の invariant（必須フィールド、ok フラグ、errors 配列構造）と `output()` の副作用（stdout JSON、`process.exitCode` の正負）を検証する。
3. `src/lib/flow-envelope.js` が `Envelope` クラスを default ではない named export とし、関数 export (`ok`, `fail`, `warn`, `output`) が存在しない。
4. `src/flow/lib/base-command.js` の `FlowCommand.run` シグネチャが `run(container)` で、`this.container` がインスタンスフィールドとして保持される。
5. `src/flow.js` の `runEntry` 内で post hook が `output` 呼び出し前に実行され、post hook が throw した場合は envelope に warn が追加されて出力される。
6. `src/flow/registry.js` 内に issue-log の `loadIssueLog` / `saveIssueLog` 直接呼び出しが存在しない。
7. `src/flow/registry.js` および `src/flow.js` 内に `finally` フィールド定義 / 参照が存在しない。
8. `src/flow/registry.js` 内 `tryUpdateStepStatus` の catch が `ERR_MISSING_FILE` のみキャッチする実装になっている。
9. `experimental/workflow.js` が新しい `Envelope` API を使用しており、旧関数 import が残っていない。
10. `sdd-forge flow get status`、`sdd-forge flow set step draft in_progress`、`sdd-forge flow run gate --phase draft` の 3 コマンドを実行し、それぞれの stdout に出力される JSON が `{ok, type, key, data, errors}` の 5 フィールドを持ち、`ok=true` 時 `errors=[]` または `errors[*].level="warn"`、`ok=false` 時 `errors[0].level="fatal"` であることを満たす。

## Test Strategy

- **既存テスト**: `npm test`（unit + e2e）の緑維持で振る舞い不変を回帰検出する。flow dispatcher / hook / gate / registry を扱う既存テスト群が R1〜R4, R6 をカバーする。
- **新規 unit test** (`tests/unit/envelope.test.js`):
  - `Envelope.ok(type, key, data)` がインスタンスを返し、`toJSON()` が `{ok: true, type, key, data, errors: []}` を返す。
  - `Envelope.fail(type, key, code, messages)` がインスタンスを返し、`toJSON()` が `{ok: false, ..., errors: [{level: "fatal", code, messages}]}` を返す。messages 文字列とArrayの両方を受理する。
  - `Envelope.warn(...)` が `{ok: true, ..., errors: [{level: "warn", ...}]}` を返す。
  - `output()` で `process.exitCode` が ok=true → 0、ok=false → 1 になる。
  - `output()` で stdout に JSON が 1 行（pretty 2-indent）出力される。
- **手動確認**: `sdd-forge flow get status` / `flow set step` / `flow run gate` の JSON 出力が変化しないことを実機確認。

## Migration

CLI コマンド・オプションの仕様変更は無し。内部 API（`flow-envelope.js`、`FlowCommand`）の破壊的変更はあるが、`src/` および `experimental/` 内で同一 PR にて全箇所を追従修正する。外部 npm パッケージ利用者は `Envelope` を直接 import していないため影響なし。

### Test file relocation

R5 により旧関数 export API (`ok` / `fail` / `warn` / `output`) が削除されるため、その API のみを検証していた `tests/unit/flow/envelope.test.js` は obsolete となり削除する。同等以上の invariant（`Envelope.ok/fail/warn`、`addWarning`、`output()` の stdout / exitCode 副作用、`toJSON()` 構造）は新規 `tests/unit/lib/envelope.test.js` でカバーされる。テスト総数は減らない（旧 4 ケース → 新 9 ケース）。

## Why This Approach

- **Envelope の OOP 化**: `src/CLAUDE.md` の OOP 方針に整合し、`toMarkdown()` を持つ `Table` / `MarkdownText` 等と同じパターン。`output()` を型に所属させることで `console.log` + `exitCode` の副作用が型の責務として閉じる。
- **post hook を出力前に実行**: 呼び出し側（skill / 他コマンド）は envelope JSON のみで判定する設計のため、stderr ベースの観測経路は誤判定を招く。`Envelope.warn` 経路で観測可能性を envelope に統一する。
- **FlowCommand に container 接続**: Container 化の真の目的（`.tmp/1877.md` 末尾）は「再解決を禁止し、単一 Container から取得させる」こと。基底クラスで container を保持することで全サブクラスが自動的にこの規律に従う。
- **基底クラスで ctx 組み立て、execute は ctx を受ける形を維持**: ~20 サブクラスの execute シグネチャを維持することで侵襲を抑える。container ↔ ctx 変換を 1 箇所に集約することで将来の ctx スキーマ変更にも追従しやすい。
- **issue-log は run-gate.js 内ヘルパーに留める**: Container サービス化は spec のスコープを超える。Phase3 では「registry hook から domain logic を出す」最小目的を達成する。

## Open Questions

- なし

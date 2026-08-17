# Feature Specification: 202-add-gate-impl-integration-tests

**Feature Branch**: `feature/202-add-gate-impl-integration-tests`
**Created**: 2026-04-20
**Status**: Draft
**Input**: issue #196 / spec 201 gate-impl 改善の integration test 不足

## Goal

spec 201 (gate-impl-eval-accuracy) の acceptance criteria で「integration test で確認できる」と明記されながら実際には unit test 相当で済ませた 5 項目を、真の end-to-end integration test として補完する。gate-impl の配線（test 変更機械判定・post-hook による retry counter 更新・retry 上限到達時のエスカレーション）が将来 refactor で切れた際に regression を検知できる状態にする。

## Scope

- `tests/e2e/flow/gate-impl-integration.test.js`（単一ファイル）に 5 ケースを配置
- テスト fixture 構築に必要な再利用可能 helper の追加（既存 `tests/helpers/` を拡張）
- config.agent.providers に固定応答を返す stub provider を構成する helper の追加

## Out of Scope

- production コード（`src/`）の変更。既存の gate-impl 実装は spec 201 で合格しており、この spec では変更しない。
- 既存 unit test の削除・改変。unit と integration の 2 層体制とする。
- spec 201 の Out of Scope（軸 B baseline 差分、軸 C 残存リスク E/F 等）への対応。
- 新 phase（`integration` 等）の挙動検証。既存の `task-impl` phase のみを対象とする。

## Clarifications (Q&A)

- Q: テスト配置先は `tests/e2e/flow/` と `specs/202-*/tests/` のどちらか？
  - A: `tests/e2e/flow/`。配線検証は「将来 refactor で切れたら常にバグ」に該当し、project decision rule（"always a bug? → YES → tests/"）に従う。
- Q: AI 呼び出しをどう扱うか？
  - A: 実 AI を呼ばず、既存 e2e テストの `config.agent.providers` パターンに準拠した固定応答 provider を使用する。
- Q: 5 項目を 1 ファイルに集約するか？
  - A: 集約する。全て `sdd-forge flow run gate --phase task-impl` の配線検証という近接関心のため、setup/fixture 共通化の効果が大きい。
- Q: ESCALATE 戻り値一致の判定基準は？
  - A: 送出エラーの識別子 `err.code === "ESCALATE_RETRY_EXHAUSTED"` を run-draft-task と gate-impl の両方で使用していること（symbol 一致）。加えて非 0 exit と retry 履歴文字列の出現を確認する。
- Q: PASS ケースの diff 内容は？
  - A: spec 201 P1-R4（複数行追加のみで構成される hunk）を満たす diff を使う。具体例: test ファイルに `+` のみ 2 行以上の新規 test block を追加する diff（`-` 行無し）。
- Q: FAIL ケースの核心攻撃ベクトルは？
  - A: spec 201 P1-R2（`-` 行を含む hunk）と P1-R3（`+` 1 行のみの hunk）を 1 ケースずつ検証する。assert 書換・削除・skip 化は全て `-` 行を伴うため P1-R2 に集約。「1 行追加」は P1-R3。test 1 本で両方を混在させた diff とし、FAIL 発生で十分（FAIL 理由文字列でファイル名/行番号を確認）。
- Q: ESCALATE ケースで retry 回数上限をどう再現するか？
  - A: fixture の flow.json 初期状態で `metrics["task-impl"].gateRetry` を上限値 (3) に設定して gate-impl を起動する。issue-log にも過去 FAIL エントリを載せ、retry 履歴文字列の出力を確認する。
- Q: post-hook counter 遷移の検証手順は？
  - A: 1 ケース内で 2 回 gate-impl を実行する（a: FAIL 発生 → counter +1 / b: 別 fixture で PASS 発生 → counter 0 リセット）。前後で flow.json を直接読み、`metrics["task-impl"].gateRetry` の値を assert する。
- Q: 実行時間許容値は？
  - A: 5 ケース合計で 30 秒以内を目標（subprocess 起動 × 5〜7 回を想定）。`npm test` 全体の regression にならない範囲とする。
- Q: stub provider の具体的な実装形式は？
  - A: Node.js 組み込みのみで実現。既存 `echo-agent` パターン（`command: "node"`, `args: [..., "{{PROMPT}}"]`）に倣い、固定 JSON を stdout に書き出す小さな JS スクリプトを helper 側で temp ファイルとして生成し、config.agent.providers から参照する。

## Alternatives Considered

- **unit test の拡充に留める**: 内部関数を直接呼ぶ unit test では `executeDiffBasedGate` ディスパッチや post-hook 配線の変更を検知できない。spec 201 acceptance criteria に反する。却下。
- **実 AI 呼び出し**: コスト増・flakiness・外部サービス依存のため却下。
- **複数ファイル分割（5 テスト → 5 ファイル）**: 全て同じ CLI 配線検証で fixture 共通化効果が大きく、1 ファイル集約が保守上優位。
- **in-process テスト（subprocess なし）**: `executeDiffBasedGate` を直接 import して呼ぶ案。しかし CLI dispatcher（`src/flow.js`）・registry・context 解決・hook 実行の配線まで検証できず、integration test の価値が半減する。却下。
- **ESCALATE 一致を「戻り値型（exception vs flag）の一致」で判定**: 既に spec 201 で「例外形式」に統一済みで、両者とも throw Error 形式。さらに識別子 symbol の一致まで担保することで、将来 refactor で片方のみ別 code に変更された場合を検知できる。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: gate PASS 後承認。以降 auto mode。

## Requirements

### R1: PASS wiring 検証（優先度 1）
When 既存 test ファイルに複数行（≥ 2 行、`-` 行無し）の新規追加のみを行う diff の状況で `sdd-forge flow run gate --phase task-impl` をサブプロセスで実行した場合, 実行結果は gate PASS（exit 0 かつ envelope `data.result === "pass"`）で shall ある。

### R2: FAIL wiring 検証（優先度 1）
When 既存 test ファイルに対し `-` 行を含む hunk あるいは `+` 1 行のみの hunk を含む diff の状況で `sdd-forge flow run gate --phase task-impl` をサブプロセスで実行した場合, CLI 出力 envelope は `data.result === "fail"` を含 shall み、FAIL 理由にはテストファイル名と行番号が含 shall まれる。
注: ここでの「FAIL」は CLI コマンドの失敗ではなく gate 評価結果を示す文字列である。CLI 自体は正常終了（envelope を出力）する。CLI 実行エラー（設定不足や内部例外）が発生した場合は既存の gate コマンド規約に従い非 0 exit code で終了 shall する。

### R3: ESCALATE end-to-end 検証（優先度 2）
When fixture の flow.json 初期状態で `metrics["task-impl"].gateRetry` を retry 上限値以上に設定した状態で `sdd-forge flow run gate --phase task-impl` をサブプロセスで実行した場合, プロセスは非 0 exit code で終了 shall し、stderr（または stdout）には過去 FAIL 回数と FAIL 理由を列挙する retry 履歴テキスト（spec 201 P2-R2 が要求する形式）が含 shall まれる。

### R4: post-hook counter 遷移検証（優先度 3）
If gate-impl サブプロセスが FAIL で終わった場合, 実行後の flow.json では `metrics["task-impl"].gateRetry` が実行前値から +1 増加 shall する。If gate-impl サブプロセスが PASS で終わった場合, 実行後の flow.json では `metrics["task-impl"].gateRetry` が 0 にリセット shall する。

### R5: ESCALATE エラー識別子の一貫性検証（優先度 4）
When gate-impl で retry 上限到達によりエスカレートする場合, 送出エラーの識別子は既存 `src/flow/lib/run-draft-task.js` で使用される `ESCALATE_RETRY_EXHAUSTED` と同一 shall である。本 requirement は R3 の実行で stdout/stderr に当該シンボル文字列が含まれることの検証と、`src/flow/lib/run-gate.js` および `src/flow/lib/run-draft-task.js` の両方で同一 symbol が使われていることの静的検証（ソースに対する grep ベースの unit assertion）の 2 つで担保する。

### R6: Stub provider helper（優先度 5）
When integration test が AI 呼び出し経路を通過する必要がある場合, テストは決定論的な固定応答を返す stub provider を構成する helper を使用 shall する。helper は Node.js 組み込みモジュールのみで実装 shall される（外部依存禁止ルール遵守）。

### R7: 実行時間上限（優先度 6）
When 本 spec で追加する全 integration test（5 ケース）を連続実行する場合, 累積実行時間は 30 秒以内で shall 完了する。

## Acceptance Criteria

- `tests/e2e/flow/gate-impl-integration.test.js` が存在し、5 ケース（R1〜R5 対応）を含む。
- `npm test -- tests/e2e/flow/gate-impl-integration.test.js` が全て PASS する。
- 5 ケース合計の実行時間が 30 秒以内である（手動計測または test runner のタイミング出力で確認）。
- Stub provider 構成 helper が `tests/helpers/` に追加され、Node.js 組み込みモジュールのみで実装されている。
- 既存 unit test（`tests/unit/flow/gate-test-change-check.test.js`, `tests/unit/flow/gate-retry-counter.test.js`）は変更されていない。
- 新規テストの故意の FAIL（gate-impl 配線を意図的に壊す実験）で確かに FAIL を検知できることを手元で確認済みであることを report.json に記録する。

## Test Strategy

本 spec 自体が「テスト追加」なので、追加するテストが本 spec の検証手段となる。以下の手順で validation する:

1. **ハッピーパス検証**: 正常な gate-impl 配線状態で 5 ケース全てが PASS することを確認する。
2. **故意 regression 検証**: `src/flow/lib/run-gate.js` の `executeDiffBasedGate` 内で `checkTestChanges` 呼び出しを一時的にコメントアウトし、R1 または R2 が FAIL することを確認（確認後 revert）。この手順は実装者が手動で行い report.json に結果を記録する。
3. **タイミング検証**: `time npm test -- tests/e2e/flow/gate-impl-integration.test.js` で 30 秒以内を確認。

## Open Questions

なし（draft で全て解決済み）。

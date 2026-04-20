# Feature Specification: 199-draft-task-production-wiring

**Feature Branch**: `feature/199-draft-task-production-wiring`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User request (Issue #189)

## Goal

addition origin の自律 draft 生成経路を scaffold 品質から production 品質へ引き上げる。具体的には次の 3 点を確立する。

1. 内部の最小 gate（見出し/非空のみの `simpleGate`）を削除し、guardrail AI 準拠判定を含む `task-spec` phase の full gate で draft を評価する。
2. gate FAIL 時、`gate.artifacts.reasons` を次回の draft 生成 prompt に専用セクションとして注入し、AI が失敗点を修正して再生成できるようにする。
3. `flow-impl` skill の Required Sequence に addition task 分岐を明記し、skill 自身が draft を生成せず `sdd-forge flow run draft-task --task-id <id>` に一本化する。

## Scope

- `src/flow/lib/run-draft-task.js`:
  - `simpleGate()` の削除。
  - retry ループ内で `RunGateCommand` を同プロセス内で呼び出し、`phase: "task-spec"` で draft を評価する。
  - `buildDraftPrompt(task, context, reasons)` に `reasons` 第 3 引数を追加し、非空時のみ `## Previous attempt failed — reasons` セクションを prompt 末尾（Rules セクション直前）に挿入する。
  - 本関数を module から export し、unit test から直接検証可能にする。
  - retry 時、直前の attempt の gate `reasons` を次回 prompt に渡す。
- `src/templates/skills/sdd-forge.flow-impl/SKILL.md`:
  - Required Sequence の先頭付近（既存の step 1 の前）に「Step 0: Addition task detection」を追加し、`tasks[]` 中に origin=addition かつ draft step 未完了のタスクがある場合に `sdd-forge flow run draft-task --task-id <id>` を呼ぶ手続きを明記する。
  - 既存の "Addition task draft (tool-driven)" セクションの説明を新手順への参照に差し替える。
- tests:
  - unit test `tests/unit/flow/run-draft-task.test.js`（新規または既存ファイルへ追加）で、`buildDraftPrompt` の reasons 有無分岐、retry ループの FAIL→PASS 遷移、`agent.resolve("flow.draft-task")` の default fallback 動作を検証する。

## Impact on Existing Features

- **`sdd-forge flow run draft-task` コマンド**: 内部 gate 評価ロジックのみ置換。CLI 引数、終了コード、JSON envelope の形式は不変。既存の呼び出し側（skill / 他 FlowCommand）への影響なし。
- **`SDD_FORGE_AGENT_STUB` 経路**: 契約維持。scaffold 互換テストは改変不要。
- **`task-spec` phase gate (`run-gate.js`)**: 読み取り専用利用のみ。gate 本体のロジック・インターフェースは変更しない。
- **`flow-impl` skill**: Required Sequence に addition task 分岐が追加されるが、通常 task 経路・既存の step 1〜4 には影響しない。
- **`agent.resolve()` / `matchProfilePrefix`**: 変更なし（既存の default fallback 機構を利用するのみ）。
- **その他 CLI コマンド（docs, setup, upgrade 等）・preset システム・docs パイプライン**: 影響なし。

## Out of Scope

- `agent.resolve()` の未登録 commandId 警告ロジック追加。
- `task-spec` phase gate 本体（`run-gate.js`）のロジック変更。
- `src/presets/*/config.json` 等の default `agent.providers` テンプレート更新。
- 既存 `SDD_FORGE_AGENT_STUB` 経路の削除。
- `flow.draft-task` 以外の commandId 経路への同様の配線適用。

## Clarifications (Q&A)

- Q: gate 呼び出しは同プロセス内か別プロセス (spawn) か?
  - A: 同プロセス内（`RunGateCommand.execute(ctx)` を直接呼ぶ）。既存 FlowCommand 全体が `container.get` で依存解決する統一パターンに従う。
- Q: FAIL reasons をどう prompt に組み込むか?
  - A: retry 時のみ `## Previous attempt failed — reasons` 専用セクションを追加。初回 prompt は現状維持。恒常 Rules との混在を避ける。
- Q: agent profile に `flow.draft-task` を明示登録するか?
  - A: 登録しない。`matchProfilePrefix` が最長一致ヒットなしで `agent.default` にフォールバックする既存実装に委ねる。unit test で非 null 解決を検証するのみ。
- Q: skill テンプレートの更新範囲は?
  - A: Required Sequence に手続き的ステップを追加する。既存の方針テキストは新ステップへの参照に置き換える。
- Q: FAIL reasons 伝播のテスト方式は?
  - A: `buildDraftPrompt` を export し unit test で直接検証する。stub 経路の入出力契約は変更しない。

## Alternatives Considered

- **別プロセス経由での gate 呼び出し (`spawnSync("sdd-forge", ["flow", "run", "gate", ...])`)**
  却下理由: 既存 FlowCommand は全て同プロセス内で container 経由に統一されており、例外扱いは一貫性を損なう。CLI 起動コストと stdout パースの複雑さも不要に増える。
- **FAIL reasons を恒常 Rules セクション末尾に追記する方式**
  却下理由: 恒常ルールと試行依存フィードバックが混在し、AI が「常に守るべきルール」か「前回の指摘」かを区別しにくくなる。専用セクションで構造的に分離する。
- **default `agent.providers` に `"flow.draft-task"` プレフィックスを明示追加**
  却下理由: 既存の default fallback で解決済み。冗長追加は alpha 版ポリシー「後方互換コードを書かない」と逆行し、挙動変化ゼロの保守負債を増やす。

## Why This Approach

- 既存 FlowCommand のパターン（container + 同プロセス呼び出し）に倣うことで、追加の依存関係・新しい抽象を導入せずに spec 198 (#186) で敷いた scaffold を production 化できる。
- FAIL reasons 注入を「retry 時のみ」「専用セクション」にすることで、guardrail "Unambiguous Requirements" を満たしつつ、AI に対する指示の恒常部と試行依存部を明確に分離する。
- agent profile 登録を行わないことで、ユーザー config の保守負担を増やさず、sdd-forge 内部の既定 fallback 機構を正しく活用する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: autoApprove モードで承認。spec 198 (#186) REQ-P3 の production 配線残作業として Issue #189 を spec 化。

## Requirements

要件の優先順位は記述順（P1 が最優先）。

1. **[P1]** When `flow run draft-task` が draft 生成を完了したとき、本コマンドは `RunGateCommand` を同プロセス内で `phase: "task-spec"` 指定で呼び出し、gate PASS (`result === "pass"`) のみを承認シグナルとして扱わなければならない。
2. **[P2]** When 上記 gate が FAIL を返したとき、retry ループは当該 FAIL の `artifacts.reasons` 配列を次回の `buildDraftPrompt` 呼び出しに渡し、`## Previous attempt failed — reasons` 専用セクションとしてプロンプトに注入しなければならない。初回 prompt には当該セクションを含めてはならない。
3. **[P3]** When `flow-impl` skill の Required Sequence 実行が addition task を検出したとき、skill は `sdd-forge flow run draft-task --task-id <id>` を呼び出し、gate PASS を確認してから後続ステップに進まなければならない。skill は自ら draft を生成してはならない。
4. **[P4]** When 自動テストが draft 生成プロンプト組み立てロジックを検証するとき、`buildDraftPrompt(task, context, reasons)` は module からの export により unit test から直接呼び出せなければならず、`reasons` の有無でプロンプト差分が生じなければならない。
5. **[P5]** When agent 設定が `agent.default` のみを持ち `flow.draft-task` に対する明示 profile エントリを持たない場合、`agent.resolve("flow.draft-task")` は default への fallback で非 null の resolved profile を返さなければならない。
6. **[P6]** When 既存の `SDD_FORGE_AGENT_STUB` が設定されているとき、本 spec の変更は当該経路の契約（env 経由の task 情報渡し、stdout の JSON `{draft: ...}` 返却）を破壊してはならない。
7. **[P7]** When 本 spec の実装が完了したとき、内部 `simpleGate` 関数は `src/flow/lib/run-draft-task.js` から完全に削除されていなければならない（alpha 版ポリシー: 後方互換シムを残さない）。
8. **[P8]** When retry ループが連続して gate FAIL を受け取った場合、ループは `config.flow.retry.max`（既定値 10）を上限として繰り返し、それを超えても PASS しない場合は `ESCALATE_RETRY_EXHAUSTED` エラーコードで終了しなければならない。当該上限は既存実装の挙動を引き継ぎ、本 spec で変更しない。
9. **[P9]** When 本コマンドが gate 評価またはリトライ上限到達で異常終了する場合、プロセスは非ゼロの exit code と JSON envelope の `ok: false` を返さなければならない。PASS 時のみ exit code 0 と `ok: true` を返す。

## Acceptance Criteria

- `SDD_FORGE_AGENT_STUB` 無しで `flow run draft-task` が実 provider 経由で draft を生成し、task-spec gate PASS で承認される経路が存在する。
- stub 経路で FAIL→PASS シーケンスを与えたとき、2 回目の `buildDraftPrompt` 呼び出しに 1 回目の reasons が含まれ、`attempts === 2` で PASS する。
- `flow-impl` SKILL.md の Required Sequence を読むだけで addition task 処理手順が追える。
- `buildDraftPrompt(task, context, null)` と `buildDraftPrompt(task, context, [{verdict:"FAIL",detail:"..."}])` のプロンプト差分が、末尾の `## Previous attempt failed — reasons` セクションの有無のみである。
- `simpleGate` のソース上の参照が消え、既存テストが全て PASS する。

## Test Strategy

- **unit (formal, `tests/unit/flow/run-draft-task.test.js`)**
  - `buildDraftPrompt` の reasons 有無分岐テスト: null 時は section なし、配列時は `## Previous attempt failed — reasons` セクションが挿入される。
  - `RunDraftTaskCommand.execute` を `SDD_FORGE_AGENT_STUB` で駆動し、1 回目は `## Goal` を欠く draft（gate FAIL 想定）、2 回目は完全な draft（gate PASS 想定）を返すシナリオで、`attempts === 2`、最終 gate PASS、task の draft step が `done` になることを検証。
  - `agent.resolve("flow.draft-task")` が `agent.default` のみ設定された config で非 null を返すことを検証。
- **unit (spec-scoped, `specs/199-draft-task-production-wiring/tests/`)**
  - skill テンプレートの Required Sequence に addition task 分岐記述が存在することを検証する static 検査テスト（Markdown 文字列の grep 相当）。
- **acceptance**
  - 実 provider を使った end-to-end 検証は手動確認とし、テスト自動化の対象外（guardrail "Bounded Resource Usage" の観点から AI 呼び出しを含む自動テストは追加しない）。

## Open Questions

（現時点で未解決事項なし。`buildDraftPrompt` の reasons 注入形式は、gate が返す `artifacts.reasons` のうち `verdict === "FAIL"` のエントリのみを抽出し、`- [FAIL] <guardrail_id>: <detail>` 形式の箇条書きでセクション本文を構成する方針で確定。）

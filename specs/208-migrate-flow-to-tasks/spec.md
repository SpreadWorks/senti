# Feature Specification: 208-migrate-flow-to-tasks

**Feature Branch**: `feature/208-migrate-flow-to-tasks`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #204

## Goal
cac6/T11 (最終タスク): 旧資産 (197 件の legacy flow.json + 280 件の legacy spec.md) を cac6/T2+T10 schema 互換の新形式へ一括変換する一度限りの migration スクリプトを提供し、自プロジェクトで結合検証する。

## Background
cac6 親計画の 11 タスク中最終段。T1 (#181) が spec.json schema と spec render を導入し、T2 (#183) が flow.json に tasks[]/currentTaskId を必須化し (FlowStore.load は未移行 flow を throw)、T10 (#203) が notes/metrics を top-level entry 配列に再配置した。本 T11 は T1-T10 の累積した schema 変更により load 不能になった過去の spec 資産を新形式へ変換する。スクリプトは specs/208-migrate-flow-to-tasks/ 配下に置き src/ 配下には置かない（一度限りの用途で npm パッケージ同梱対象外）。

## Scope
- specs/208-migrate-flow-to-tasks/migrate-flow-to-tasks.js の実装 (node 実行、--dry-run 対応)
- 197 件の旧 specs/*/flow.json を FlowStore.load() が受理する形式に変換 (tasks:[]/currentTaskId:null 追加、notes を [{taskId,text,ts}] 形式に正規化、metrics dict を entry 配列に正規化)
- 280 件の旧 specs/*/spec.md から spec.schema.json 互換の spec.json を生成 (H2 セクション抽出、欠損 required フィールドを空デフォルトで補完)
- dry-run による smoke test と unit テストの整備
- 自プロジェクトの specs/*/ 全件に対する結合検証 (適用後に FlowStore.load と loadSpecJson が全件成功)

## Out of Scope
- 旧 flat steps[] を task 内 step に再マップする変換 (現行本体が flat steps のまま運用されているため非互換)
- spec.md の削除 (spec render による再生成は別スコープ)
- historical sections (background/constraints/design_principles/alternatives_considered 等) の AI による内容補完
- flow.json.bak / spec.md.bak の生成 (git worktree 運用下で冗長)
- consumer project の specs/ への適用 (本プロジェクト自身のみが対象)

## Constraints
- 外部依存禁止 — Node.js 組み込みモジュールのみを使用する (project CLAUDE.md)
- alpha ポリシー — 後方互換 shim を書かない。旧形式との co-existence コードは残さない
- src/ 配下禁止 — スクリプトは specs/208-migrate-flow-to-tasks/ 配下に配置する (一度限りの用途、npm パッケージ同梱対象外)
- 過剰防御禁止 — システム境界 (CLI 入力) でのみ validation し、内部データは信頼する
- temporary files は SDD_FORGE_WORK_DIR / .tmp を使用する (project flow rule)
- 上限: specs/ 直下の N 個のディレクトリを走査する。N は実行時点で検出される数 (~285 件想定)。ネストした再帰探索や外部プロセス起動は行わない。file I/O は spec ごとに flow.json 1 + spec.md 読み 1 + spec.json 書き 1 の最大 3 回に限定する
- リトライなし — 失敗した spec は per-file skip してそのまま次へ進む (R12)。無限ループ防止

## Design Principles
- per-file fault isolation — 1 件の失敗で batch を止めない。warning を集約してバッチ完了後に AI が手動補完する
- idempotency — 既に新形式の spec は silent skip する。再実行が no-op になることで運用ミスによる破壊を防ぐ
- schema-driven validation — 生成した spec.json は書き込み前に src/flow/schemas/spec.schema.json で検証し、失敗時は部分書き込みしない
- 非 fabrication — 復元不可な historical information は空デフォルトのまま残す。検証不能な記述は guardrail『Unambiguous Requirements』に反する
- minimum surgical change — flat steps[] には触れない。T2/T10 の strict check を通すのに必要なフィールドのみを変換する

## Overview
### Modules
- specs/208-migrate-flow-to-tasks/migrate-flow-to-tasks.js — CLI エントリポイント。引数解析 (--dry-run)、specs/ 走査、flow.json / spec.md migrator の委譲、warning 集約、終了コード決定
- specs/208-migrate-flow-to-tasks/tests/migrate-flow-to-tasks.test.js — flow.json 変換 / spec.md パース / 冪等性 / schema validation の unit テスト (一度限り用途のため specs/ 配下に配置)
- migration 内部ロジック (同一ファイル内またはモジュール分割は実装判断) — migrateFlowJson(state), migrateSpecMd(markdown), runMigration(repoRoot, {dryRun})

### Data Flow
- CLI 起動 → specs/ ディレクトリ走査 → 各 spec に対し flow.json migrator と spec.md → spec.json migrator を順に適用 → schema 検証 → 書き込み (または dry-run の場合は差分出力) → warning 集約 → 終了
- flow.json migrator: JSON parse → tasks/currentTaskId 欠損補完 → notes[] 文字列配列を objects 配列に正規化 → metrics dict を entries 配列に正規化 → JSON.stringify 出力
- spec.md migrator: markdown 読込 → H2 セクション抽出 (Goal/Scope/Requirements 等) → spec.schema.json 各フィールドへマッピング → 欠損 required に空デフォルト → schema 検証 → spec.json 書き込み

### Decisions
- スクリプトを specs/208-migrate-flow-to-tasks/ 配下に配置 (src/ 不可)。一度限りの用途で npm 配布対象外
- flat steps[] は unchanged — 現実装が flat steps + tasks:[] 運用のため
- .bak を生成しない — git worktree のロールバック手段で十分
- schema 必須セクションに historical データが無い場合は空デフォルトで補完し fabrication しない
- per-file skip + warning 集約方式 — 477 件のバッチで 1 件の失敗が全体を止めないようにする

## Clarifications (Q&A)
- Q: spec.md → spec.json 変換は全 280 件実施するか？
  - A: Yes。全件実施する。自動化不可な warning は AI が手動で補完する。Rationale: Issue #181 (T1) の Out-of-Scope で T11 の責務として委譲されている。
- Q: 旧 flow.json の flat steps[] を task 内 step に再マップするか？
  - A: No。tasks:[] + currentTaskId:null の追加と notes/metrics の正規化のみ。Rationale: 現行実装 (FlowStore + 22 件の新形式 flow.json) が flat steps + tasks:[] で運用されているため、remap すると active flow が破損する。
- Q: .bak バックアップを作るか？
  - A: No。git worktree のロールバックに依存する。Rationale: alpha ポリシー『後方互換コードを書かない』と worktree 運用下での冗長性。
- Q: schema 必須セクションで spec.md に存在しないものの扱いは？
  - A: 空デフォルトで自動補完する。historical information は fabrication しない。Rationale: spec.schema.json の required は key の存在のみ要求し空値を許容する。加えて guardrail『Unambiguous Requirements』は検証不能な記述を禁じる。
- Q: テスト戦略は？
  - A: unit テスト + --dry-run smoke test。Rationale: 一度限りの migration であり広範な integration test のコストが回収できない。

## Alternatives Considered
- 旧 flat steps[] を TASK_STEPS_PLAN の task 内 step に remap する (Issue 記載の A 案) — 現行実装 (T5-T7) が flat steps を task 内に移す再構造化を実施していないため、remap すると active flow 全体が schema 非互換になる。現実装との整合性を優先して却下。
- spec.md の欠損セクションを AI が生成補完する — historical information は大半が失われており復元不可能。架空内容は検証不能で guardrail『Unambiguous Requirements』違反。却下。
- スクリプトを src/scripts/ 配下に配置する — 一度限りの用途で npm 配布対象外。ユーザー指示により却下。
- 最初のエラーで halt する — 477 件のバッチで 1 件の失敗が全体を止めるのは不適切。per-file skip + warning 集約方式を採用。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-21
- Notes: User enabled auto mode after draft approval; spec approved via autoApprove.

## Requirements
- R1 [must]: [P1] When the migration runs against a legacy specs/*/flow.json (lacking the tasks field), it shall transform the file so that FlowStore.load() accepts it under the T2/T10 strict checks.
- R2 [must]: [P1] When a specs/*/ directory lacks spec.json, the migration shall produce a spec.json that validates against src/flow/schemas/spec.schema.json.
- R3 [must]: [P1] When the migration is re-invoked on a spec that already satisfies the new schema, it shall make no changes to that spec (idempotent).
- R4 [must]: [P2] If a legacy flow.json carries a flat steps[] array, the migration shall leave the step list untouched.
- R5 [must]: [P2] When a legacy flow.json has notes as a string array, the migration shall convert each entry to an object of shape {taskId: null, text, ts} to satisfy the T10 strict validation.
- R6 [must]: [P2] When a legacy flow.json has metrics as a {[phase]: {[counter]: n}} dictionary, the migration shall convert it to a flat entry array compatible with T10 (each entry {phase, counter, value, taskId, ts}).
- R7 [must]: [P2] If a flow.json field is already in T10 shape, the migration shall not rewrite or reorder it.
- R8 [must]: [P3] When the migration parses a legacy spec.md, it shall map recognized H2 sections (Goal, Scope, Out of Scope, Requirements, Acceptance Criteria, Clarifications, Open Questions, Alternatives Considered, Background, Constraints, Design Principles, Overview) into the corresponding spec.schema.json fields.
- R9 [must]: [P3] When a schema-required field has no counterpart section in spec.md, the migration shall fill it with the empty default value and shall not fabricate historical content.
- R10 [must]: [P3] When the produced spec.json fails schema validation, the migration shall skip writing that file, emit a warning, and continue with the remaining specs (no partial spec.json persisted).
- R11 [must]: [P4] When the script is invoked with --dry-run, it shall report every intended change to stdout without writing any file.
- R12 [must]: [P4] If processing a single spec throws, the script shall log the failure and proceed with the next spec instead of halting the batch.
- R13 [should]: [P4] When the migration overwrites a file, it shall not create a .bak copy.
- R14 [must]: [P4] When a condition requires human follow-up, the script shall emit a warning to stdout and include the entry in an aggregated summary printed at the end.
- R15 [must]: [P5] When the script is added to the repository, it shall live under specs/208-migrate-flow-to-tasks/ and not under src/.
- R16 [should]: [P5] When the migration is invoked, it shall only process this repository's specs/ tree; consumer projects are out of scope.
- R17 [must]: [P1] When the batch completes with zero file-level failures, the script shall exit with status code 0. When at least one file failed to write or failed schema validation after a migration attempt, the script shall exit with a non-zero status code (exit 1) and print the aggregated failure summary to stderr.
- R18 [must]: [P1] When the script is invoked with invalid CLI arguments, it shall print usage to stderr and exit with a non-zero status code (exit 2).

## Acceptance Criteria
- node specs/208-migrate-flow-to-tasks/migrate-flow-to-tasks.js --dry-run が exit 0 で終了し、intended changes を stdout に出力する
- node specs/208-migrate-flow-to-tasks/migrate-flow-to-tasks.js (実行モード) が exit 0 で終了し、specs/*/flow.json 全件と specs/*/spec.json 全件が新形式で保存される
- migration 適用後、specs/*/flow.json 全 219 件 (既存新形式 22 件 + 移行対象 197 件) を FlowStore.load() で読み込むと throw なく成功する
- migration 適用後、specs/*/ 全 280+ ディレクトリで loadSpecJson() が spec.schema.json 検証を通過する
- 同じコマンドを 2 回実行しても差分が出ない (idempotency)
- tests/unit/specs/208-migrate-flow-to-tasks.test.js が PASS する (flow.json 変換 / spec.md パース / 冪等性 / schema validation のケースを網羅)
- .bak ファイルが生成されていない
- warning が出た spec については aggregated summary に記録され、AI が別途手動で対応する

## Implementation Targets
- specs/208-migrate-flow-to-tasks/migrate-flow-to-tasks.js
- specs/208-migrate-flow-to-tasks/tests/migrate-flow-to-tasks.test.js

## Open Questions
- [ ]

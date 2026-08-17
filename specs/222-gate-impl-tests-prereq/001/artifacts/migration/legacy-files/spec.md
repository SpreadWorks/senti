# Feature Specification: 222-gate-impl-tests-prereq

**Feature Branch**: `feature/222-gate-impl-tests-prereq`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #246

## Goal
- `sdd-forge flow run gate --phase task-impl` / `--phase integration` が head test evidence 未記録時に不可解に FAIL し retry カウンタを空消費する問題を解消し、ユーザーに具体的な復旧手順を提示する。

## Background
- gate の task-impl / integration フェーズは flow.json の `test.summary`（head）と `test.baseline` を AI の compliance checker プロンプトに渡す。
- `test.summary` は `sdd-forge flow run tests`（`--baseline` なし）が実行された場合にのみ populate される。
- 現行のスキル手順（impl 実装完了時）は「Run tests to verify: use the test command from package.json scripts or the project's test runner」と曖昧であり、ユーザーは `npm test` を直接実行しがちで、結果として head evidence が未記録のまま gate が呼ばれる。
- head evidence が無いと、AI は head 側の証拠なしで判断せざるを得ず、REQ-SPEC を FAIL させる。FAIL は retry カウンタを消費するため、ユーザーの retry 予算が浪費される。
- 追加の不整合として、plan/test フェーズのプロンプトが存在しないサブコマンド `sdd-forge flow get test-result` を参照している。

## Scope
- head test evidence 未記録時の gate 早期 FAIL（AI 呼び出し前）。
- 早期 FAIL 時の retry カウンタ非消費。
- 早期 FAIL 時の reason への復旧コマンド（`sdd-forge flow run tests` の旨）記載。
- impl / gate-impl のスキルプロンプト更新（`sdd-forge flow run tests` を事前実行する要件の明記）。
- plan/test のスキルプロンプトから存在しないサブコマンドへの参照を除去。

## Out of Scope
- gate-impl が内部で `flow run tests` を自動実行する挙動（Issue #246 提案 B）。
- baseline 未記録時の挙動変更（既存の警告処理を踏襲）。
- `sdd-forge flow get test-result` サブコマンドの新設。
- retry カウンタ自体の設計変更。
- 配布済みプロジェクトへの自動反映（`sdd-forge upgrade` の既存メカニズムに委ねる）。

## Constraints
- 既存の通常フロー（`flow run tests` → gate）で FAIL/PASS 判定挙動が変わらないこと。
- 早期 FAIL の reason は diff だけで PASS/FAIL を判定できる形式（テキストマッチ）で記述されること（REQ Diff-Verifiability）。
- 早期 FAIL が retry カウンタを消費しないことは、`flow.json` の gate retry 状態から検証可能であること。

## Design Principles
- 件数の妥当性評価は AI に委譲する（spec 209 と整合）。tool-side は「記録の有無」の 2 値のみ判定する。
- エラー reason にはユーザーが次に実行すべき具体コマンドを含める（Issue #246 提案 C）。
- プロンプト文言は現行の用語・構造を保持し、最小差分で修正する。

## Overview
### Modules
- `src/flow/lib/run-gate.js`: task-impl / integration フェーズの評価ロジック。
- `src/flow/prompts/impl/implement.md`: 実装完了時の手順。
- `src/flow/prompts/impl/gate-impl.md`: gate-impl 実行手順。
- `src/flow/prompts/plan/test.md`: test フェーズ手順。

### Data Flow
- 通常フロー: `flow run tests` が `state.test.summary` を populate → `flow run gate --phase task-impl` が summary を AI に渡す → AI が評価。
- 早期 FAIL フロー（新規）: `state.test.summary` が null → gate が AI 呼び出し前に synthetic FAIL を返す → retry カウンタ非消費。

### Decisions
- 早期 FAIL は gate が通常の FAIL envelope を返すが、retry カウンタ増分を行わない。既存の「retry を消費せず FAIL を返す」パターン（例: 無進捗再実行ガード）と同様の機構に合わせる。
- 早期 FAIL の reason 文字列は安定した部分文字列（`sdd-forge flow run tests` を含む）を持たせて diff-verifiable にする。

## Clarifications (Q&A)
- Q: 早期 FAIL は retry カウンタを消費すべきか？
  - A: 消費しない（ユーザーが 1 コマンドで解消できる環境問題であるため）。
- Q: `test.summary` が記録済みだが件数が少ないケースは？
  - A: 既存挙動を維持する（AI に委譲、tool-side は 2 値判定のみ）。
- Q: 早期 FAIL は draft/spec/task-spec フェーズでも発動すべきか？
  - A: task-impl と integration のみ発動する（これらが test evidence を読む唯一のフェーズ）。

## Alternatives Considered
- gate-impl が `flow run tests` を内部で自動実行する案 (Issue #246 提案 B): テスト実行コストが gate 内に埋め込まれ、ユーザー制御が失われるため採用しない。
- 早期 FAIL を warning に留める案: retry カウンタ空消費は解消されないため採用しない。
- SKILL.md に手順を追加するだけ（tool-side 変更なし）: 誤った手順で実行されたときに空 retry が発生するため、ユーザーの操作ミスに対する防御として不十分。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: Issue #246 推奨 A + C 採用。

## Requirements
- **REQ-1 [P1]**: `flow run gate --phase task-impl` または `--phase integration` 実行時に `state.test.summary` が null のとき、gate は AI 呼び出しを行わずに `result: "fail"` の envelope を返し、`reasons[]` に「head test evidence 未記録」旨と復旧コマンド `sdd-forge flow run tests` を含む文字列を 1 件含むこと。
- **REQ-2 [P1]**: REQ-1 の条件で早期 FAIL が返る場合、`flow.json` の gate retry カウンタが増分されないこと。
- **REQ-3 [P1]**: `flow run gate --phase draft` / `--phase spec` / `--phase task-spec` の挙動は、`state.test.summary` が null でも変更されないこと（従前と同じ経路で AI を呼ぶ）。
- **REQ-4 [P2]**: `src/flow/prompts/impl/implement.md` に、実装完了後に `sdd-forge flow run tests` を実行することで gate-impl 用の head test evidence が flow state に記録される旨が明記されていること。
- **REQ-5 [P2]**: `src/flow/prompts/impl/gate-impl.md` に、gate-impl 実行前に head test evidence が flow state に記録されている必要がある旨（もしくは未記録時に早期 FAIL が返る旨）が明記されていること。
- **REQ-6 [P3]**: `src/flow/prompts/plan/test.md` から、存在しないサブコマンド `sdd-forge flow get test-result` への参照が除去され、代わりに `sdd-forge flow run tests` が flow state に head evidence を記録する旨の記述に置き換わっていること。

## Acceptance Criteria
- AC-1: unit test: `state.test.summary = null`、`phase = "task-impl"` で gate を呼んだとき、AI を呼ばずに fail envelope を返し、reasons に `sdd-forge flow run tests` を含む。
- AC-2: unit test: AC-1 と同条件で gate 呼び出し前後に `flow.json` の retry カウンタが変わらないことを検証。
- AC-3: unit test: `phase = "draft"|"spec"|"task-spec"` では `state.test.summary = null` でも既存経路で動作する（早期 FAIL 経路を通らない）。
- AC-4: unit test: `state.test.summary` が非 null のとき、task-impl フェーズでも既存どおり AI 評価経路を通る。
- AC-5: `src/flow/prompts/impl/implement.md` をファイル検索すると `sdd-forge flow run tests` の文字列が含まれる。
- AC-6: `src/flow/prompts/impl/gate-impl.md` をファイル検索すると head test evidence 要件（「test evidence」または `flow run tests`）への言及が含まれる。
- AC-7: `src/flow/prompts/plan/test.md` にファイル検索しても `sdd-forge flow get test-result` が含まれない（置換済み）。

## Implementation Targets
- `src/flow/lib/run-gate.js`
- `src/flow/prompts/impl/implement.md`
- `src/flow/prompts/impl/gate-impl.md`
- `src/flow/prompts/plan/test.md`
- `tests/unit/flow/` 配下に新規テストを追加（ファイル名は実装時に決定）

## Open Questions
- なし

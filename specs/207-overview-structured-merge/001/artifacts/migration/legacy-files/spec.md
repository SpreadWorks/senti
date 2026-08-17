# Feature Specification: 207-overview-structured-merge

**Feature Branch**: `feature/207-overview-structured-merge`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #202 — [ENHANCE] [cac6/T9] overview structuring + deterministic merge for update-overview

## Goal

spec の overview 更新を決定論化する。task 完了時、AI は追加分のみを構造化出力し、CLI が由来 task を記録しつつ機械的に merge する。task 削除時にはその task が追加した entry のみを逆適用で除去できる状態にする。

## Scope

- overview エントリを構造化し、由来 task 識別子を保持できるデータ表現を導入する
- AI が overview 更新で出力する内容を差分追加のみに拘束する
- AI 追加分を由来 task と共に spec に反映する一貫した更新経路を提供する
- 由来 task 識別子による逆適用の挙動を提供する
- 既存サンプル spec を新構造へ移行し、ユーザーに見える既存内容を保存する
- 上記挙動を検証するユニットテストを追加する

## Out of Scope

- task 削除フロー自体（逆適用を呼び出す上位ワークフロー）
- AI を実呼び出しする自動統合テスト
- 他フィールド（requirements / clarifications 等）への由来 task 識別子の拡張
- 監査ログ等、逆適用以外の目的での由来 task 情報の利用

## Clarifications (Q&A)

- Q: overview エントリは category ごとにフィールド形状を変えるか。
  - A: 否。全 category 共通の flat 構造を用いる。category 固有フィールドは意味が薄く、派生 markdown との差分も最小になる。
- Q: AI の diff 出力は add 以外の操作（remove / modify）も含めるか。
  - A: 否。add-only に限定する。既存の検証＋反映 pattern と整合し、逆適用の前提（由来 task 識別子による除去）を崩さないため。
- Q: 由来 task 識別子は全エントリに必須か。
  - A: 否。optional。初期 entry や旧 spec 移行、外部 import 等の非 task 由来 entry を表現できる必要があるため。
- Q: 逆適用（task 削除時の entry 除去）は T9 でコマンド化するか。
  - A: 否。挙動そのものは独立して利用・検証できる形で提供し、task 削除フロー統合は後続課題とする。
- Q: update-overview の AI 呼出から spec 反映までの経路は分離するか。
  - A: 否。検証・記録・反映・派生 markdown 再生成までを一貫した挙動として扱う。外部（skill）からは単一のトリガで呼び出せる形を前提とする。

## Alternatives Considered

- **string[] のまま由来 task を別の parallel 配列で保持する**: 配列 index が entry と紐づく設計は、merge / filter 時に index 整合性を維持する複雑さが増し、schema 検証の恩恵も弱いため不採用。
- **full-file rewrite（AI が overview 全体を書き直す）**: 決定論性・逆適用性が両立しないため不採用。
- **派生 markdown に直接書き込む現行プロンプト案**: markdown を正にすると primary data と二重管理になり、cac6 の決定論化方針に反するため廃止。

## Why This Approach

- 既存の検証＋反映一括 pattern（gate）が「AI 出力を schema で拘束し、機械的に反映する」挙動を確立しており、update-overview にそのまま転用できる。
- 由来 task 識別子を optional にすることで、初期 entry や旧 spec 移行、外部 import 等の非 task 由来 entry を表現できる。逆適用は識別子一致のみを除去するため、optional 側 entry は誤って消えない。
- AI 出力の検証から spec 反映までを一貫した挙動として扱うことで、外部（skill）は薄い呼び出し層に留まり、cac6 全体方針（skill 薄化・CLI 集約）に整合する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: draft の Q1-Q6 A 案合意を承継。以降は auto モードで進行。

## Requirements

### Must（P1: overview データ構造）
- R1: When a spec's overview category entry is stored, it shall be a structured record containing the entry text and an optional origin-task identifier, rather than a bare string.
- R2: When an overview entry has no origin-task identifier, the schema validator shall accept it as valid.

### Must（P2: AI 出力の差分拘束）
- R3: When the overview-update step emits AI output, the output shall consist solely of additions grouped by overview category, with no remove or modify operations.
- R4: When the AI output does not conform to the additions-only schema, the step shall fail with a validation error and shall not apply partial changes.

### Must（P3: mechanical merge）
- R5: When AI-emitted additions are applied, the system shall stamp each added entry with the identifier of the task currently in progress before persisting.
- R6: When additions are merged, the merge operation shall append entries to the corresponding overview categories without mutating existing entries.
- R7: When merge completes, the derived spec markdown shall be regenerated so that the rendered overview reflects the new entries deterministically.

### Must（P4: reverse-apply primitive）
- R8: When the reverse-filter behavior is invoked with a task identifier against a spec, it shall return a spec whose overview excludes every entry carrying that identifier while leaving all other entries unchanged.
- R9: When the reverse-filter behavior is invoked with a task identifier that matches no entry, it shall return the spec unchanged.

### Must（P5: 非退行）
- R10: When the existing test suite is executed after this task, all prior tests shall continue to pass.
- R11: When the previously-committed sample spec (the T1 reference artifact) is loaded under the new schema, it shall validate successfully after migration, and its rendered markdown shall preserve the same user-visible overview content.

### Should（P6: 決定論の検証）
- R12: When identical AI additions are applied twice to the same starting spec and task context, the resulting spec content shall be byte-identical on both runs.

## Acceptance Criteria

- overview エントリが構造化レコードとなり、schema 検証で新形状が妥当、旧 string 形状が拒否される
- AI 出力 schema が additions-only 構造を拘束し、不適合時は非 0 exit で失敗する
- 追加 entry には現在進行中の task 識別子が自動付与される
- merge が既存 entry を変更せず append のみ行う
- merge 完了後に派生 spec markdown が再生成され、新 entry を含む出力が決定論的である
- 同 task 識別子を持つ entry のみを除去する逆適用が正しく動作し、不一致時は spec を変化させない
- 既存テストスイート全体が回帰なく pass する
- T1 のサンプル spec が新 schema で validate 成功し、派生 markdown のユーザー可視内容が保存される
- 同一入力の update-overview 二回適用結果がバイト一致する

## Test Strategy

- **schema 検証テスト:** 新 overview 構造の object 配列が validate 成功、string 配列が reject されること、`added_by_task` 欠落時に accept されることを検証する
- **AI 出力 schema 検証テスト:** additions-only 構造が accept、remove / modify 混入が reject、未知 category 混入が reject されることを検証する
- **merge 挙動テスト:** 既存 overview に AI additions を merge した結果が、由来 task stamp 付きで append され、既存 entry が変化しないことを検証する
- **reverse-filter 挙動テスト:** 指定 task 識別子を持つ entry のみが除去され、他 entry および識別子なし entry が維持されること、一致なしで spec が不変であることを検証する
- **render 決定論テスト:** 新 overview 構造を派生 markdown に render した結果が複数実行でバイト一致し、期待する bullet 表記を含むことを検証する
- **非退行:** プロジェクト共通テストスイート全体を pass させる
- **既存 spec 移行確認:** T1 サンプル spec を新 schema へ移行し、移行後 spec.json が validate 成功、派生 markdown の overview 可視内容が移行前と一致することを検証する

テストはプロジェクト共通の formal tests として配置する（将来どの spec で壊れても常にバグと言える性質のため）。spec 固有テストは作成しない。

## Authorized Existing Test Modifications

- `tests/unit/spec/schema.test.js` — overview fixture must migrate from bare strings to `{ text, added_by_task? }` objects to reflect the schema change introduced by R1. New overview-shape tests are additionally appended; existing behaviors (required-field, type-violation) remain covered.
- `tests/unit/spec/render.test.js` — sample fixture must migrate to the new overview entry shape so the renderer can be invoked. New tests asserting bullet-from-`item.text` rendering and the non-leakage of `added_by_task` are appended; previously-validated rendering behaviors remain covered.

## Open Questions

- なし（draft 時点で全 Q&A が合意済み）。

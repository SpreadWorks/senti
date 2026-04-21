# Draft: overview-structured-merge

**開発種別:** 機能追加（cac6 分解タスク T9 / Issue #202）

**目的:** spec の overview 更新を決定論化する。task 完了時、AI は追加分のみを構造化出力し、CLI が由来 task を記録しつつ機械的に merge する。task 削除時にはその task が追加した entry のみを逆適用で除去できる。

## Requirements

### 必須（T9 成立に必要）

**P1: overview データ構造**
- R1: When a spec's overview category entry is stored, it shall be a structured record containing the entry text and an optional origin-task identifier, rather than a bare string.
- R2: When an overview entry has no origin-task identifier, the schema shall accept it as valid (representing an initial entry authored during spec drafting).

**P2: AI 出力の差分拘束**
- R3: When the `update-overview` step emits AI output, the output shall consist solely of additions grouped by overview category, with no remove or modify operations.
- R4: When the AI output does not conform to the additions-only schema, the step shall fail with a validation error instead of applying partial changes.

**P3: mechanical merge**
- R5: When AI-emitted additions are applied, the system shall stamp each added entry with the identifier of the task currently in progress before persisting.
- R6: When additions are merged, the merge operation shall append entries to the corresponding overview categories without mutating existing entries.
- R7: When merge completes, the derived spec markdown shall be regenerated so that the rendered overview reflects the new entries deterministically.

**P4: reverse-apply primitive**
- R8: When a reverse-filter is invoked with a task identifier against a spec, it shall return a spec whose overview excludes every entry carrying that identifier while leaving all other entries unchanged.
- R9: When a reverse-filter is invoked with a task identifier that matches no entry, it shall return the spec unchanged.

### 必須（非退行）

**P5: 既存テスト非破壊**
- R10: When the project's existing test suite is executed after this task, all prior tests shall continue to pass.
- R11: When the previously-committed sample spec (used as the T1 reference artifact) is loaded under the new schema, it shall validate successfully after migration, and its rendered markdown shall preserve the same user-visible overview content.

### Should（品質担保）

**P6: 決定論の検証**
- R12: When identical AI additions are applied twice to the same starting spec and task context, the resulting spec content shall be byte-identical on both runs.

## Scope

### In Scope
- overview エントリの構造化と、由来 task 識別子を保持できるデータ表現
- AI が overview 更新で出力する内容を差分追加のみに拘束する仕組み
- AI 追加分を由来 task と共に spec に反映する一貫した更新経路
- 由来 task 識別子による逆適用の挙動
- 既存サンプル spec の新構造への移行と、ユーザーに見える既存内容の保存
- 上記挙動を検証するユニットテスト

### Out of Scope
- task 削除フロー自体
- AI を実呼び出しする自動統合テスト
- 他フィールド（requirements / clarifications 等）への由来 task 識別子の拡張
- 監査ログ等、逆適用以外の目的での由来 task 情報の利用

## Q&A

- Q1: overview エントリの構造は flat object か、category ごとにフィールドを分けるか。
  - A1: flat object を全 category 共通で採用。category 固有フィールドは data_flow / decisions で意味が薄く、render の差分も flat のほうが最小。
- Q2: AI の diff 出力形式は add-only か、add+remove か、full CRUD か。
  - A2: add-only。既存 gate の「AI は既知要素のみ評価し新規作成しない」pattern と整合。remove は由来 task による逆適用で deterministic に可能、modify をサポートすると逆適用の前提が崩れるため不採用。
- Q3: 由来 task 識別子の必須性と既存 spec 移行方針。
  - A3: optional。既存 entry は識別子を持たない形で移行し、初期 entry は逆適用の対象外とする。全 entry に sentinel 値を強制する案は T9 の用途に対し過剰。
- Q4: reverse-apply の実装範囲。
  - A4: 逆適用の挙動そのものを提供し、task 削除フローとの統合は T9 範囲外。「逆適用を可能にする」= 挙動を単独で利用・検証できる状態にする意味と解釈。
- Q5: update-overview の適用フロー。
  - A5: AI 出力の検証、由来 task の記録、spec への反映、派生 markdown の再生成までを一貫した挙動として扱い、外部（skill）からは単一のトリガで呼び出せる形を前提とする。既存 gate の検証＋反映一括 pattern および cac6 の skill 薄化方針に整合。
- Q6: テスト戦略。
  - A6: pure 関数のユニットテストに限定。AI を呼ぶ CLI 統合テスト（agent mock）は既存 gate / review にも先例が薄く、T9 では既存パターンと同等の信頼度で運用。

## Alternatives Considered

- **string[] のまま由来 task を別の parallel 配列で保持**: 配列 index が entry と紐づく設計は、merge / filter 時に index 整合性を維持する複雑さが増し、schema 検証の恩恵も弱い。採用せず構造化する。
- **full-file rewrite 方式**: AI が overview 全体を書き直す案。決定論性・逆適用性が両立しないため不採用。
- **spec 派生 markdown に直接書き込む現行プロンプト案**: markdown を正にすると primary data と二重管理になる。cac6 の決定論化方針に反するため廃止。

## Why This Approach

- 既存の検証＋反映一括 pattern（gate）が「AI 出力を schema で拘束し、機械的に反映する」挙動を確立しており、update-overview 挙動にもそのまま転用できる。
- 由来 task 識別子を optional にすることで、初期 entry や旧 spec 移行、外部 import 等の非 task 由来 entry を表現できる。逆適用は識別子一致のみを除去するため、optional 側の entry は誤って消えない。
- AI 出力の検証から spec 反映までを一貫した挙動として扱うことで、外部（skill）は薄い呼び出し層に留まり、cac6 の全体方針（skill 薄化・CLI 集約）に整合する。

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-04-21
- Notes: Q1-Q6 すべて A 案（推奨案）で合意。

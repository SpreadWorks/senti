# Feature Specification: 196-spec-json-schema-render

**Feature Branch**: `feature/196-spec-json-schema-render`
**Created**: 2026-04-19
**Status**: Draft
**Input**: GitHub Issue #181 — [ENHANCE] [cac6/T1] Introduce spec.json schema + spec render command

## Goal

spec をプライマリデータとして扱うための基盤を整備する。spec 内容を構造化する JSON スキーマを導入し、その JSON から現行の spec.md を派生生成できる新規コマンドを追加する。後続タスク T8 で既存コードを spec.json 読み書きに置換できるよう、既存の spec.md 読み書き箇所を I/F レベルで調査して成果物としてまとめる。

## Scope

- spec を表現する JSON Schema を新規定義し、cac6 親ドラフトで合意した基本 6 フィールド（goal / scope / constraints / design_principles / overview / background）に加え、既存 spec.md を完全に再現するため追加 5 フィールド（requirements / acceptance_criteria / clarifications / alternatives_considered / open_questions）を含む 11 フィールドを規定する。
- spec.json を入力として spec.md を派生生成する新規 CLI コマンドを追加する。active flow 配下の spec.json を自動解決し、同ディレクトリの spec.md を上書きする。
- 本 spec (196) の spec.json サンプルをコミットし、レンダラの実動作確認と T8 の参照実装とする。
- ソースツリー中の spec.md 読み書き箇所を全件調査し、T8 置換方針とともに表形式の成果物として spec 配下に残す。
- レンダラおよびスキーマ検証の挙動を共通テストスイートで検証する。

## Out of Scope

- 既存コード（spec 初期化コマンド、flow コマンド群、docs コマンド群、metrics など）の spec.md 読み書き経路の置換。これは T8 のスコープ。
- 既存 spec.md の spec.json への一括マイグレーション。cac6 全体計画のマイグレーションスクリプトに含まれる。
- spec.schema.json のバージョニング機構（将来のフィールド追加に備える version フィールド等）。
- AI エージェントが request から spec.json を生成するプロンプト設計。これは後続タスクに属する。

## Clarifications (Q&A)

- Q: スキーマに含めるフィールドは cac6 合意の 6 フィールドのみにするか。
  - A: 否。既存 spec.md にある 5 セクション（requirements / acceptance_criteria / clarifications / alternatives_considered / open_questions）も含めて 11 フィールドとする。T8 置換時の情報欠損を防ぐため。
- Q: レンダラは CLI 引数で spec.json パスを要求するか。
  - A: 否。active flow から自動解決する既存 flow コマンドの設計に揃える。手動指定も可能にする。
- Q: レンダラ出力は決定論的でなければならないか。
  - A: 是。同一入力から常に同一 spec.md が得られること。タイムスタンプやランダム順序を含めない。
- Q: 既存 spec.md のレイアウトと揃えるか。
  - A: 是。T8 で実データに切り替える際にレビュー差分が最小化されるよう、現行セクション順と見出しを維持する。
- Q: 本タスクで既存 spec.md 読み書き経路に手を入れるか。
  - A: 否。Issue の「実置換は T8」指示に従い、調査成果物の作成まで。

## Alternatives Considered

- **spec.md をプライマリに残し spec.json を補助データに留める案:** cac6 親ドラフトの決定論化方針と相反するため不採用。
- **本タスクで spec.md 読み書き箇所の置換まで行う案:** Issue の分解単位（T1 と T8 の分離）に反するため不採用。また変更範囲が大きくなり gate の単一責任チェックに抵触する。
- **基本 6 フィールドのみでスキーマを定義する案:** 既存 spec.md の一部セクションを表現できず、T8 置換時に情報欠損するため不採用。

## Why This Approach

- cac6 親ドラフトで合意済みの「spec.json をプライマリ化する」方針の最小起点として、スキーマとレンダラだけを先に用意する構造が適切。既存経路は不変なので並行開発が可能。
- active flow からの自動解決はプロジェクトの既存 flow コマンドのパターンを踏襲し、ユーザーの認知負荷を追加しない。
- 決定論的出力は cac6 の「再現性のゴール L3（構造完全一致）」を満たすための必須要件。
- 既存 spec.md のセクション順を保つことで、T8 で生成物を実データに切り替えた際の diff がコンテンツ差分のみに絞られ、レビュー容易性が確保される。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: 承認。以降は auto モードで進行。

## Requirements

**Must（T1 成立に必須）:**
- R1: When the new spec JSON schema artifact is inspected, it shall define the 11 fields (goal / scope{in,out} / constraints / design_principles / overview{modules, data_flow, decisions} / background / requirements / acceptance_criteria / clarifications / alternatives_considered / open_questions) with type constraints.
- R2: When `sdd-forge spec render` is invoked inside an active flow without arguments, the command shall resolve the current spec.json and overwrite the sibling spec.md.
- R3: When `spec render` is invoked against the same spec.json twice, it shall produce byte-identical spec.md output (deterministic, no timestamps or ordering variance).
- R4: When the project's existing schema validator is applied to an object missing any required field defined in the new spec schema, it shall return at least one error for each missing required field.

**Must（非退行）:**
- R7: When the existing test suite is executed after this task, all prior tests shall continue to pass (no regression in behavior of existing spec and flow commands).
- R8: When the rendered spec.md is diffed against the existing init-generated skeleton structure, every skeleton section heading shall be present in the output in the same relative order. Additional new headings introduced by cac6 (Background / Constraints / Design Principles / Overview) may be inserted between existing ones as long as the relative order of skeleton headings is unchanged.

**Should（T8 のための成果物として要る）:**
- R5: When this task is complete, a sample `spec.json` for spec 196 shall exist in the spec directory and shall render without error via `spec render`.
- R6: When this task is complete, an `interface.md` document shall exist in the spec directory listing every source file currently reading or writing spec.md, the fields it touches, and a proposed T8 migration approach for each entry.

## Acceptance Criteria

- spec.json スキーマファイルが存在し、11 フィールドの型制約を定義している。
- `sdd-forge spec render` が active flow 内で引数なしに動作し、対応する spec.md を上書きする。
- 同一 spec.json に対する連続実行結果がバイト一致する。
- 既存のスキーマ検証ユーティリティが、必須フィールド欠落に対して期待通りエラーを返す。
- 既存テストスイート全体が回帰なく pass する。
- 本 spec の spec.json サンプルがコミットされ、レンダリング成功を確認できる。
- interface.md が、spec.md を読み書きする全ソースファイルと T8 置換方針を網羅している。
- レンダラの振る舞いとスキーマ検証についてのユニットテストが追加され、happy path をカバーしている。
- 新規コマンドは失敗時に非 0 exit code を返す。

## Test Strategy

- **レンダラ振る舞いテスト:** 複数パターンの spec.json フィクスチャ（全フィールド揃った完全版 / オプションフィールド欠落版 / 空配列を含む版）を入力として、期待 spec.md 文字列と一致することを検証。決定論性の確認として、同一入力から 2 回レンダリングした結果のバイト一致も検証する。
- **スキーマ検証テスト:** 必須フィールド全揃い（エラー 0 件）、必須フィールド欠落（各欠落に対応するエラー発生）、型違反（数値を期待する箇所に文字列を渡す等でエラー発生）、オプションフィールド欠落（エラー 0 件）の 4 パターンを検証。
- **回帰保証:** プロジェクト共通テストスイート全体を pass させ、既存 spec / flow / docs コマンドの挙動に変化がないことを確認する。
- **統合動作確認:** 本 spec の spec.json サンプルから `spec render` を実行し、結果が期待通りの spec.md になることを手動および CI で確認する。

テストはプロジェクト共通の formal tests として配置する（将来どの spec で壊れても常にバグと言える性質のため）。spec 固有テストは作成しない。

## Open Questions

- なし（draft 時点で全 Q&A が合意済み）。

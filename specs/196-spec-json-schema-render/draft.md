---
issue: 181
parent: cac6
---

**開発種別:** ENHANCE (基盤整備)

**目的:** spec をプライマリデータとして扱うための基盤として、spec 内容を構造化する JSON スキーマを定義し、その JSON から現行の spec.md を派生生成できるコマンドを追加する。cac6 分解タスク 1/11。本タスクでは既存 spec.md 読み書き箇所の I/F 調査までを行い、配線置換は T8 に委ねる。

## 探索の要約（事前調査）

Q&A 前に以下を確認済み:

- **cac6 親ドラフト:** 「spec 作成の決定論化」「各 step output の schema 拘束」節で、spec.json をプライマリ化し spec.md を派生物とする方針、既存スキーマ検証機構の再利用が合意済み。
- **既存 spec.md 構造:** spec 初期化コマンドが生成する skeleton を観察し、現行セクション（Goal / Scope / Out of Scope / Clarifications / Alternatives / User Confirmation / Requirements / Acceptance Criteria / Open Questions）を把握済み。
- **既存スキーマ検証:** プロジェクトに汎用 JSON Schema 検証ユーティリティが既に存在し、本タスクで再利用可能であることを確認済み。
- **spec.md 参照箇所:** ソースツリーに対する全文検索で 11 ファイルが spec.md を読み書きしていることを検出。これらは T8 の調査対象として interface.md に列挙する。

## Q&A

各 Q&A の選択肢と推奨理由は、上記探索で得た事実と cac6 親ドラフトの合意を根拠としている。

### Q1: Issue の理解確認
- 根拠: Issue #181 本文の Scope 記述および cac6 親ドラフトの T1 定義。
- A: [1] 承認。

### Q2: spec.json スキーマに含めるフィールドの範囲
- 根拠: cac6 親ドラフトは 6 フィールド（goal / scope / constraints / design_principles / overview / background）を必須とするが、既存 spec.md には他 5 セクション（requirements / acceptance_criteria / clarifications / alternatives_considered / open_questions）が存在し、T8 での置換時にこれらが抜けると情報欠損が発生する。
- A: [1] 11 フィールド全てを含める。

### Q3: レンダラの外部振る舞い
- 根拠: cac6 親ドラフトの「spec.md は spec.json から自動レンダリング」合意、および既存 flow コマンド群が active flow からパスを自動解決する設計パターン。セクション順を既存準拠とするのは T8 置換時のレビュー差分最小化のため。
- A: [1] active flow の spec.json を自動解決、同ディレクトリの spec.md を上書き、セクション順は既存準拠。内部実装形態は要件レベルから外す。

### Q4: 本タスク完了時の spec.json サンプル
- 根拠: T1 では既存コードが spec.json を生成・消費しないため、レンダラの動作証拠が別途必要。サンプルが無いと T8 担当者が挙動を確認できない。
- A: [1] 本 spec (196) の spec.json をサンプルとしてコミット。

### Q5: I/F 調査の成果物形態
- 根拠: T8 は別 flow として起動される想定で、その flow の context 自動取得に乗るのは spec 配下のドキュメント。メモを他所に置くと引き継がれない。
- A: [1] spec 配下に表形式でコミット。

### Q6: テスト戦略
- 根拠: レンダラ振る舞いとスキーマ検証は「将来どの spec で壊れてもバグ」と言える性質のため、プロジェクト共通の formal tests に置くのが CLAUDE.md のテスト配置ルールに合致。
- A: [1] 共通の formal tests として 2 種のテスト（render 振る舞い / schema 検証）を追加。spec 固有テストは不要。

## 既存への影響

- 既存の spec.md 読み書き挙動は本タスクでは変更しない。T8 で置換される。
- 新規追加物: spec スキーマ定義、レンダラコマンド、サンプル spec.json、I/F 調査ドキュメント、関連テスト。
- 既存コマンド（`sdd-forge spec init` / `flow *`）の挙動・I/F は不変。
- 既存の `specs/*/spec.md` は手書きのまま残存。

## 制約

- alpha 方針に従い後方互換シムは導入しない。
- 外部依存は追加しない（Node.js 組み込みのみ）。スキーマ検証は既存ユーティリティを流用する。
- 配布コード配下にプロジェクト固有情報を書かない。

## Requirements（優先度順）

**Must（T1 成立に必須）:**
- R1: When the new spec JSON schema artifact is inspected, it shall define the 11 fields (goal / scope{in,out} / constraints / design_principles / overview{modules, data_flow, decisions} / background / requirements / acceptance_criteria / clarifications / alternatives_considered / open_questions) with type constraints.
- R2: When `sdd-forge spec render` is invoked inside an active flow without arguments, the command shall resolve the current spec.json and overwrite the sibling spec.md.
- R3: When `spec render` is invoked against the same spec.json twice, it shall produce byte-identical spec.md output (deterministic, no timestamps or ordering variance).
- R4: When the project's existing schema validator is applied to an object missing any required field defined in the new spec schema, it shall return at least one error for each missing required field.

**Should（T8 のための成果物として要る）:**
- R5: When this task is complete, a sample `spec.json` for spec 196 shall exist in the spec directory and shall render without error via `spec render`.
- R6: When this task is complete, an `interface.md` document shall exist in the spec directory listing every source file currently reading or writing spec.md, the fields it touches, and a proposed T8 migration approach for each entry.

**Must（非退行）:**
- R7: When the existing test suite is executed after this task, all prior tests shall continue to pass (no regression in behavior of `spec init`, `flow prepare`, `flow run gate`, etc.).
- R8: When the rendered spec.md is diffed against the existing init-generated skeleton structure, section headings and their order shall be identical.

## Acceptance Criteria

- すべての Requirements が検証可能な形で満たされている（対応テストまたは実行結果が存在する）。
- `npm test` が全 pass する。
- T1 成果物のみで Issue #181 の Scope 4 項目が完了していることを確認できる。

## Alternatives Considered

- OOP クラスで実装する / 関数型で実装する等の内部構造は要件レベルの論点ではないため本 draft から除外。impl フェーズで CLAUDE.md「OOP による型表現」ルールに従って判断する。
- 本タスクで spec.md を機械生成経路に切り替える案は破棄（Issue の「実置換は T8」指示に反する）。

## Open Questions

- なし（全 Q&A で合意済み）。

- [x] User approved this draft
- Confirmed at: 2026-04-19

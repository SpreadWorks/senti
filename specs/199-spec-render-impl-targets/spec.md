# Feature Specification: 199-spec-render-impl-targets

**Feature Branch**: `feature/199-spec-render-impl-targets`
**Created**: 2026-04-20
**Status**: Draft
**Input**: GitHub Issue #190

## Goal

spec 198 で spec.json schema に追加された `implementationTargets` フィールドを、spec render が生成する spec.md に Implementation Targets セクションとして出力し、spec.json を primary source とするパイプラインの完結性を取り戻す。

## Scope

- spec.md 出力に Implementation Targets セクションを追加する。

## Out of Scope

- 他の docs/ 側レンダラやテンプレートの変更。
- `implementationTargets` の schema 定義の変更（spec 198 で確定済み）。
- spec.md → spec.json の逆方向変換。

## Clarifications (Q&A)

- Q: Implementation Targets セクションの挿入位置は？
  - A: Acceptance Criteria の直後、Open Questions の直前。実装対象の列挙は受け入れ条件と併読されるため近接配置が読み手のワークフローに沿う。
- Q: `implementationTargets` が空配列または未定義のときの挙動は？
  - A: セクションを常に出力し、他の optional 列挙セクションと同じプレースホルダを表示する。spec.md 全体の一貫性を保つ。

## Impact on Existing Features

- spec.md 出力に 1 セクション追加される。他セクションの内容・順序は変更しない。
- `implementationTargets` を未設定の既存 spec.json でも、他 optional 列挙セクションと同じプレースホルダ表示となる（挙動互換）。
- 既存のセクション末尾である Open Questions の相対位置は不変（新セクションは Open Questions の前に挿入）。
- CLI コマンド・オプションの意味変更は伴わない。

## Test Strategy

- テスト対象: `renderSpecMarkdown`（spec render の純粋関数層）の出力に対する自動テスト。
- テスト種別: unit test（既存の spec render 単体テストと同ディレクトリに追加）。
- 検証観点:
  - Happy path: `implementationTargets` に要素を含む spec 入力に対し、出力 Markdown に当該セクションが存在し、各エントリが項目として出現する。
  - Empty / undefined path: `implementationTargets` が空配列または未定義の spec 入力に対し、Implementation Targets セクションが出力され、プレースホルダのみが表示される。
  - Placement: 出力テキスト中で Implementation Targets が Acceptance Criteria の後、Open Questions の前に現れる。
  - Determinism: 同一入力で連続実行時に出力が byte-identical。
- 既存テスト: そのまま維持し、すべて通過することを確認する。

## Alternatives Considered

- 代替案 A — 空時セクション非表示: 既存 optional 列挙セクションと挙動が乖離し、出力レイアウトの一貫性を損なうため却下。
- 代替案 B — 空時 `(none)` 明示: 既存セクションのプレースホルダ規約と出力フォーマットが揃わず ad-hoc になるため却下。
- 代替案 C — セクションを Open Questions の後ろに配置（schema 定義順）: 読み手のワークフロー上、実装対象は受け入れ条件と併読されるため近接配置の方が優れる。却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: autoApprove モードで承認。gate PASS 後、ユーザー指示「後は auto で進めて」に従い [1] を選択扱い。

## Requirements

- R1 [P1]: spec.json に `implementationTargets` が設定されている場合、spec render は spec.md に Implementation Targets セクションを出力し、各エントリを列挙しなければならない。
- R2 [P1]: `implementationTargets` が空配列または未定義の場合、spec render は Implementation Targets セクションを出力し、他の optional 列挙セクションと同じプレースホルダを表示しなければならない。
- R3 [P1]: spec render が Implementation Targets セクションを出力する際、その挿入位置は Acceptance Criteria の直後かつ Open Questions の直前でなければならない。
- R4 [P2]: spec.json の内容が変化しない場合、spec render は連続実行で byte-identical な spec.md を出力しなければならない（決定性の維持）。
- R5 [P2]: 本改修後も既存の spec render 関連自動テストが全通しなければならない。

## Acceptance Criteria

- spec.json に `implementationTargets` を設定して spec render を実行すると、spec.md に Implementation Targets セクションが出力され、各エントリが項目として読み取れる。
- `implementationTargets` が未定義または空配列のとき、Implementation Targets セクションは出力され、既存セクションと同じプレースホルダのみが表示される。
- Implementation Targets セクションは Acceptance Criteria の直後、Open Questions の直前に位置する。
- 既存の spec render 関連自動テストが全通する。

## Open Questions

- [ ]

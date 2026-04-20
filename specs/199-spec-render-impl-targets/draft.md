---
issue: 190
---

# Draft: spec.md renderer に implementationTargets フィールドを反映

**開発種別:** enhancement
**目的:** spec 198 で spec.json schema に追加された `implementationTargets` フィールドを spec.md 出力に反映させ、spec.json を primary source とするパイプラインの完結性を取り戻す。

## 背景

spec 196 で spec.json を primary source 化し、spec render コマンドで spec.md を派生生成する構造が導入された。spec 198 (#186) で schema に `implementationTargets` (string 配列、optional) が追加されたが、spec render は未対応のため、spec.json に設定しても spec.md に出現しない。これにより spec.json を正、spec.md を派生物とする設計意図が破綻している。

## スコープ

- spec.md 出力に Implementation Targets セクションを追加する。

## スコープ外

- 他の docs/ 側レンダラやテンプレートの変更。
- `implementationTargets` の schema 定義の変更（spec 198 で確定済み）。
- spec.md → spec.json の逆方向変換。

## 設計判断

1. **セクション位置**: Acceptance Criteria と Open Questions の間に配置する。
   - 根拠: 既存の spec.md レイアウト方針では末尾に向かうほど実装寄りの情報を集める並びになっており、Open Questions はその末尾に置かれている。実装対象の列挙は受け入れ条件と併読されるため近接配置が読み手のワークフローに沿う。

2. **空配列/未定義時の挙動**: セクションは常に出力し、空のときはプレースホルダを表示する。
   - 根拠: 既存の optional 列挙セクション（Scope / Requirements / Acceptance Criteria 等）はいずれも未設定時に共通のプレースホルダを表示する挙動で統一されている。新セクションだけ挙動を変えると spec.md 全体の一貫性が損なわれる。

## 既存機能への影響

- spec.md 出力に 1 セクション追加される。
- `implementationTargets` を未設定の既存 spec.json でも、他 optional セクションと同じプレースホルダ表示となる。
- 既存のセクション順序は保たれる（新セクションは Open Questions の前に挿入されるため、末尾 Open Questions の位置関係は不変）。

## 制約

- 外部依存なし（Node.js 組み込みのみ）。
- 出力は決定的でなければならない（同一入力 → byte-identical 出力）。

## 要件（優先度付き）

- [P1] spec.json に `implementationTargets` が設定されている場合、spec render は spec.md に Implementation Targets セクションを出力し、各エントリを列挙しなければならない (shall)。
- [P1] `implementationTargets` が空配列または未定義の場合、spec render は Implementation Targets セクションを出力し、既存セクションと同じプレースホルダを表示しなければならない (shall)。
- [P1] spec render が Implementation Targets セクションを出力する際、その挿入位置は Acceptance Criteria の直後かつ Open Questions の直前でなければならない (shall)。
- [P2] spec.json の内容が変化しない場合、spec render は連続実行で同一の spec.md（byte-identical）を出力しなければならない (shall)。
- [P2] 本改修後も既存の spec render 関連自動テストが全通しなければならない (shall)。

## 受け入れ基準

- spec.json に `implementationTargets` を設定して spec render を実行すると、spec.md に Implementation Targets セクションが出力され、各エントリが項目として読み取れる。
- `implementationTargets` が未定義または空配列のとき、Implementation Targets セクションは出力されるが、既存セクションと同じプレースホルダのみが表示される。
- Implementation Targets セクションは Acceptance Criteria の直後、Open Questions の直前に位置する。
- 既存の spec render 関連自動テストが全通する。

## 代替案

- **代替案 A: 空時セクション非表示**: 却下。既存 optional 列挙セクションと挙動が乖離し、コードパターンの一貫性を損なう。
- **代替案 B: 空時 `(none)` 明示**: 却下。既存セクションのプレースホルダ規約（`-`）と出力フォーマットが揃わず ad-hoc になる。
- **代替案 C: セクションを Open Questions の後に配置（schema 定義順）**: 却下。読み手のワークフロー上、実装対象は受け入れ条件と併読されるため近接配置が優れる。

## 将来拡張

- `implementationTargets` は現在 string 配列だが、将来 `{ path, purpose }` 等の構造化オブジェクトに進化する可能性がある。その場合もリスト描画の format 関数差し替えで対応可能な設計とする。

## Q&A

- Q1: Issue #190 の内容で進めて良いか？
  - A: はい。
  - 根拠: Issue 本文の Background / Scope / Acceptance Criteria が明確で追加質問不要（Issue 参照）。
- Q2: セクション挿入位置は？
  - A: Acceptance Criteria と Open Questions の間（User 選択 [1]）。
  - 根拠: 既存コードパターンにおいて、実装詳細に近い情報は末尾の Open Questions 前に集積する配置が取られている。
- Q3: 空配列/未定義時の挙動は？
  - A: セクション常時出力、空時プレースホルダ（User 選択 [1]）。
  - 根拠: 既存の optional 列挙セクションと同じプレースホルダ表示に揃える（spec.md 全体の一貫性）。

## User Confirmation

- [x] User approved this draft
- Confirmed at: 2026-04-20

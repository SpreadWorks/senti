# Feature Specification: 217-fix-mermaid-line-breaks

**Feature Branch**: `feature/217-fix-mermaid-line-breaks`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #227

## Goal
- GitHub 上で壊れて表示されている `docs/internal_design.md` の mermaid 図を正しく描画できる形式に修正し、docs 生成パイプライン側で同種の再発を防ぐ。

## Background
- `docs/internal_design.md` の Module Dependencies mermaid 図（L64-90 付近）でノードラベル `[...]` の外にリテラル `\n` が置かれている。mermaid はラベル外の `\n` を改行として解釈しないため GitHub 上で壊れて表示される。
- `docs/ja/internal_design.md` は `<br/>` 形式で正しく書かれており、en 版のみ誤り。
- 誤りの出所は AI が `{{text}}` プロンプトで mermaid を生成する際のフォーマット逸脱。同プロンプトは `src/presets/` 配下の複数 template に存在するため、今後も同種の誤りが出る可能性がある。
- 出典: ultrareview bug_008（Issue #227）。

## Scope
- `docs/internal_design.md` 内 mermaid コードブロックのノードラベル外リテラル `\n` を除去し、mermaid 構文として有効な改行（`<br/>` をラベル `[...]` 内に含める）に置き換える。
- `src/presets/` 配下で mermaid 図を生成する `{{text}}` プロンプト（全言語ペア）に、ノードラベル内改行ルールを追記する。

## Out of Scope
- `docs/ja/internal_design.md`（既に正しい形式）。
- 既存 `docs/` 全体の再生成。
- mermaid 図そのもののレイアウト再設計。
- 生成結果の post-process validation 層追加（CLAUDE.md のコーディングルール「過剰な防御コード禁止」に従い見送り）。

## Constraints
- CLAUDE.md「外部依存なし」「alpha 版ポリシー: 後方互換コード禁止」「`src/` 禁止事項: プロジェクト固有情報を埋めない」を遵守する。
- prompt 追記は汎用的な指示にとどめ、特定プロジェクト固有のモジュール名や構造を含めない。
- 既存の unit/integration テストを壊さない。

## Design Principles
- 再発防止は「生成時の制約強化（prompt 指示）」で担保し、「出力後の検証層新設」は採用しない。
- 修正対象は `src/presets/**/templates/**/*.md` のうち mermaid を明示的に指示している `{{text}}` プロンプトに限定する（`mermaid` 文字列を含む prompt のみ）。

## Overview
### Modules
- `docs/internal_design.md`（プロジェクト本体の生成済みドキュメント。手動修正）
- `src/presets/base/templates/{en,ja}/overview.md`（汎用 mermaid flowchart 指示）
- `src/presets/node-cli/templates/{en,ja}/overview.md`（node-cli 向け flowchart 指示）
- `src/presets/node-cli/templates/{en,ja}/internal_design.md`（node-cli 向け module dependency graph 指示）
- `src/presets/webapp/templates/{en,ja}/database_architecture.md`（erDiagram 指示）
- `src/presets/webapp/templates/{en,ja}/auth_and_session.md`（sequenceDiagram 指示）
- `src/presets/laravel/templates/{en,ja}/auth_and_session.md`（sequenceDiagram 指示）
- `src/presets/symfony/templates/{en,ja}/auth_and_session.md`（sequenceDiagram 指示）

### Data Flow
- 本 spec はロジック変更を伴わない。docs 生成時（`sdd-forge docs text`）、更新後のプロンプトが AI に渡り、生成される mermaid 図が正しいラベル改行形式を採るようになる。
- `docs/internal_design.md` の既存テキストは `{{text}}` ディレクティブの外側の直接修正として反映。

### Decisions
- D1: prompt 追記は各 mermaid 指示の末尾に共通文言「Use `<br/>` inside `[...]` for line breaks in node labels; never place a literal `\n` outside a label.」（ja 版は同等の日本語訳）を追加する。
- D2: `docs/internal_design.md` は直接編集する。`sdd-forge docs text` を再実行して再生成はしない（差分を最小化し、他ノードに副作用を与えないため）。
- D3: preset 変更に伴う `sdd-forge upgrade` は本 spec 内で実行しない（プロジェクト内に sdd-forge 自身の skill/設定は存在するが、preset 変更は下流プロジェクト側の再 upgrade で反映されるのが通常のフロー）。

## Clarifications (Q&A)
- Q: mermaid プロンプトの追記文言は en/ja で完全一致させるか
  - A: 同等の意味の自然な言語訳とする（en は英文、ja は日本語）。片方のみ追加する選択はしない。
- Q: preset template で現在 `\n` を禁止する明示ルールはあるか
  - A: ない。本 spec で初めて追加する。
- Q: 他に mermaid 以外で同様のリテラル `\n` 問題が docs にあるか
  - A: 本 spec の scope 外。mermaid 固有の構文問題に限定する。

## Alternatives Considered
- Alt1: post-process validation で mermaid ブロック内の不正な `\n` を検出 → 却下。CLAUDE.md「過剰な防御コード禁止」、および validation ロジックの保守コスト増に見合わない。
- Alt2: `docs/internal_design.md` を `docs text` 再実行で再生成 → 却下。他ノードラベルに副作用を与える可能性があり、差分が不必要に広がる。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-23
- Notes: autoApprove eligible (score 21/24)

## Requirements
- R1: When `docs/internal_design.md` 内の mermaid コードブロック（```mermaid ... ```）をパースした場合、ノードラベル `[...]` の外側にクオートされていないリテラル `\n`（バックスラッシュ + n の 2 文字列）が出現してはならない（shall not contain literal `\n` outside node labels）。
- R2: When 次の列挙ファイルを変更した場合、変更後の `{{text({prompt: ...})}}` プロンプト文字列には「ノードラベル内で改行する場合は `<br/>` を `[...]` 内に含める／ラベル外にリテラル `\n` を書かない」旨の指示（en/ja の該当言語版）が含まれていなければならない（shall include in each listed file）。対象ファイル: `src/presets/base/templates/{en,ja}/overview.md`, `src/presets/node-cli/templates/{en,ja}/overview.md`, `src/presets/node-cli/templates/{en,ja}/internal_design.md`, `src/presets/webapp/templates/{en,ja}/database_architecture.md`, `src/presets/webapp/templates/{en,ja}/auth_and_session.md`, `src/presets/laravel/templates/{en,ja}/auth_and_session.md`, `src/presets/symfony/templates/{en,ja}/auth_and_session.md`。
- R3: When 本 spec の変更後に `npm test`（default scope: unit + integration）を実行した場合、exit code は 0 でなければならない（shall exit with code 0）。

## Acceptance Criteria
- AC1 (R1): `grep -n '\\\\n' docs/internal_design.md` を mermaid コードブロック範囲で確認した場合、ヒットが 0 件であること。
- AC2 (R2): `grep -Rn 'mermaid' src/presets/**/templates/**/*.md` で列挙される `{{text}}` プロンプトすべてに、ノードラベル改行ルールの指示文字列（en: `<br/>`、ja: `<br/>`）が含まれていること。
- AC3 (R3): `npm test` が exit 0 で完了すること。

## Test Coverage Rationale
- 本 spec の変更は (1) `docs/internal_design.md` の静的テキスト編集、(2) preset template 内 `{{text}}` プロンプト文字列への定型指示追記 の 2 種のみ。CLI・flow・scan・enrich のロジックには触れない。
- 新規ユニットテストを追加しない理由: プロンプト文字列の追記は AI 生成時の挙動変化を目的とした指示であり、生成器（外部 AI CLI）の出力をテストで固定することはできない。ドキュメント本文の静的修正は AC1 の grep 検証で十分カバーされる。
- 回帰防止: 既存 unit + integration テスト（baseline: exit 0）を `npm test` で再実行し、AC3 で担保する。

## Implementation Targets
- `docs/internal_design.md`
- `src/presets/base/templates/en/overview.md`
- `src/presets/base/templates/ja/overview.md`
- `src/presets/node-cli/templates/en/overview.md`
- `src/presets/node-cli/templates/ja/overview.md`
- `src/presets/node-cli/templates/en/internal_design.md`
- `src/presets/node-cli/templates/ja/internal_design.md`
- `src/presets/webapp/templates/en/database_architecture.md`
- `src/presets/webapp/templates/ja/database_architecture.md`
- `src/presets/webapp/templates/en/auth_and_session.md`
- `src/presets/webapp/templates/ja/auth_and_session.md`
- `src/presets/laravel/templates/en/auth_and_session.md`
- `src/presets/laravel/templates/ja/auth_and_session.md`
- `src/presets/symfony/templates/en/auth_and_session.md`
- `src/presets/symfony/templates/ja/auth_and_session.md`

## Open Questions
- （なし）

# Draft: 217-fix-mermaid-line-breaks

**開発種別:** bugfix
**目的:** GitHub 上で壊れて表示されている `docs/internal_design.md` の mermaid 図を、正しく描画される形式に修正する。併せて docs 生成パイプライン側で再発しないようにする。

## Requirements

- R1: When `docs/internal_design.md` 内の mermaid コードブロック（```mermaid ... ```）をパースした場合、ノードラベル `[...]` の外側にクオートされていないリテラル `\n`（2 文字列）が出現してはならない（shall not contain literal `\n` outside node labels）。
- R2: If mermaid 図を生成する `src/presets/**/templates/**/*.md` 内の `{{text({prompt: ...})}}` プロンプト文字列が変更対象となる場合、そのプロンプト文字列には「ノードラベル内で改行する場合は `<br/>` を `[...]` 内に含める／ラベル外にリテラル `\n` を書かない」旨の指示が含まれていなければならない（shall include an explicit line-break instruction）。
- R3: When 本 spec の変更後に `npm test`（unit + integration scope）を実行した場合、exit code は 0 かつ baseline（`flow.json` の `test.baseline`）と比較して新規 failing テストが発生してはならない（shall not introduce regressions）。

## Scope Verification
- In scope:
  - `docs/internal_design.md` 内で GitHub 上で壊れて表示されている mermaid 図の修正
  - mermaid 図を生成する preset templates（`src/presets/` 配下の該当する `{{text}}` プロンプト）の再発防止ガイド追加（全言語）
- Out of scope:
  - `docs/ja/internal_design.md`（Issue 記載通り既に正しい形式）
  - 既存 mermaid プロンプトの全面再設計
  - `docs/` 全体の再生成（対象ファイルのみ修正）
  - 生成結果の post-process validation 層追加（判断理由は Q&A 参照）

## Impact on Existing Features
- 影響ありの既存機能:
  - mermaid 図を生成する preset templates — プロンプト追記により今後生成される図が正しい改行形式になる。既に生成済みの docs/ には影響しない（再生成時のみ反映）
  - `sdd-forge upgrade` — preset templates 変更として差分検出される
- 影響なし:
  - CLI・flow・scan・enrich パイプラインのロジック
  - 既に生成済みの docs/ ファイル（再生成しない限り不変）

## Q&A
- Q: 修正対象は `docs/internal_design.md` の 1 箇所のみで十分か、mermaid 図全体を点検すべきか
  - A (decision): Issue 本文で明示されている箇所のみ。根拠: Issue 記載（ultrareview bug_008 で L64-90 付近が特定されている）と、ソース直接確認（`docs/internal_design.md` を全量読んで他ノードラベルにリテラル `\n` がないことを確認済み）。

- Q: `docs/ja/internal_design.md` も修正対象か
  - A (decision): 対象外。根拠: Issue 本文「docs/ja/internal_design.md は `<br/>` で正しく書かれている」という記載。

- Q: 再発防止は (a) prompt 側の指示追記か、(b) post-process validation 層追加か
  - A (decision): (a) prompt 側の指示追記。根拠: CLAUDE.md のコーディングルール「過剰な防御コードを書かない。内部インターフェースは信頼し、バリデーションはシステム境界でのみ行う」に従い、AI 生成結果の検証層新設は overengineering と判断。prompt 追記は既存の `{{text}}` 指示拡張として最小差分で実現可能。
  - Brainstorm/Decision の別: この判断は decision（ブレストではなく確定案）。

- Q: 修正対象 prompt はどのスコープか
  - A (decision): mermaid 図を生成するすべての `{{text}}` プロンプト（全言語ペア）。根拠: `src/presets/` 配下で `mermaid` を含む `{{text}}` 指示を grep で列挙し、同種の生成リスクがある全箇所を特定。個別に「ここだけ」と絞ると再発防止にならない。

- Q: `sdd-forge upgrade` / `docs build` を本 spec 内で実行するか
  - A (decision): しない。根拠: CLAUDE.md「`src/templates/` や `src/presets/` のテンプレートを変更した場合は `sdd-forge upgrade` を実行」は各プロジェクト側の話であり、本プロジェクト自身の `docs/internal_design.md` は spec 内で直接修正する。preset 側の変更反映はユーザー次第（通常の upgrade 手順で流れる）。

- Q: テスト戦略
  - A (decision): 既存テストが全件 green であることを維持。根拠: 変更は (1) docs の markdown テキスト編集と (2) preset template 内の prompt 文字列追加のみで、CLI/scan/enrich のロジックに触れない。新規ユニットテスト追加の必要性は低い。

## Open Questions
- （なし）

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-23
- Notes: autoApprove eligible (score 21/24)

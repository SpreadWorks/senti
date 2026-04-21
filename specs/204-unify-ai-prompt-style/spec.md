# Feature Specification: 204-unify-ai-prompt-style

**Feature Branch**: `feature/204-unify-ai-prompt-style`
**Created**: 2026-04-21
**Status**: Draft
**Input**: GitHub Issue #198

## Goal

sdd-forge が AI にユーザー向け質問・選択肢を生成させる際、文体・前提知識・選択肢提示形式を単一ソースのルールで規定し、モデル差に起因する出力ばらつきを抑える。

## Scope

- Skill 本体テンプレート（`src/templates/skills/sdd-forge.flow-plan/SKILL.md` / `sdd-forge.flow-impl/SKILL.md` / `sdd-forge.flow-finalize/SKILL.md`）への共通パーシャル include 配線追加。
- 新規共通パーシャル `src/templates/partials/ai-question-style.md` の作成。Issue e162 記載の 3 カテゴリ（文体 / 前提知識 / 選択肢提示）と、各カテゴリに少なくとも 1 組の good/bad 例を含める。
- 既存の include 基盤（`src/lib/include.js` の `resolveIncludes`）に再帰深度・総 include 数の上限を追加し、diamond include（同一 partial を複数経路から引くケース）を許容する循環検出に変更する。
- 既存テスト基盤への追加: include 展開ユニットテストの拡張と SKILL.md 配置整合性テスト。

## Impact on Existing Features

- **Skill 本体 3 ファイル（`src/templates/skills/sdd-forge.flow-plan/SKILL.md` / `sdd-forge.flow-impl/SKILL.md` / `sdd-forge.flow-finalize/SKILL.md`）**: 新規 include 行の追加のみ。既存の include 構成・既存本文は変更しない。deploy 後に共通パーシャル本文が SKILL.md に展開される。
- **`src/lib/include.js`**: 最大深度 8 / 最大 include 数 32 の上限を新設。既存呼び出し元（SKILL.md 生成経路）は実質的な影響なし（現状 include 階層 2-3 / 件数 10 件規模）。循環検出ロジックは `_seen` の ancestor-only スコープに変更するため、diamond include が許容されるようになる。これは現状の呼び出しパターンでは挙動差なし。
- **`src/flow/lib/get-step-instructions.js`** および `src/flow/lib/get-next-action.js`: 変更なし。Step instruction は raw のまま返す既存契約を維持する。AI は skill 起動時に読まれる SKILL.md 経由で共通パーシャルを受け取るため、step instruction 側での再配信は不要。
- **Step instruction テンプレート（`src/flow/prompts/` 配下）**: 変更なし。
- **配布**: `sdd-forge upgrade` は既存動作のまま、展開済み SKILL.md をプロジェクトに反映する。
- **対象外（無影響）の領域**: subagent プロンプト生成（`buildGuardrailPrompt` / `buildDraftPrompt` / review 関連 agent.call）、draft テンプレート構造（4a7d 領域）、CLI コマンド / オプション、docs 生成パイプライン。

## Out of Scope

- Subagent プロンプト生成ロジック（`buildGuardrailPrompt` / `buildDraftPrompt` / review 関連 agent.call プロンプト、層 C）の共通化。
- 4a7d が扱う draft template 構造や section 検証。
- Lint / guardrail DSL の拡張。
- AI 出力の性質テスト（LLM 非決定性のため自動化困難）。
- 既存 prompt / step instruction 本文の文言書き換え（新パーシャルの include 追加のみで既存本文は維持）。
- Step instruction 配信経路（`flow get next-action` 等）に対する include 展開機能追加。SKILL.md での配信で十分な範囲をカバーするため、実装コスト増に見合わない。

## Clarifications (Q&A)

- Q: AI が生成する質問・選択肢の発生源は 3 層（A: step instruction / B: skill 本体 / C: subagent プロンプト）あるが、対象をどこに絞るか。
  - A: 当初は層 A + 層 B を想定していたが、実装調査の結果、skill 起動時に SKILL.md (層 B) が必ず先に読まれるため、その中に共通パーシャルを含めれば skill 稼働中の全質問・選択肢生成は同じルールを参照できる。層 A の step instruction 個別配信に include を仕込む実装 (get-next-action.js 改修) は spec の読者価値を増やさず、実装コスト・テスト改変インパクトが大きいため対象外とする。層 C は設計が独立しており別 spec に分離。
- Q: 共通ルールをどう配置するか。
  - A: 単一パーシャル `src/templates/partials/ai-question-style.md` として保持し、SKILL.md 3 ファイルから include する。
- Q: パーシャルに含める制約カテゴリ。
  - A: Issue e162 記載の 3 カテゴリ（文体 / 前提知識 / 選択肢提示）＋各カテゴリに少なくとも 1 組の good/bad 例（few-shot）。
- Q: 自動テストの粒度。
  - A: 構造テストのみ（include 展開の正しさ、配置整合性）。
- Q: include 基盤 (`_seen`) の既存挙動はそのまま維持するか。
  - A: diamond include（同じ partial を複数経路から引く）を許容するよう ancestor-scoped に変更する。本 spec の直接要求ではないが、本 spec が導入する共通パーシャルが複数 SKILL.md から引かれる将来的な需要に備え、include 基盤を一度整理する方が得。ancestor-scoped 化後も循環検出（A → B → A）は維持され、既存テスト（"throws on circular reference"）は通る。

## Alternatives Considered

- **層 A（step instruction） + 層 B 両方に include 配線**: 当初採用案。ただし `flow get next-action` に include 展開を仕込むと、契約を「raw を返す」から「展開済みを返す」に変えざるを得ず、`tests/unit/flow/get-next-action.test.js` の既存 assertion (`content === onDisk`) が破れる。「テスト通過のために既存テストを修正しない」ルールとの衝突リスクがあり、実装コスト対効果も悪いため却下。SKILL.md で共通パーシャルを配信する路線で R2 の意図は満たされる。
- **層 C も統合スコープに含める**: gate/review 出力まで一貫改善できるが、JS 文字列ビルダの共通化は設計コストが高い。Single Responsibility 違反のため本 spec に含めない。
- **共通化せずテンプレート単位で個別記述**: DRY 違反。プロジェクト CLAUDE.md「同じパターンが 2 箇所以上で繰り返される場合、共通ヘルパーに抽出する」に反する。
- **4a7d と統合**: touch 領域が異なる。Single Responsibility に沿って分離。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: auto-approved via autoApprove mode

## Requirements

- **R1（P1）**: When skill 本体テンプレートがリポジトリに追加・編集される時、system shall 共通ルールの定義を単一の正規ソースパーシャル（`src/templates/partials/ai-question-style.md`）に保持し、SKILL.md から `<!-- include("@templates/partials/ai-question-style.md") -->` で参照する配線を維持する。
- **R2（P1）**: When SKILL.md を deploy する時、system shall 共通パーシャル本文を展開結果に含める。具体的には `src/templates/skills/sdd-forge.flow-plan/SKILL.md` / `sdd-forge.flow-impl/SKILL.md` / `sdd-forge.flow-finalize/SKILL.md` の 3 ファイルから共通パーシャルが include される。
- **R3（P2）**: When ユーザーが `sdd-forge upgrade` を実行する時、system shall 展開済み SKILL.md を対象プロジェクトの `.claude/skills/` 配下に反映する。
- **R4（P2）**: When リポジトリの `npm test` が実行される時、system shall 次の検査ケースを通過する:
  - R4.1: `src/lib/include.js` の `resolveIncludes` が最大再帰深度 8 階層超過で Error を throw するユニットテスト。
  - R4.2: `resolveIncludes` が最大総 include 数 32 件超過で Error を throw するユニットテスト。
  - R4.3: `resolveIncludes` が diamond include を正しく許容することを確認するテスト（32 件以内なら throw しない）。
  - R4.4: 配置整合性テスト — SKILL.md 3 ファイル全てから共通パーシャルが include されていることを静的に検証する。
- **R5（P2）**: When `resolveIncludes` が実行される時、system shall 再帰深度 8 階層・総 include 数 32 件を上限とし、超過時は Error を throw する。循環検出は ancestor-only スコープで行い、diamond include（同一 partial を複数経路から引くケース）は許容する。
- **R6（P3）**: When 共通パーシャル本文がコミットされる時、system shall 文体 / 前提知識 / 選択肢提示 の各カテゴリに少なくとも 1 組の good/bad 例を含み、避けるべき曖昧語リストは既存 guardrail `unambiguous-requirements` の vague adjective カテゴリと整合する。

## Acceptance Criteria

- **AC-1 (R1, R2)**: `src/templates/partials/ai-question-style.md` が存在し、SKILL.md 3 ファイル全てに `<!-- include("@templates/partials/ai-question-style.md") -->` の行がある。
- **AC-2 (R3)**: ローカルで `sdd-forge upgrade` を実行すると、対象プロジェクトの `.claude/skills/sdd-forge.flow-plan/SKILL.md` 等に共通パーシャル本文が展開されて現れる。
- **AC-3 (R4.1, R4.2, R4.3)**: `tests/unit/lib/include.test.js` に追加された深度超過 / 件数超過 / diamond 許容のテストケースが通る。
- **AC-4 (R4.4)**: `specs/204-unify-ai-prompt-style/tests/placement-integrity.test.js` が通る。
- **AC-5 (R6)**: 共通パーシャル本文内に、文体 / 前提知識 / 選択肢提示 の各カテゴリで少なくとも 1 組の good/bad 例が含まれる。

## Test Strategy

- **Unit tests**: `tests/unit/lib/include.test.js` を拡張し、`resolveIncludes` の新上限（深度 8 / 件数 32）と diamond 許容の動作を検証する。
- **Integration / placement tests**: `specs/204-unify-ai-prompt-style/tests/placement-integrity.test.js` で、共通パーシャルの存在 / SKILL.md からの include 配線 / 本文の 3 カテゴリ記載 / good・bad 例の存在を静的に検証する。
- **Manual verification**: `sdd-forge upgrade` を実行し、対象プロジェクトの skill 配布物に新パーシャル本文が反映されることを目視確認する（AC-2）。
- **AI 出力の性質テスト**: LLM 非決定性のため対象外。

## Open Questions

- 共通パーシャル内の good/bad 例の具体文面は、実装時に既存プロンプトとユーザーからの対話フィードバック（本 flow で観測した "選択肢ブロックに詳細説明を詰め込まない" 等）を踏まえて確定する。
- Step instruction 個別配信経路（`flow get next-action`）への include 展開は本 spec では導入しない。SKILL.md 経由配信で AI 側のコンテキストに共通ルールが入るため、step instruction 側は raw のまま配信する。将来的に SKILL.md 非経由の step instruction 配信需要が出た場合、別 spec で扱う。

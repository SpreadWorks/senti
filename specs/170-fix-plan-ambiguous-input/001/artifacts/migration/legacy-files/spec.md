# Feature Specification: 170-fix-plan-ambiguous-input

**Feature Branch**: `feature/170-fix-plan-ambiguous-input`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #136

## Goal

flow-plan スキルにおいて、曖昧入力（`#133`, `133` 等）の誤解釈を防止し、draft フェーズを必須化することで要件未確定のまま実装に進むことを防ぐ。

## Scope

1. SKILL.md テンプレート（`src/templates/skills/sdd-forge.flow-plan/SKILL.md`）のルール変更
2. `get-prompt.js`（`src/flow/lib/get-prompt.js`）から `plan.approach` プロンプト定義の削除
3. SKILL.md の step ID リストから `approach` の削除

## Out of Scope

- `flow get context` への `--exclude` オプション追加（analysis.json は specs/ を含まないため不要）
- `flow prepare` コマンドの変更
- `flow-auto` スキルの変更
- gate / spec / impl 以降のフロー変更
- `flow prepare --auto` オプション等の新規 CLI オプション追加

## Clarifications (Q&A)

- Q: draft vs spec 選択を廃止した場合、Step 1 は何になるか？
  - A: 「リクエスト解釈確認」ステップに置換する。AI がリクエストを解釈し、要約を提示してユーザーに確認を取る。

- Q: autoApprove 時に解釈確認は必要か？
  - A: 不要。auto が有効 = flow.json に request/issue が確定済みなのでスキップする。

- Q: `--exclude specs/**` オプションは必要か？
  - A: 不要。`flow get context --search` は analysis.json を検索するもので、specs/ は通常スキャン対象外。AI の振る舞いは SKILL.md ルールで制御する。

## Alternatives Considered

- **approach プロンプトを残して選択肢を変更する案**: draft の進め方選択等に変更する。しかし Issue の意図は「spec 直行の排除」なので、選択肢自体を廃止する方がシンプルで明確。
- **SKILL.md ルールのみ変更してプロンプトを残す案**: autoApprove 時に [1] 固定で動くので実質 draft 固定になるが、使われない選択肢が残り混乱の元。
- **`flow get context --exclude` CLI 拡張案**: analysis.json が specs/ を含まないため実効性がなく、不要。

## Why This Approach

approach 選択を廃止して解釈確認に置換する理由:
- Issue #136 が明確に「spec 直行を選択させない」「最初に要約確認を必須化」を要求している
- 「何をするか」を確認してから「どう作業するか」を決める順序が論理的
- 曖昧入力の解決はブランチ作成より前に行うべき（手戻り防止）
- autoApprove との整合性が取れる（確定済みならスキップ）

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: 全要件承認済み
- [x] User approved existing test modifications (get-prompt.test.js, prompt-i18n.test.js) as part of implementation approach approval (2026-04-13)

## Requirements

### P1: SKILL.md — Step 1 を「リクエスト解釈確認」に置換

1. **R1**: Step 1 の approach 選択（draft vs spec）を廃止する。draft フェーズは常に実行される。
2. **R2**: 新しい Step 1「リクエスト解釈確認」を追加する。AI はリクエストを解釈し、要約を提示してユーザーの確認を取る。
3. **R3**: 入力解釈ルールを SKILL.md に明記する:
   - `#<number>` → 常に GitHub Issue として優先解釈。`sdd-forge flow get issue <n>` を実行する。
   - `issue N` 等の明示的な形式 → Issue 扱い。
   - `spec N` / `specs/N-...` 明示時 → ローカル spec 扱い。
   - 数字のみ（例: `133`）→ 曖昧入力。確認質問を必須とする。
4. **R4**: 解釈確認が完了するまで `flow get context --search` を実行してはならない。
5. **R5**: `#<number>` の場合、まず `sdd-forge flow get issue <n>` を実行する。失敗時のみ「ローカル spec 参照へ切り替えるか」を確認する。

### P1: SKILL.md — autoApprove 時の動作

6. **R6**: `autoApprove: true` の場合、Step 1（解釈確認）をスキップする。request/issue が flow.json に確定済みであるため。

### P2: get-prompt.js — plan.approach プロンプト削除

7. **R7**: `get-prompt.js` の `PROMPTS_BY_LANG` から `plan.approach` エントリを ja/en 両方で削除する。

### P2: SKILL.md — step ID 更新

8. **R8**: SKILL.md の「Available step IDs (this skill)」から `approach` を削除する。

## Acceptance Criteria

- AC1: 曖昧入力（例: `133 を対応して`）を与えた場合、AI は確認質問を行い、無確認で先に進まない。
- AC2: `#133` を与えた場合、AI は GitHub Issue として解釈し、`flow get issue 133` を実行する。ローカル spec 探索へ誤遷移しない。
- AC3: `spec 133` を与えた場合、AI はローカル spec として解釈する。
- AC4: autoApprove モードで flow-plan に入った場合、解釈確認ステップはスキップされる。
- AC5: `sdd-forge flow get prompt plan.approach` を実行すると、unknown kind エラーが返る。
- AC6: draft フェーズは常に実行され、spec 直行の選択肢は存在しない。

## Test Strategy

### 自動テスト（AC5）
- `get-prompt.js` のコード変更に対するユニットテスト。`plan.approach` を指定した場合に unknown kind エラーが返ることを検証する。
- 既存の get-prompt テストがあれば、approach 関連のテストケースを更新する。

### 既存テスト更新の承認
- `plan.approach` プロンプト定義の**意図的な削除**（R7）に伴い、当該機能を検証していたテストは対象機能が存在しなくなる。これは「テストを無効化して通す」のではなく「削除された機能のテストを新しい動作のテストに置換」する正当な変更である。
- ユーザーは実装方針の提示時にこのテスト更新を含む方針全体を承認した（2026-04-13）。
- 変更対象:
  - `tests/unit/flow/get-prompt.test.js`: "returns structured choices for plan.approach" → "returns error for removed plan.approach kind" に変更（削除された機能がエラーを返すことを検証）
  - `tests/unit/flow/prompt-i18n.test.js`: plan.approach の i18n テストを plan.work-environment に置換（テスト対象の機能が削除されたため別の同等プロンプトでi18n動作を検証）、SKILL.md の approach 参照チェックを削除（参照先が意図的に削除されたため）

### 手動検証（AC1〜AC4, AC6）
- SKILL.md はスキルテンプレートであり、AI の振る舞いを定義するもの。自動テストでは検証できないため、以下の手動検証を行う。
- AC1: `sdd-forge flow-plan` を起動し、`133 を対応して` と入力。AI が確認質問を行うことを確認する。
- AC2: `sdd-forge flow-plan` を起動し、`#133` と入力。AI が `flow get issue 133` を実行することを確認する。
- AC3: `sdd-forge flow-plan` を起動し、`spec 133` と入力。AI がローカル spec として解釈することを確認する。
- AC4: autoApprove を有効にした状態で flow-plan に入り、解釈確認ステップがスキップされることを確認する。
- AC6: flow-plan 起動時に draft/spec の選択肢が表示されないことを確認する。

## Open Questions

（なし）

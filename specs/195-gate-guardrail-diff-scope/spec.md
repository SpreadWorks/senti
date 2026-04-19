# Feature Specification: 195-gate-guardrail-diff-scope

**Feature Branch**: `feature/195-gate-guardrail-diff-scope`
**Created**: 2026-04-19
**Status**: Draft
**Input**: Issue #180 — gate-impl guardrail が pre-existing コードで過剰検出する問題

## Goal

gate-impl の guardrail AI 判定において、現在の spec で変更されていない pre-existing コードに対する誤 FAIL を解消する。AI プロンプトの指示を拡張し、判定対象を diff 内の追加/変更行に起因する違反のみに限定する。

## Why This Approach

4 つの対応候補（diff スコープ prompt 拡張 / AI 出力 post-filter / `## Exemptions` 尊重 / `--override` 機構）を比較した結果、**diff スコープ prompt 拡張** を採用した。根拠:

- **信頼性:** 判定範囲を prompt 層で構造的に限定するため、AI 出力形式や人間判断に依存しない。
- **実装規模の小ささ:** 既存の guardrail prompt 生成関数の impl フェーズ向け role 文字列を拡張する単一箇所の変更で完結する。
- **プロジェクト方針適合:** alpha 期間の「後方互換コードは書かない」方針・「根本原因に対処する」方針と整合する。`## Exemptions` 尊重や override 機構は「逃げ道」として機能するが、誤検知そのものを消さず濫用リスクを生む。
- **auto mode 適合:** override フラグは auto mode で無効だが、prompt 拡張は auto mode でもそのまま機能する。

## Scope

- `src/flow/lib/run-gate.js` の `executeImpl` が `checkGuardrail` を呼び出す際に渡す role/指示文字列の拡張。
- `buildGuardrailPrompt` における impl フェーズ専用の指示強化（diff 内の追加/変更行に起因する違反のみを FAIL とする旨を明示）。
- impl フェーズの guardrail prompt に diff スコープ制約が含まれることを検証する formal unit test の追加。
- Issue #180 の再現シナリオに基づく手動再現テスト手順の `specs/195-gate-guardrail-diff-scope/tests/README.md` への記述。

## Out of Scope

- spec の `## Exemptions` セクションを gate AI に尊重させる改修。
- 明示的 `--override <reason>` フラグ等の CLI インターフェース追加。
- draft/spec フェーズの gate プロンプトの変更。
- guardrail 判定以外の impl gate ロジック（requirements 判定、test evidence 読み込み）への変更。
- guardrail 原則そのものの追加・削除・文言変更。

## Requirements

### Priority 1（必須）

- **R1:** When gate-impl が guardrail AI による違反判定を行うとき, the system shall 判定対象を diff 内の追加/変更行（`+`/`-` の変更部分）に起因する違反のみに限定するよう AI に指示する。
- **R2:** When 変更行に起因しない pre-existing コードのパターンが diff の前後コンテキスト行として AI に見えているとき, the system shall AI に対してそれらを違反判定の対象外として扱うよう明示的に指示する。
- **R3:** When impl フェーズ向けの guardrail prompt が生成されるとき, the system shall その prompt 文字列に diff スコープ制約の指示文言が含まれることを formal unit test で検証する。

### Priority 2（推奨）

- **R4:** When 本変更が適用されるとき, the system shall Issue #180 の再現シナリオ（impl フェーズの diff が数行の変更のみで、同ファイル内に guardrail 違反パターンを含む pre-existing 関数が存在するケース）を再現する手順を `specs/195-gate-guardrail-diff-scope/tests/README.md` に記述し、実行コマンドおよび期待結果（gate PASS であること）を明記する。

## Acceptance Criteria

- [ ] R1 を満たす: `src/flow/lib/run-gate.js` の impl フェーズ guardrail 呼び出しで、diff 内の追加/変更行に起因する違反のみを対象とする旨の指示が AI prompt に含まれる。
- [ ] R2 を満たす: pre-existing コード（unchanged context lines）を違反判定対象外とする旨の指示が AI prompt に含まれる。
- [ ] R3 を満たす: impl フェーズ prompt の diff スコープ制約を検証する formal unit test が `tests/` 配下に追加され、`npm test` で PASS する。
- [ ] R4 を満たす: `specs/195-gate-guardrail-diff-scope/tests/README.md` に再現シナリオの手順・コマンド・期待結果が記述されている。
- [ ] 既存テストスイート（`npm test`）が全て PASS する。
- [ ] 既存の exemption 関連テスト `tests/unit/specs/commands/guardrail.test.js` の判定方針（exemption セクションを無視する）は変更されていない。

## Impact on Existing Features

- **gate-impl:** guardrail AI 判定の prompt が拡張される。pre-existing コード起因の誤 FAIL が抑制されるが、本来 FAIL とすべき変更行起因の違反は引き続き FAIL となる。
- **gate-draft / gate-spec:** 影響なし。本 spec は impl フェーズの role 文字列のみを変更する。
- **requirements 判定（impl の `buildImplCheckPrompt`）:** 影響なし。別関数・別 prompt である。
- **既存テスト:** `guardrail.test.js` の exemption 無視方針は直交するため変更不要。`buildGuardrailPrompt` の単体テストは新しい指示文言が含まれることを追加検証する形で更新または拡張される可能性がある。
- **CLI 互換性:** 既存コマンド・オプションに変更なし。移行計画不要。
- **外部依存:** 追加なし。Node.js 組み込み API のみで完結する。

## Alternatives Considered

- **AI 出力 post-filter:** AI 出力から行番号を抽出し、diff の changed line 集合と照合して post-filter する方式。却下理由: AI 出力形式への依存が強く、出力パーサの保守性が低下する。
- **`## Exemptions` 尊重:** spec の exemption セクションを AI に尊重させる方式。却下理由: 現行テストで「exemption は無視する」方針が明示されており、これを覆すと spec 書き換えによる逃げ道が濫用される。AI が自分に都合よく exemption を解釈するリスクもある。
- **`--override <reason>` CLI フラグ:** 明示的な override 機構を追加する方式。却下理由: 誤検知そのものは残り、auto mode で無効になる（本 issue は auto mode で finalize がブロックされるのが主要症状）。

## Clarifications (Q&A)

- Q: 対応方針の選定（diff スコープ prompt 拡張、post-filter、Exemptions 尊重、override の 4 択）
  - A: diff スコープ prompt 拡張。信頼性と実装規模のバランスで最適と判断。
- Q: 検証アプローチ（formal unit test、spec-local 手動再現、両方の 3 択）
  - A: 両方採用。AI 挙動のうち決定論的に検証可能な部分（prompt 文字列の構造）は formal test、検証不能な部分（AI 判断そのもの）は spec-local の手動再現テストとして記録。
- Q: スコープ境界（impl フェーズのみか、他フェーズも含むか）
  - A: impl フェーズのみ。他フェーズには diff の概念がないため対象外。

## Open Questions

（なし）

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: Issue #180 対応として、diff スコープ prompt 拡張方式で承認。

# Draft: 218-spec-gate-json-fix

**開発種別:** bugfix
**目的:** parent spec gate (`flow run gate --phase spec`) が常に FAIL する不具合を解消し、検査対象を一次データである spec.json に揃える。

## Scope Verification
- In scope (priority order):
  - **R1 (must)**: When `flow run gate --phase spec` を実行したとき、parent spec gate は spec.md ではなく spec.json を一次データとして検査 shall。
  - **R2 (must)**: When parent spec の構造的整合性が満たされていないとき、parent spec gate は失敗事由を返却 shall（schema 違反は明確なエラーメッセージとして含まれる）。
  - **R3 (should)**: When parent spec の人間記述部に未解決トークン（`NEEDS CLARIFICATION` / `TBD` / `TODO` / `FIXME`）が残存するとき、parent spec gate は当該箇所を指摘 shall。
  - **R4 (should)**: When parent spec gate と task draft gate を呼び出すとき、入力フォーマットが異なる（spec.json vs markdown）ため、それぞれ独立した検査責務として実装上分離される shall。
- Out of scope:
  - phase=task-spec (task draft) の検査ロジック変更（task draft は依然 markdown 形式が一次データ）
  - phase=draft (parent draft.md) の検査
  - AI guardrail evaluation の挙動変更
  - spec.json schema 自体の変更

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow run gate` (phase=spec): `--spec` 省略時の常時 FAIL 不具合が解消される。spec.md パスを明示指定した場合も spec.json が解決されて正しく動作する。
  - parent spec gate のテスト群: 検査対象データ形式が変わるため再構成される。
- 影響なし:
  - phase=draft / task-spec / task-impl / integration の挙動
  - flow prepare / approval / review / finalize / sync 等の他フェーズ
  - AI guardrail evaluation 経路

## Q&A
- Q: なぜ markdown 検査を続けてはいけないのか？
  - A: spec.md は spec.json から自動 render される人間 read-only の派生物であり、一次データではない。`src/lib/spec-json.js` ヘッダにも "spec.md is a render-derived artifact and must not be parsed for content." と明文化されている。一次データを検査するのが正しい。
- Q: なぜ parent spec gate と task draft gate を分けるのか？
  - A: parent spec は spec.json (構造化データ)、task draft は markdown (テキスト) と入力フォーマットが本質的に異なる。共通関数で扱うと検査ロジックが分岐だらけになり責務が曖昧になる。
- Q: spec.json schema は既に存在するのに gate での検査の意味は？
  - A: schema validation で構造を担保した上で、人間記述部に残った「未解決トークン」を機械的に弾くことで、AI guardrail evaluation を呼ぶ前の軽量フィルタとして機能する。
- Q: 既存の markdown 検査テストはどうするか？
  - A: task draft gate (phase=task-spec) は引き続き markdown を検査するため、task draft 用として意味を保つテストは維持する。parent spec を markdown として検査する前提のテストは廃止する。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: 方針 B（spec.json 直接検査）、構造分割、検査内容（schema + token スキャン）で合意

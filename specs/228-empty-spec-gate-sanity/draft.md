# Draft: 228-empty-spec-gate-sanity

**開発種別:** bugfix
**目的:** 空の spec.json（goal=""、requirements=[]、acceptance_criteria=[]）が spec gate を PASS してしまうバグを修正する。AI guardrail の手前で静的 sanity check を追加し、最低限の内容が記入されていない spec を早期 FAIL させる。

## Scope Verification
- In scope:
  - [P1] spec gate（phase=spec）で spec.json の静的 sanity check を追加する。goal が空文字（trim 後）の場合、FAIL を返す
  - [P1] spec gate で requirements 配列が空の場合、FAIL を返す
  - [P1] spec gate で acceptance_criteria 配列が空の場合、FAIL を返す
  - [P2] 上記 sanity check を検証するユニットテストを追加する
- Out of scope:
  - JSON スキーマ（spec.schema.json）への minLength/minItems 追加。スキーマは空 stub 生成時にも使われるため、gate レベルでのみ制約する
  - scope.in 等その他フィールドの非空チェック
  - AI guardrail プロンプトの修正

## Impact on Existing Features
- spec gate（phase=spec）— 空の spec.json で PASS していたものが FAIL に変わる。これは意図した動作変更であり、正しく記入された spec には影響しない
- 空 stub 生成 — 影響なし。JSON スキーマバリデーションは変更せず、gate の静的チェックにのみ追加するため、stub 生成は従来通り動作する

## Q&A
- Q: goal の空判定基準は？
  - A: trim 後の空文字で判定する。根拠: 既存コードで tasks[] の非空チェック（spec 226）が同じ静的チェック関数内で行われており、そのパターンに合わせる。空白のみの goal は AI guardrail に渡しても有意な評価ができない。
- Q: requirements 配列の各エントリの desc も非空チェックすべきか？
  - A: 本 Issue のスコープは「配列レベルの空」のみ。根拠: Issue #252 の再現手順が示す問題は「配列が空だと AI が "該当なし" で PASS する」点。個別エントリの品質は既存 AI guardrail（unambiguous-requirements）が担当する。
- Q: Issue の内容で要件は十分か？
  - A: はい。根拠: 既存コードの gate 静的チェックパターン（tasks[] 非空チェック: spec 226）と同形式で追加でき、Issue の再現手順で修正条件が検証可能。

## Open Questions
- なし

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-24
- Notes: auto mode

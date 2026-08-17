# Draft: 144-improve-auto-spec-quality

**開発種別:** 改善（既存機能の品質向上）

**目的:** auto mode の self-Q&A で生成される spec の品質を向上させる。現状では人間が書く spec と比べて浅い分析になりがちな点を、チェックリスト拡張とソースコード深読み指示で改善する。

## 背景

auto mode（autoApprove: true）では、AI が自問自答で draft を作成する。この際のチェックリストは5項目（Goal & Scope, Impact on existing, Constraints, Edge cases, Test strategy）だが、「代替案の検討」や「将来の拡張性」が含まれていないため、spec が浅くなる傾向がある。

また、Issue の内容が薄い場合（タイトルと簡単な説明のみ）、AI が十分な文脈を得られずに表面的な spec を生成してしまう問題がある。

## Q&A

### Q1: 変更対象のファイルは何か？
A: `src/templates/skills/sdd-forge.flow-plan/SKILL.md` のみ。SKILL.md テンプレートの autoApprove mode セクションと、通常モードの Requirements category checklist の両方にチェック項目を追加する。

### Q2: 追加するチェック項目は何か？
A: 以下の2項目を既存のチェックリストに追加する:
- **Alternatives considered** — 他のアプローチを検討し、選択理由を説明する
- **Future extensibility** — 将来の拡張・変更への影響を考慮する

### Q3: ソースコード深読み指示はどう実装するか？
A: autoApprove mode セクションに条件付き指示を追加する。Issue 本文が200文字未満の場合、`sdd-forge flow get context` の結果だけでなく、関連するソースコードファイルを直接 Read して深く理解するよう指示する。200文字の閾値は AI が判断に使う目安であり、ハードコードされたバリデーションではない。

### Q4: 通常モード（autoApprove: false）にも影響するか？
A: はい。Requirements category checklist は通常モードでも使用される（line 100-105）。両方のチェックリストに同じ項目を追加して一貫性を保つ。

### Q5: 既存の動作に影響はあるか？
A: SKILL.md はスキルテンプレートであり、AI への指示テキストにすぎない。コードロジックには影響しない。gate チェックも変更不要（gate は draft.md/spec.md の構造をチェックするものであり、チェックリスト項目数は検証しない）。

### Q6: 代替案の検討
A: 
- **案1（採用）**: SKILL.md のチェックリストに項目を追加する — シンプルで効果的。テンプレート変更のみで完結する。
- **案2**: gate チェックに「代替案セクション必須」を追加する — 強制力は高いが、全ての spec に代替案が必要とは限らない。小さなバグ修正に代替案は不要。過剰な制約。
- **案3**: 別の AI プロンプトテンプレートを用意する — 複雑性が増すだけで、チェックリスト追加で十分。

### Q7: 将来の拡張性
A: チェックリストは今後も項目追加が想定される。現在のマークダウンリスト形式は拡張が容易。将来的にチェック項目をプリセットやコンフィグで制御する可能性はあるが、現時点ではテンプレート直接編集で十分。

## 変更の影響

- `src/templates/skills/sdd-forge.flow-plan/SKILL.md`: チェックリスト拡張 + ソースコード深読み指示追加
- テンプレート変更後 `sdd-forge upgrade` で実プロジェクトのスキルファイルに反映が必要
- 既存の gate チェック、flow コマンド、テストには影響なし

## Approval

- [x] User approved this draft (autoApprove)

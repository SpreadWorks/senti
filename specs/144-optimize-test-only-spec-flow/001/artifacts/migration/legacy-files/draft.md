# Draft: Eliminate redundant test/impl phases for test-only specs

**目的:** テスト追加のみの spec で auto mode 実行時に、impl フェーズが空ステップになる問題を解消する。SKILL.md に「テストのみ spec の場合 impl を自動スキップ」指示を追加する。

**開発種別:** Enhancement

## Q&A

### 1. Goal & Scope
**Q:** ゴールは明確か？
A: 明確。flow-impl の SKILL.md に、テスト追加のみ（プロダクトコード変更なし）の spec では impl フェーズを自動的に done にスキップする指示を追加する。

### 2. Impact on existing
**Q:** 既存機能への影響は？
A: SKILL.md のテキスト変更のみ。コードロジックの変更なし。auto mode でテストのみ spec を処理する際の AI の行動が変わる。

### 3. Constraints
**Q:** 制約は？
A: 判断基準は AI が spec を読んで判断する（spec にプロダクトコード変更が含まれるか）。フラグ等のコード変更は行わない（Issue の Proposed Solutions の1番目のアプローチ）。

### 4. Edge cases
**Q:** 境界条件は？
A: テストコードの変更 + プロダクトコードの変更がある場合は通常の impl フェーズを実行する。判断が曖昧な場合は通常フローを実行する（安全側に倒す）。

### 5. Test strategy
**Q:** テスト戦略は？
A: SKILL.md のテキスト変更のみのため、テストは不要。テストなしの理由を spec に明記する。

## Decisions
1. flow-impl SKILL.md の step 1 に「テストのみ spec の判定と impl スキップ」指示を追加
2. flow-plan SKILL.md の test phase 完了後の遷移にも注記を追加
3. コード変更なし（SKILL.md テキストのみ）

- [x] User approved this draft (autoApprove)

# Draft: flow-state.js の JSON 破損検出

## Issue
#46: Detect corrupted JSON in flow-state.js

## Self-Q&A

### 1. Goal & Scope
- Goal: flow-state.js の loadActiveFlows() で JSON パースエラーを検出し警告ログを出力する
- Scope: lib/flow-state.js の1箇所の catch ブロック修正のみ

### 2. Impact on existing
- loadActiveFlows() は flow get/set/run の全コマンドから呼ばれる
- 現在の振る舞い: パースエラー時に空配列を返す → フロー状態が無言で失われる
- 修正後: パースエラー時に警告ログ + 空配列を返す → 動作は同じだがユーザーが問題を認識できる
- ENOENT は引き続き無視（ファイル未存在は正常動作）

### 3. Constraints
- ガードレール「エラーの黙殺禁止」に対応する修正
- flow-state.js に既存の logger がない → createLogger を import するか、console.error を使用
- 既存の flow-state.js のパターンに合わせる

### 4. Edge cases
- .active-flow が空ファイルの場合 → JSON.parse("") は SyntaxError → 警告ログ + 空配列
- .active-flow のパーミッションエラー → EACCES → 警告ログ + 空配列
- .active-flow が存在しない場合 → fs.existsSync で事前チェック済み → catch に入らない

### 5. Test strategy
- specs/<spec>/tests/ にバグ修正確認テストを配置
- 破損 JSON を書き込んで loadActiveFlows() を呼び、空配列が返ることを確認
- ログ出力の確認はスコープ外（console.error のモックが複雑）

- [x] User approved this draft (autoApprove)

# Draft: 228-fix-runcmd-stderr-on-success

**開発種別:** bugfix
**目的:** `runCmd` が成功時に stderr を破棄するバグを修正し、呼び出し側が成功時も stderr を取得できるようにする。

## Scope Verification
- In scope:
  - 同期コマンド実行関数の内部実装を変更し、成功時も stderr を返却する
  - 成功時 stderr 取得の単体テストを追加
- Out of scope:
  - 非同期コマンド実行関数の変更（既に正しく stderr を返却している）
  - 呼び出し側の変更（コマンド実行関数の契約が修正されれば自動的に解消）
  - サブプロセスの出力仕様変更

## Requirements
- R1: 同期コマンド実行関数がコマンド成功（exit 0）で完了した場合、戻り値の stderr フィールドにサブプロセスの stderr 出力が格納されていること。
- R2: コマンドが成功した場合も失敗した場合も、戻り値は ok, status, stdout, stderr, signal, killed の6フィールドを持ち、各フィールドの型（boolean, number, string, string, string|null, boolean）は変わらないこと。
- R3: コマンド失敗時（非ゼロ終了・タイムアウト・シグナル受信）は、既存テストが全て PASS すること。

## Impact on Existing Features
- 影響ありの既存機能:
  - 同期コマンド実行関数を使用する全呼び出し元: 成功時に stderr フィールドが空文字から実際の stderr 出力に変わる。呼び出し側は既に stderr を参照する前提で書かれているため、動作が正しくなるだけで破壊的変更はない。
  - review コマンド: stderr からカウンタ・verdict を正しく取得できるようになり、自動適用ルートが正常に機能する。

## Q&A
- Q1: 修正対象は同期コマンド実行関数のみで十分か？
  - A: はい。呼び出し側は既に stderr を参照するコードが書かれており、関数が正しく stderr を返せば連鎖的に解消する。
- Q2: テスト戦略は？
  - A: 既存の単体テストファイルに「成功時に stderr を返す」テストケースを追加。契約が正しければ上位も正しく動作するため、呼び出し側のテスト追加は不要。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-24
- Notes:

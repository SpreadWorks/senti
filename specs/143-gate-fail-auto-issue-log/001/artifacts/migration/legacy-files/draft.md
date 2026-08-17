# Draft: Auto-record issue-log entry via post/onError hook on gate FAIL

**目的:** gate FAIL 時に issue-log エントリを自動記録する post/onError フックを追加し、AI のスキル指示不遵守に依存しない確実な gate FAIL 追跡を実現する。

**開発種別:** Enhancement

## Q&A

### 1. Goal & Scope

**Q:** ゴールは明確か？スコープは限定されているか？

A: ゴールは明確。`src/flow/registry.js` の gate エントリに post フック（FAIL 時の issue-log 自動記録）と onError フック（gate コマンド自体のクラッシュ記録）を追加する。スコープは registry.js の gate エントリのみ。

### 2. Impact on existing

**Q:** 既存機能への影響は？

A: 現在の gate の post フックはステップステータスの更新のみ（pass → done, fail → in_progress）。これに issue-log 記録を追加する。既存のステータス更新ロジックは変更しない。gate PASS 時は何も追加されない。

### 3. Constraints

**Q:** 制約・ガードレールは？

A:
- `loadIssueLog` / `saveIssueLog` は既存（`set-issue-log.js` からインポート）
- `finalizeOnError` と同じ best-effort パターン（失敗しても握りつぶす）— ガードレール「エラーの黙殺禁止」に対して: フックのエラーがメインの gate 処理を壊してはならないため、best-effort は正当
- gate の `result` オブジェクトには `result` ("pass" or "fail"), `artifacts.issues`, `artifacts.reasons` が含まれる

### 4. Edge cases

**Q:** 境界条件・エラーケースは？

A:
- gate PASS 時: 何もしない
- gate コマンドが例外をスロー: onError でクラッシュ情報を記録
- flow.json がない（フロー未開始）: `loadIssueLog` がデフォルトを返すので問題なし
- 複数回の gate 実行（リトライ）: 毎回エントリが追加される（これは意図通り）

### 5. Test strategy

**Q:** テスト戦略は？

A:
- registry.js の gate エントリに post/onError フックが定義されていることの確認テスト
- post フックが gate FAIL 時に issue-log にエントリを追加することのユニットテスト
- gate PASS 時に issue-log にエントリが追加されないことの確認

## Decisions

1. gate の post フックを拡張して、`result.result !== "pass"` の場合に issue-log エントリを追加する
2. gate の onError フックを追加して、gate コマンド自体のクラッシュを記録する
3. `finalizeOnError` と同じ `loadIssueLog` / `saveIssueLog` パターンを使用する
4. post フックのエントリには `step: resolveGateStepId(ctx.phase)`, `reason: issues`, `trigger: "gate post hook"` を含める

- [x] User approved this draft (autoApprove)

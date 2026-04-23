# Draft: 222-gate-impl-tests-prereq

**開発種別:** bugfix
**目的:** `sdd-forge flow run gate --phase task-impl` が「head test evidence 不足」で不可解に FAIL し retry を空消費する問題を解消する。SKILL.md 手順の明文化 (Issue #246 提案 A) と gate-impl の事前ガード追加 (Issue #246 提案 C) で対応する。

## Scope Verification
- In scope:
  - **[P1] 事前ガード**: 実装フェーズの gate (task-impl / integration phase) を実行したとき、head test evidence が flow 状態に記録されていない場合、AI 呼び出し前に明確な復旧手順を含む FAIL を返すこと。
  - **[P1] 早期 FAIL は retry カウンタを消費しない**: 上記ガードによる FAIL が発生したとき、gate の retry カウンタ（`config.flow.retry.max` 予算）を消費しないこと。
  - **[P2] 手順の明文化**: 実装フェーズのスキルプロンプトを読んだとき、gate 実行前に test evidence を flow 状態へ記録する必要があること、およびその手段（`sdd-forge flow run tests`）が読み取れること。
  - **[P3] 古い記述の削除**: プラン/テストフェーズのスキルプロンプトを読んだとき、存在しないコマンド参照（現状 `sdd-forge flow get test-result` が例示されているが実在しない）が含まれないこと。

- Out of scope:
  - gate-impl が内部で `flow run tests` を自動実行する挙動 (Issue #246 提案 B)。テスト実行コスト・副作用が大きいため。
  - baseline test evidence が無い場合の挙動変更（既存の `BASELINE_MISSING_WARNING` 処理を踏襲）。
  - `sdd-forge flow get test-result` サブコマンドを新設する案。stale 参照を正しい仕組み（`flow run tests` が flow 状態を更新する）の説明に差し替えるだけとする。
  - retry カウンタ自体の設計変更。
  - 配布済みプロジェクトへの自動反映（`sdd-forge upgrade` の既存メカニズムに委ねる）。

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge flow run gate --phase task-impl` / `--phase integration`: head evidence 未記録時に AI 呼び出し前で FAIL するよう挙動が変わる。通常フロー（`flow run tests` → gate）で gate を呼ぶケースは不変。
  - 実装フェーズのスキル/プロンプト配布: `sdd-forge upgrade` で更新後のテキストが配布先プロジェクトへ反映される（通常動作）。
- 影響なし:
  - gate の draft / spec / task-spec フェーズ（test evidence を参照しない）。
  - `sdd-forge flow run tests` 自体の実行挙動。
  - prelude の baseline 取得フロー。

## Priority Order
- P1: 事前ガード + retry カウンタ非消費（バグ修正の中核）
- P2: 実装フェーズ手順の明文化（提案 A）
- P3: stale な `flow get test-result` 参照の除去（近接するドキュメント整合）

## Q&A
- Q: 早期 FAIL は retry カウンタを消費すべきか？
  - A: 消費しない。ユーザーが 1 コマンド追加で解消できる環境問題であり、実装の retry 予算を食わせるのは不合理であるため。
- Q: head test evidence が記録済みだが件数が少ないケースは？
  - A: 既存挙動を維持する。件数の妥当性判定は gate 内部の AI 評価に委譲する。このスコープの判定は「記録の有無」の 2 値のみ。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: Issue #246 推奨 A + C 採用。B は out-of-scope。

# Draft: 210-gate-impl-noop-rerun-guard

**開発種別:** feature
**目的:** gate-impl の「FAIL → 修正せず再実行」アンチパターンを物理的に防止し、retry ceiling を AI 判定ブレ専用の予算として健全化する。

## Scope Verification
- In scope:
  - 2 層の防止策を同一 spec で実装する（1: gate-impl プロンプトへの MUST 追加、2: gate-impl 実行側の機械的再実行拒否）。
  - 対象 phase は diff-based gate の phase のみ（task-impl / integration）。
- Out of scope:
  - AI 判定ブレ（REQ-SPEC の PASS/FAIL 揺れ等）の安定化。
  - retry ceiling 値の変更。
  - retry counter reset 機構（既に別 spec で実装済み）。
  - diff-based でない gate（draft / spec / task-spec）。

## Priority of In-Scope Items
1. 機械ガード層 — AI 遵守に依存せず確実に停止する最後の防波堤。ceiling 浪費の直接原因を塞ぐ。
2. ガイダンス層 — AI に修正の必要性を明示し、行動変容を促す。
3. 拒否時の retry counter 非消費 — 誤 no-op 再実行が ceiling を食わないよう扱いを明確化する。

## Requirements

- **REQ-1** When gate-impl が FAIL で終了するとき, システムは FAIL 時点の作業ツリー状態を表す識別子（コミット済み内容と未コミット変更の両方を反映したもの）を当該 FAIL の永続ログエントリに含めて記録する shall.
- **REQ-2** When ユーザーまたは AI が gate-impl を再実行するとき, システムは AI 評価を開始する前に、直前の同一 phase の FAIL エントリがあれば、その記録済み状態識別子と現在の作業ツリー状態識別子を比較する shall.
- **REQ-3** If REQ-2 の比較で両識別子が一致する, then システムは AI を呼び出さずに再実行を拒否し、直前 FAIL の理由と修正後再実行を促す指示を含むエラーメッセージを返す shall.
- **REQ-4** When REQ-3 による拒否が発生する, システムは retry counter を消費してはならない shall not.
- **REQ-5** When gate-impl の再実行が必要な状況にある AI エージェントは, gate-impl プロンプトの指示により、再実行前に何を修正したか（または修正が不要である根拠）を修正証跡として明示する義務を負う shall.
- **REQ-6** If 直前 FAIL から作業ツリー状態が変化していない状態で再実行しようとする, then AI エージェントは gate-impl プロンプトの指示により、そもそも再実行を試みてはならない shall not.

## Impact on Existing Features
- 影響ありの既存機能:
  - gate-impl / gate-integration 実行: FAIL 記録に状態識別子フィールドが追加される。
  - gate-impl 実行エントリーポイント: AI 呼び出し前に状態比較の早期拒否分岐が追加される。
  - issue-log エントリ shape: FAIL エントリにフィールドが増える（既存エントリとは互換読み込み）。
- 影響なし:
  - draft / spec / task-spec の gate 動作。
  - PASS 時の issue-log エントリ shape。
  - retry counter の加算・リセットロジック。

## Q&A
- Q: なぜプロンプト層と機械ガード層の両方を入れるのか？
  - A: 推奨は 2 層同時実装。プロンプト単独では AI の指示取りこぼしで機能しないことが `specs/207-spec-json-primary` / `specs/203-next-action-cli` の issue-log で実証済み。機械ガード単独では AI に FAIL 理由が伝わらず retry を 1 つ消費する印象を与えうる。
  - Basis: (3) 既存コード実績。
- Q: 「変化あり」と見なす範囲は？
  - A: 推奨はコミット済みの変更と未コミットの変更の両方を対象とする。片方だけでは実質的な修正を取りこぼす。
  - Basis: (2) ガードレール原則 `Unambiguous Requirements`。
- Q: 拒否判定の参照点は？
  - A: 推奨は同一 phase の直前 FAIL エントリのみ。PASS を挟むか phase が異なれば状態一致でも拒否しない（自然リセット）。
  - Basis: (3) 既存コード実績 — 既存の retry counter も「PASS で 0 にリセット」「phase scope で分離」の設計を採用。
- Q: 拒否時に retry counter は消費するか？
  - A: 推奨は消費しない。拒否は FAIL/PASS いずれでもないため。これにより AI の誤 no-op 再実行が ceiling を食わない。
  - Basis: (1) 本 draft の目的。
- Q: 拒否時のユーザー体験は？
  - A: 既存の retry exhausted エスカレーションと同じ形式で返すことを推奨。直前 FAIL の理由を再掲し、修正後再実行を促すメッセージを含める。
  - Basis: (3) 既存コード実績 — 既存 retry exhausted の返し方と揃える。

## Open Questions
- （なし）

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-22
- Notes: auto-check eligible (score 20/24), autoApprove=true による自己Q&A draft。

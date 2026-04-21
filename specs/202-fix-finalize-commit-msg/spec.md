# Feature Specification: 202-fix-finalize-commit-msg

**Feature Branch**: `feature/202-fix-finalize-commit-msg`
**Created**: 2026-04-21
**Status**: Draft
**Input**: Issue #197 — `flow finalize` の自動 commit が実装内容と無関係に `"chore: add retro and report"` メッセージで記録される

## Goal

`sdd-forge flow run finalize` が発行する retro/report 用の後処理コミットに、spec ディレクトリ外の未コミット変更（実装コード・テスト・ドキュメント等）が混入しないようにする。git log / git blame による変更追跡性と、PR レビュー時の差分読解性を回復する。

## Scope

- finalize の retro/report 後処理コミットにおけるステージ範囲の限定
- 当該修正の回帰を検知する自動テストの追加

## Out of Scope

- finalize の主たるコミット（実装変更コミット）のステージ範囲・メッセージ生成ロジック（既存挙動を維持）
- retro/report の固定コミットメッセージ自体の変更（スコープが正しければ意味が通るため不変）
- 過去に誤メッセージで記録された履歴の書き換え
- retro/report の後処理を複数コミットに分割する構造変更
- 残余未コミット変更に対する警告表示ロジック

## Clarifications (Q&A)

- Q: バグの本質は「commit メッセージが固定」か「commit スコープが汚染」か？
  - A: 後者（スコープ汚染）として対応する。メッセージを動的生成する方針は AI 判断を挟み回帰リスクが大きい。
- Q: 後処理コミットがステージすべき対象は？
  - A: spec ディレクトリ単位で指定する（retro / report / issue-log 等の metadata が同ディレクトリ配下に集約されているため拡張性・意図明示性が高い）。
- Q: 残余の未コミット変更をどう扱うか？
  - A: 警告は追加せず放置する。`git status` による可視化で十分。
- Q: テスト方式は？
  - A: ソース検査型の回帰テスト。既存の finalize 関連テストと同方式で低コスト・高安定。

## Alternatives Considered

- commit メッセージを変更内容に応じて動的生成する案: AI 判断に依存し、新たなバグの温床になるため不採用。
- retro.json / report.json / issue-log.json を個別にステージする案: 将来 metadata ファイルが追加された際の拡張コストが高いため不採用。
- 残余未コミット変更の検知と warning 出力: 新たな表示仕様・分岐・テストを増やすため不採用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-21
- Notes: autoApprove mode — gate PASS により自動承認

## Requirements

優先度順（上から高）:

1. When finalize が retro/report 生成後の後処理コミットを発行する時、そのコミットは当該 spec ディレクトリ配下の変更のみをステージし、spec ディレクトリ外の変更は取り込まない shall be。
2. When finalize が主たる（実装変更の）コミットを発行する時、既存の `git add -A` 相当のステージ範囲と既存の commit メッセージ生成ロジックを維持する shall be。
3. When 後処理コミットが spec ディレクトリをステージする時、そのディレクトリ配下に生成・更新された retro / report / issue-log などの metadata ファイルを全て含める shall be。
4. When 後処理コミット完了後に spec ディレクトリ外に未コミット変更が残っている場合、それらをステージ／コミットせず、ワーキングツリー上で未コミット状態のまま保持する shall be（`git status` で可視化される）。
5. When 本修正が将来のリファクタで再び壊れる場合、自動テストで検知できる shall be。

## Acceptance Criteria

- 要件1: `sdd-forge flow run finalize` の後処理コミットでは、spec ディレクトリ外のファイルはステージされない。
- 要件2: 主たるコミットの挙動（ステージ範囲・メッセージ）は本修正前後で同等である。
- 要件3: spec ディレクトリ配下の retro.json / report.json / issue-log.json（存在するもの全て）が後処理コミットに含まれる。
- 要件4: 後処理コミット直後、spec ディレクトリ外の未コミット変更が存在した場合、それらは引き続き `git status` で可視であり、追加の警告出力は発生しない。
- 要件5: `npm test` の対象として、後処理コミットのステージ範囲が spec ディレクトリに限定されていることを検証する回帰テストが存在する。

## Open Questions

なし

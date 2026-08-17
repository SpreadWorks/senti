# Feature Specification: 171-finalize-preflight

**Feature Branch**: `feature/171-finalize-preflight`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User request

## Goal
- `sdd-forge flow run finalize` 実行前に `.git` 書き込み可否を preflight で検査し、
  実行不能環境（read-only など）では処理を開始せず、原因と次アクションを明示して終了する。

## Scope
- finalize 実行開始前に `.git` 配下へのロックファイル書き込み可否を検査する。
- 検査失敗時は専用エラーコードと help を返して終了する。
- 既存の finalize 実行フロー（all/select、merge/sync/cleanup）には影響を与えない。
- preflight の単体テストを追加する。

## Out of Scope
- Codex 実行環境の権限モデル自体の変更。
- GitHub 側設定変更や OS マウント設定変更。
- finalize 以外の flow コマンドへの preflight 拡張。

## Clarifications (Q&A)
- Q: read-only 環境で finalize が途中失敗する現象は sdd-forge 側で扱うべきか
  - A: はい。失敗前に preflight で検出し、即時に案内付きで止める。
- Q: 失敗時の戻り値方針
  - A: エラーコード 1。メッセージ本文に help を含める。

## Alternatives Considered
- 実行失敗後にエラー文だけ改善する案
  - 却下。commit/merge フェーズまで進んでから失敗するため、原因切り分けと再実行コストが大きい。
- finalize ではなく skill 側のみで対処する案
  - 却下。CLI 単体利用時に再発し、根本解決にならない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: 「毎回出る問題なので解決策を実装する」方針で合意。

## Requirements
- R1. `flow run finalize` は本処理前に `.git` 書き込み可否の preflight を必ず実行すること。
- R2. preflight 失敗時、finalize は commit/merge/sync/cleanup を開始せずに終了すること。
- R3. preflight 失敗時のエラーは `ok: false` で、実行不能理由（read-only など）と次アクションを含む help を返すこと。
- R4. preflight 失敗時の CLI 終了コードは 1 とすること。
- R5. preflight の成功/失敗（特に read-only 相当）を単体テストで固定すること。

## Acceptance Criteria
- AC1. `.git` へ書き込み可能な通常環境では既存 finalize フローが変更なく実行される。
- AC2. `.git` が read-only の場合、`flow run finalize` は本処理前に停止し、エラーと help を返す。
- AC3. preflight 失敗時、`flow.json` の commit/merge/sync/cleanup ステップは進行しない。
- AC4. 追加テストが fail-before / pass-after を再現し、CI で安定して検証できる。

## Open Questions
- [x] なし

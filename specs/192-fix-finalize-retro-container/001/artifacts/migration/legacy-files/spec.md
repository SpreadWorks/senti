# Feature Specification: 192-fix-finalize-retro-container

**Feature Branch**: `feature/192-fix-finalize-retro-container`
**Created**: 2026-04-19
**Status**: Ready for approval
**Input**: Issue #179 — finalize の retro が `container.get is not a function` で失敗する

## Goal

`sdd-forge flow run finalize` 実行時に、commit 完了後の retro 処理が `container.get is not a function` エラーで失敗し、retro.json が生成されず report/metrics に retro 情報が欠落している退行を解消する。finalize の retro ステップが正常完了し、生成物が揃う状態に戻す。

## Scope

- finalize の retro ステップ呼び出しの不具合修正
- 上記修正に対する退行防止テストの追加（`tests/` 配下）

## Out of Scope

- retro 以降のステップ（report, merge, sync, cleanup）の仕様変更・リファクタ
- フロー共通基底のコマンド実行インターフェースの変更
- finalize 以外のコマンドへの修正

## Clarifications (Q&A)

- Q: 修正方針は誤った呼び出し側を既存パターンに整列させるか、基盤側の入力受理を広げるか？
  - A: 誤った呼び出し側を既存パターンに整列させる。基盤側を緩めると誤呼び出しの検出が難しくなるため。
- Q: テスト配置は `tests/`（formal）か spec 配下か？
  - A: `tests/`。finalize の retro 失敗は spec 文脈に依存せず常にバグのため。

## Alternatives Considered

- **A. 誤った呼び出し側を既存パターンに整列させる（採用）:** 差分最小、影響範囲限定。既存コード規約に整合。
- **B. 基盤側の入力受理を広げる:** 不採用。alpha 版ポリシー（後方互換コードを書かない）・過剰な防御コードを書かない方針に反する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: autoApprove による自動承認（ユーザーが "後はautoで進めてください" と指示）

## Requirements

**P1（必須）:**

1. When a user runs `sdd-forge flow run finalize` against a valid flow state, the command shall not raise `container.get is not a function`.
2. When the finalize pipeline completes, the system shall generate `retro.json` under the current spec directory.

**P2（必須・同一 PR で対応）:**

3. When the finalize pipeline completes, the finalize result payload shall contain a retro summary so that `report.json` generation receives it.
4. When a future change breaks the finalize retro invocation in the same way, `npm test` shall fail (a regression test under `tests/` shall cover this bug).

## Acceptance Criteria

- `sdd-forge flow run finalize` を有効なフロー状態で実行した際に `container.get is not a function` エラーが発生しないこと
- finalize 完了後、spec ディレクトリ配下に `retro.json` が生成されること
- finalize の結果 payload に retro サマリが含まれ、`report.json` にも反映されること
- 追加した退行防止テストが `npm test` で実行され、パスすること
- 既存のテストがすべて従前通りパスすること（退行なし）

## Impact on Existing Features

- finalize の retro ステップ: 現状は常に失敗 → 修正後は正常完了
- `report.json`: retro サマリが反映されるようになる
- flow metrics: retro データが記録されるようになる
- `retro.json`: spec ディレクトリに生成されるようになる
- 他コマンド（gate, impl, sync 等）: 影響なし

## Open Questions

なし

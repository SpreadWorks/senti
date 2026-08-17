# Feature Specification: 232-auto-check-phase-promotion

**Feature Branch**: `feature/232-auto-check-phase-promotion`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #266

## Goal
auto-check で reject されたユーザーの auto モード希望を記憶し、フェーズ完了時に再評価して昇格を提案する。

## Background
auto-check はフロー開始時の1点でしか評価されない。request が薄い段階で reject されると、その後 draft/spec で情報が充実しても auto モードに昇格する手段がない。Issue #255 の #5 を本機能に統合し、spec 208/213/218/220 の auto-check 系列を拡張する。

## Scope
- R1 [must]: autoDesired フラグの永続化（set auto on reject 時に true、set auto off 時に false）
- R2 [must]: フェーズ完了時（draft done / spec approved）の auto-check 再実行
- R3 [must]: 再評価 eligible 時の autoUpgrade シグナルを next-action envelope に含める
- R4 [must]: skill が autoUpgrade シグナルを検知して昇格選択肢を提示する
- R5 [must]: failed verdict を flow.json に保存しない
- R6 [should]: autoDesired=false のユーザーには昇格通知しない
- R7 [must]: preparing mode での autoDesired 継承

## Out of Scope
- hard-gate zero-tolerance 緩和 / THRESHOLD 再調整
- reason 文字列の表示改善

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- 既存 CLI コマンドの破壊的変更なし（新フィールド追加のみ）
- 再評価 AI 呼び出しは最大2回（draft done + approval done）に限定

## Design Principles
- 既存の auto-check / set-auto パスを最大限再利用し、昇格専用の新パスを最小化する
- autoDesired はオプトイン。ユーザーが auto を希望していない場合は一切介入しない

## Overview
### Modules
- set-auto.js: autoDesired フラグの永続化と failed verdict の非保存化
- run-auto-check.js: failed verdict の非保存化
- set-step.js: フェーズ完了時の再評価 post-hook
- get-next-action.js: autoUpgrade シグナルの envelope 追加
- run-prepare-spec.js: preparing state から flow.json への autoDesired 継承

### Data Flow
1. set auto on reject → autoDesired=true を flow.json に永続化
2. draft done / approval done → set-step post-hook → runAutoCheckCore → eligible verdict を保存 + autoUpgrade シグナル設定
3. get next-action → flow state から autoUpgrade を読み取り envelope に含める
4. skill → autoUpgrade 検知 → ユーザーに昇格選択肢提示 → set auto on (trust path で autoApprove=true)

### Decisions
- failed verdict を保存しない方針。trust path は eligible verdict でのみ発動する。(Issue #266 R5)
- 再評価タイミングは draft done と approval done。draft done が最大の情報ゲイン。(resolveAutoCheckInput のフェーズマッピング)
- autoUpgrade は next-action envelope の追加フィールド。context-rules.json には追加しない。(REQ-11 のスコープ外)
- 再評価は set-step.js の既存 post-hook パターンに従い async 同期実行。(set-auto.js の前例)

## Clarifications (Q&A)
- Q: approval done で再評価した場合、isSpecApproved が true のため buildSkipVerdict が返る。autoUpgrade シグナルを生成すべきか？
  - A: 生成する。skip verdict は eligible=true を保証するため、昇格の条件を満たす。

## Alternatives Considered
- failed verdict も保存して再評価時にクリア → タイミング管理が複雑化するため棄却
- 再評価をバックグラウンドで非同期実行 → 結果確定前にステップが進むリスクがあり棄却
- 拒否後も次のマイルストーンで再通知 → 明示的拒否を無視する UX のため棄却
- context-rules.json に autoUpgrade kind を追加 → 全ステップに影響し過剰のため棄却

## Impact on Existing Features
- set auto on: reject 時に autoDesired=true が追加で保存される。既存の Envelope.fail 応答は変更なし
- set auto off: autoDesired=false が追加で保存される。既存の autoApprove=false 応答は変更なし
- run auto-check: eligible=false 時に autoCheck フィールドが保存されなくなる（R5）。eligible=true 時の振る舞いは変更なし
- set step: draft→done / approval→done 時に非同期の再評価処理が追加される。再評価は条件（autoDesired=true, autoApprove=false）を満たす場合のみ
- get next-action: 応答に autoUpgrade フィールドが条件付きで追加される。既存フィールドは変更なし
- flow prepare: preparing state の autoDesired を flow.json に継承する処理が追加される

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-25 (autoApprove)
- Notes: autoApprove mode

## Requirements
- R1 [must]: flow set auto on が eligible=false で reject された場合、autoDesired=true を永続化する。set auto off で false に戻す。
- R2 [must]: set step で draft→done / approval→done 遷移時、autoDesired=true かつ autoApprove=false の場合に auto-check を再実行する。
- R3 [must]: 再評価 eligible 時に autoCheck + autoUpgrade: { available: true, reason } を flow.json に保存し、next-action envelope に含める。
- R4 [must]: skill は autoUpgrade.available === true を検知して昇格選択肢を提示する。
- R5 [must]: eligible=false の verdict を flow.json / preparing state に永続化しない。
- R6 [should]: autoDesired=false のフローでは再評価を実行しない。
- R7 [must]: preparing state の autoDesired を flow prepare で flow.json に継承する。
- R8 [must]: set auto on reject 時の exit code は既存の AUTO_CHECK_INELIGIBLE と同一を維持。再評価 post-hook の成否は set step の exit code に影響しない。
- R9 [must]: 変更される CLI コマンドは新しいユーザー入力引数を追加しない。autoDesired / autoUpgrade は内部状態フィールド。

## Acceptance Criteria
- AC1: set auto on reject 後に flow.json に autoDesired: true が存在する
- AC2: set auto off 後に autoDesired: false が存在する
- AC3: draft done 遷移時に条件を満たすフローで auto-check が再実行される
- AC4: 再評価 eligible 時に autoUpgrade: { available: true } が保存される
- AC5: next-action の応答に autoUpgrade が含まれる（条件を満たす場合のみ）
- AC6: eligible=false の verdict が永続化されない
- AC7: autoDesired=false のフローでは再評価が実行されない
- AC8: preparing mode で reject 後、flow.json に autoDesired: true が継承される

## Implementation Targets
- src/flow/lib/set-auto.js
- src/flow/lib/run-auto-check.js
- src/flow/lib/set-step.js
- src/flow/lib/get-next-action.js
- src/flow/lib/run-prepare-spec.js
- src/templates/skills/flow/SKILL.md

## Open Questions
(none)

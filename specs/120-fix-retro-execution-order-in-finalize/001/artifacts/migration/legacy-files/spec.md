# Feature Specification: 120-fix-retro-execution-order-in-finalize

**Feature Branch**: `feature/120-fix-retro-execution-order-in-finalize`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #61

## Goal

finalize パイプラインに retro ステップを追加し、cleanup より前に実行することで、retro が .active-flow と feature branch の diff にアクセスできるようにする。

## Scope

1. `finalize.js` の STEP_MAP に retro ステップを追加（merge と sync の間）
2. retro ステップの実装（`retro.js` を subprocess として呼び出す）
3. flow-finalize スキルテンプレートの retro セクションを更新
4. prompt 定義の finalize.steps に retro を追加

## Out of Scope

- retro.js 自体のロジック変更
- retro の AI エージェント呼び出し部分の変更

## Clarifications (Q&A)

- Q: retro はパイプラインのどの位置に入るべきか？
  - A: merge の後、sync の前。merge 完了後に diff が取れ、cleanup 前なので .active-flow が存在する。

- Q: retro が失敗した場合、パイプラインを止めるか？
  - A: 止めない。retro は記録用であり、失敗しても sync/cleanup/record は続行する。結果に `status: "failed"` を記録するのみ。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: autoApprove mode

## Requirements

Priority order:

1. **R1: STEP_MAP に retro を追加** — `finalize.js` の STEP_MAP を `{ 1: "commit", 2: "merge", 3: "retro", 4: "sync", 5: "cleanup", 6: "record" }` に変更する。既存の step 番号 3 (sync) 以降がずれる。
2. **R2: retro ステップの実装** — finalize.js に retro 実行ロジックを追加する。`retro.js` を subprocess で呼び出し（`--force` 付き）、成功/失敗/スキップを結果に記録する。retro の失敗はパイプラインを止めない。
3. **R3: スキルテンプレート更新** — flow-finalize SKILL.md の「step 6: retro」セクションを削除し、finalize パイプラインに retro が含まれることを記載する。
4. **R4: prompt 定義更新** — `finalize.steps` prompt の選択肢に retro を追加する。

## Acceptance Criteria

- AC1: `sdd-forge flow run finalize --mode all` 実行時に retro が merge の後、sync の前に実行される
- AC2: `sdd-forge flow run finalize --mode select --steps 3` で retro のみ実行できる
- AC3: retro が失敗しても、後続の sync/cleanup/record は実行される
- AC4: retro の結果が finalize の出力 JSON に含まれる（status: done/failed/skipped/dry-run）
- AC5: 既存の `--steps 1,2` (commit + merge) が引き続き動作する
- AC6: `--steps 1,2,4,5,6` のように retro をスキップして finalize できる
- AC7: retro が失敗した場合、結果 JSON の `steps.retro.status` が `"failed"` となり失敗理由が `message` に含まれる。finalize コマンド全体の終了コードは既存のステップ（commit/merge/sync/cleanup）の成否で決まり、retro の成否は影響しない（既存の finalize と同じパターン: 各ステップの結果を JSON で返し、呼び出し元が判断する）

## Open Questions

None.

## Design Notes

### CLI 後方互換性と移行手順

`--steps` の番号が変わる（旧 3=sync → 新 3=retro, 旧 4=cleanup → 新 5=cleanup 等）。これは破壊的変更である。

**移行手順**: `sdd-forge upgrade` を実行する。これによりスキルテンプレート（`.claude/skills/sdd-forge.flow-finalize/SKILL.md`）が更新され、新しい番号体系が反映される。`--steps` はスキルテンプレートが生成・使用するもので、ユーザーが直接入力する値ではない。

alpha 版ポリシーに基づき、旧番号の後方互換レイヤーは設けない。
